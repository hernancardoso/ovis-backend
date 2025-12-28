// uses DynamoDBDocumentClient; PK-only table with imei as Number
import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBClient, KeysAndAttributes } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  BatchGetCommand,
  BatchGetCommandInput,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { CollarEntity } from '../entities/collar.entity';

@Injectable()
export class DynamoDBCollarService {
  private readonly logger = new Logger(DynamoDBCollarService.name);
  private readonly client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
  });

  private readonly doc = DynamoDBDocumentClient.from(this.client);
  private readonly tableName = 'collar_last_activity';
  private readonly collarInitialInfoTableName = 'collar_initial_info';

  private parseLatest(item: any) {
    const parsedStatus = item.latest_status_json 
      ? JSON.parse(item.latest_status_json) 
      : null;
    
    const parsedLocation = item.latest_location_json
      ? JSON.parse(item.latest_location_json)
      : null;

    const location_timestamp = parsedLocation?.timestamp;
    
    // Validate and build latestLocation
    const hasValidLocation = parsedLocation 
      && parsedLocation.lat != null 
      && parsedLocation.long != null 
      && location_timestamp != null;
    
    const latestLocation = hasValidLocation
      ? {
          timestamp: location_timestamp,
          lat: parsedLocation.lat,
          long: parsedLocation.long,
        }
      : undefined;

    // Validate and build latestStatus
    const status_timestamp = parsedStatus?.timestamp;
    const hasValidStatus = parsedStatus && status_timestamp != null;
    
    const latestStatus = hasValidStatus
      ? {
          timestamp: status_timestamp,
          battery_voltage: parsedStatus.battery_voltage ?? null,
          rsrp: parsedStatus.rsrp ?? null,
          suse: parsedStatus.suse ?? null,
          stot: parsedStatus.stot ?? null,
        }
      : undefined;

    return {
      latestLocation,
      latestStatus,
    };
  }

  async getCollarInitialInfo(imei: number, limit: number = 10) {
    if (!imei) {
      this.logger.warn(`Invalid IMEI provided: ${imei}`);
      return null;
    }

    const params = {
      TableName: this.collarInitialInfoTableName,
      KeyConditionExpression: '#pk = :imei',
      ExpressionAttributeNames: {
        '#pk': 'imei',
        '#data': 'data',
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':imei': imei,
      },
      ProjectionExpression: 'imei, #data, #ts',
      ScanIndexForward: false,
    };

    let items: any[] = [];
    let lastEvaluatedKey: any | undefined;

    do {
      const resp = await this.doc.send(
        new QueryCommand({
          ...params,
          Limit: limit - items.length, // only fetch what’s left
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      if (resp.Items?.length) {
        items = items.concat(resp.Items);
      }

      if (items.length >= limit) {
        break;
      }

      lastEvaluatedKey = resp.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items.slice(0, limit);
  }

  async getCollarLastActivity(imei: number) {
    if (!imei) {
      this.logger.warn(`Invalid IMEI provided: ${imei}`);
      return null;
    }
    const resp = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { imei },
        ProjectionExpression: 'imei, latest_location_json, latest_status_json',
      })
    );
    if (!resp.Item) return null;
    const { latestLocation, latestStatus } = this.parseLatest(resp.Item);
    return { imei: resp.Item.imei as number, latestLocation, latestStatus };
  }

  async getMultipleCollarLastActivity(imeis: Array<number | string>) {
    const out = new Map<number, any>();
    if (!imeis?.length) return out;

    // Coerce all ids to numbers and drop invalid ones
    const normalized = imeis.filter((v): v is number => v !== null);

    if (!normalized.length) return out;

    // Chunk in 100s
    const chunks: number[][] = [];
    for (let i = 0; i < normalized.length; i += 100) chunks.push(normalized.slice(i, i + 100));

    for (const chunk of chunks) {
      let request: BatchGetCommandInput = {
        RequestItems: {
          [this.tableName]: {
            Keys: chunk.map((n) => ({ imei: n })),
            ProjectionExpression: 'imei, latest_status_json, latest_location_json',
          },
        },
      };

      let attempt = 0;
      while (true) {
        const resp = await this.doc.send(new BatchGetCommand(request));

        for (const item of resp.Responses?.[this.tableName] ?? []) {
          const { latestLocation, latestStatus } = this.parseLatest(item);
          out.set(item.imei as number, { imei: item.imei as number, latestLocation, latestStatus });
        }

        const unproc: KeysAndAttributes | undefined = resp.UnprocessedKeys?.[this.tableName];
        if (!unproc?.Keys?.length) break;

        attempt++;
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        this.logger.warn(
          `Retrying ${unproc.Keys.length} UnprocessedKeys in ${delay} ms (attempt ${attempt})`
        );
        await new Promise((r) => setTimeout(r, delay));
        request = {
          RequestItems: {
            [this.tableName]: {
              ...unproc,
              ProjectionExpression: unproc.ProjectionExpression ?? 'imei, latest_json, updatedAt',
            },
          },
        };
      }
    }

    return out;
  }

  /**
   * Enriches collar entities with DynamoDB activity data
   * Fetches latest location and status for all collars and maps them
   */
  async enrichCollarsWithActivityData(collars: CollarEntity[]): Promise<CollarEntity[]> {
    if (collars.length === 0) {
      return [];
    }

    const imeis = collars.map((collar) => collar.imei);
    const dynamoDataMap = await this.getMultipleCollarLastActivity(imeis);

    return this.mapCollarsWithActivityData(collars, dynamoDataMap);
  }

  /**
   * Maps collar(s) with DynamoDB activity data
   * Can handle either a single collar or an array of collars
   */
  private mapCollarsWithActivityData(
    collar: CollarEntity,
    dynamoData?: { latestLocation?: any; latestStatus?: any } | null
  ): CollarEntity;

  private mapCollarsWithActivityData(
    collars: CollarEntity[],
    dynamoDataMap: Map<number, { latestLocation?: any; latestStatus?: any }>
  ): CollarEntity[];
  
  private mapCollarsWithActivityData(
    collarsOrCollar: CollarEntity | CollarEntity[],
    dynamoDataOrMap?: { latestLocation?: any; latestStatus?: any } | null | Map<number, { latestLocation?: any; latestStatus?: any }>
  ): CollarEntity | CollarEntity[] {
    // Handle array case
    if (Array.isArray(collarsOrCollar)) {
      const collars = collarsOrCollar;
      const dynamoDataMap = dynamoDataOrMap as Map<number, { latestLocation?: any; latestStatus?: any }>;
      
      return collars.map((collar) => {
        const dynamoData = dynamoDataMap.get(Number(collar.imei));
        return this.mapCollarsWithActivityData(collar, dynamoData) as CollarEntity;
      });
    }
    
    // Handle single collar case
    const collar = collarsOrCollar;
    const dynamoData = dynamoDataOrMap as { latestLocation?: any; latestStatus?: any } | null | undefined;
    
    return {
      ...collar,
      latestLocation: dynamoData?.latestLocation,
      latestStatus: dynamoData?.latestStatus,
    } as CollarEntity;
  }
}

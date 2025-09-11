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
    const parsed_status = item.latest_status_json ? JSON.parse(item.latest_status_json) : null;
    const parsed_location = item.latest_location_json
      ? JSON.parse(item.latest_location_json)
      : null;

    const ts = parsed_status?.timestamp;
    return {
      latestLocation:
        parsed_location && parsed_location.lat != null && parsed_location.long != null && ts != null
          ? { timestamp: ts, lat: parsed_location.lat, long: parsed_location.long }
          : undefined,
      latestStatus:
        parsed_status && ts != null
          ? {
              timestamp: ts,
              battery_voltage: parsed_status.battery_voltage ?? null,
              rsrp: parsed_status.rsrp ?? null,
            }
          : undefined,
    };
  }

  async getCollarInitialInfo(imei: number, from: number, to: number) {
    if (!imei) {
      this.logger.warn(`Invalid IMEI provided: ${imei}`);
      return null; // still guard invalid input [6]
    }

    const params = {
      TableName: this.collarInitialInfoTableName,
      KeyConditionExpression: '#pk = :imei AND #ts BETWEEN :from AND :to',
      ExpressionAttributeNames: {
        '#pk': 'imei',
        '#data': 'data',
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':imei': imei,
        ':from': from,
        ':to': to,
      },
      ProjectionExpression: 'imei, #data, #ts',
      ScanIndexForward: false,
    };

    let items: any[] = [];
    let lastEvaluatedKey: any | undefined = undefined;

    do {
      const resp = await this.doc.send(
        new QueryCommand({
          ...params,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
      if (resp.Items?.length) items = items.concat(resp.Items); // paginate to get all [9]
      lastEvaluatedKey = resp.LastEvaluatedKey; // continue if more pages [9]
    } while (lastEvaluatedKey);

    // Optional: map/parse if needed
    return items;
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
}

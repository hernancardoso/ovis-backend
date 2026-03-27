import { Injectable } from '@nestjs/common';
import { GetReportDTO } from './dto/get-report.dto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { parseKeyValueLines } from './utils/parse-key-value-lines.util';

@Injectable()
export class ReportsService {
  private dynamoDb: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
    this.dynamoDb = DynamoDBDocumentClient.from(client);
  }

  async find(collarImei: number, params: GetReportDTO) {
    console.log(collarImei, params);
    const { start, end, acc } = params || {};

    try {
      // Validate query parameters
      if (!collarImei || !start || !end) {
        console.log(collarImei, ' y ', start, ' y ', end);
        throw new Error('Missing parameters: collarId, start, and end are required.');
      }

      if (isNaN(start) || isNaN(end)) {
        throw new Error('Invalid start or end timestamp');
      }

      const reports: any = [];
      let lastEvaluatedKey: any = null;

      const params: any = {
        TableName: 'report_acc_raw',
        KeyConditionExpression: 'imei = :collarImei AND #time BETWEEN :sdate AND :edate',
        ProjectionExpression: '#data, #time',
        ExpressionAttributeNames: { '#time': 'timestamp', '#data': 'data' },
        ExpressionAttributeValues: {
          ':collarImei': collarImei,
          ':sdate': start,
          ':edate': end,
        },
      };

      do {
        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        } else {
          delete params.ExclusiveStartKey;
        }

        const items: any = await this.dynamoDb.send(new QueryCommand(params));

        items.Items.forEach((item) => {
          const { x, y, z } = parseKeyValueLines(item.data);
          reports.push({
            timestamp: item.timestamp,
            x,
            y,
            z,
          });
        });

        lastEvaluatedKey = items.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return reports;
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

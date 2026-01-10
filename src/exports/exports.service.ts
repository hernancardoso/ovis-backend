import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  QueryExecutionState,
} from '@aws-sdk/client-athena';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { CreateExportDto } from './dto/create-export.dto';
const moment = require('moment');

@Injectable()
export class ExportsService {
  private readonly athena: AthenaClient;
  private readonly s3: S3Client;
  private readonly databaseName = 'iot_raw';
  private readonly tableName = 'collar_messages';
  private readonly exportsBucket = process.env.AWS_EXPORTS_BUCKET || 'iot-exports-prod';
  private readonly athenaWorkGroup = process.env.AWS_ATHENA_WORKGROUP || 'primary';
  private readonly athenaOutputLocation = process.env.AWS_ATHENA_OUTPUT_LOCATION || `s3://${this.exportsBucket}/athena-results/`;

  private readonly jobStore = new Map<string, { 
    queryExecutionId: string; 
    createdAt: Date;
    columns: string[];
    format: 'CSV' | 'JSON';
  }>();

  constructor() {
    const awsConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      },
    };

    this.athena = new AthenaClient(awsConfig);
    this.s3 = new S3Client(awsConfig);
  }

  private buildPartitions(fromDate: moment.Moment, toDate: moment.Moment): string[] {
    const partitionGroups: Map<string, number[]> = new Map();
    const current = fromDate.clone();
    
    while (current.isSameOrBefore(toDate, 'day')) {
      const year = current.year();
      const month = current.month() + 1;
      const day = current.date();
      const key = `${year}-${month}`;
      
      if (!partitionGroups.has(key)) {
        partitionGroups.set(key, []);
      }
      partitionGroups.get(key)!.push(day);
      current.add(1, 'day');
    }
    
    const partitions: string[] = [];
    partitionGroups.forEach((days, key) => {
      const [year, month] = key.split('-').map(Number);
      days.sort((a, b) => a - b);
      
      const ranges: Array<{ start: number; end: number }> = [];
      let rangeStart = days[0];
      let rangeEnd = days[0];
      
      for (let i = 1; i < days.length; i++) {
        if (days[i] === rangeEnd + 1) {
          rangeEnd = days[i];
        } else {
          ranges.push({ start: rangeStart, end: rangeEnd });
          rangeStart = days[i];
          rangeEnd = days[i];
        }
      }
      ranges.push({ start: rangeStart, end: rangeEnd });
      
      const conditions = ranges.map(range => {
        if (range.start === range.end) {
          return `day = ${range.start}`;
        } else {
          return `day BETWEEN ${range.start} AND ${range.end}`;
        }
      });
      
      const dayCondition = conditions.length === 1 
        ? conditions[0]
        : `(${conditions.join(' OR ')})`;
      
      partitions.push(`(year = ${year} AND month = ${month} AND ${dayCondition})`);
    });

    return partitions;
  }

  private calculateCost(dataScannedBytes: number, isEstimated: boolean = false) {
    if (!dataScannedBytes || dataScannedBytes === 0) {
      return null;
    }

    const dataScannedGB = dataScannedBytes / (1024 * 1024 * 1024);
    const dataScannedTB = dataScannedGB / 1024;
    const costPerTB = 5;
    const costUSD = dataScannedTB * costPerTB;

    return {
      dataScannedBytes,
      dataScannedGB: parseFloat(dataScannedGB.toFixed(4)),
      dataScannedTB: parseFloat(dataScannedTB.toFixed(6)),
      costUSD: parseFloat(costUSD.toFixed(4)),
      isEstimated,
    };
  }

  async createExport(createExportDto: CreateExportDto) {
    const jobId = randomUUID();
    const { collarImeis, from, to, fromTime, toTime, columns, format } = createExportDto;

    const fromDate = moment(from);
    const toDate = moment(to);
    const partitions = this.buildPartitions(fromDate, toDate);
    const columnList = columns.length > 0 ? columns.join(', ') : '*';
    
    const imeiFilter = collarImeis.length > 0 
      ? `AND imei IN (${collarImeis.join(', ')})`
      : '';

    let timestampFilter = '';
    if (fromTime || toTime) {
      const fromTimestamp = fromTime 
        ? moment(`${from} ${fromTime}`).valueOf()
        : fromDate.startOf('day').valueOf();
      const toTimestamp = toTime
        ? moment(`${to} ${toTime}`).valueOf()
        : toDate.endOf('day').valueOf();
      timestampFilter = `AND timestamp >= ${fromTimestamp} AND timestamp <= ${toTimestamp}`;
    }

    const partitionFilter = partitions.join(' OR ');
    const s3Path = `s3://${this.exportsBucket}/exports/${jobId}/`;

    const nullHandledColumns = columns.length > 0 
      ? columns.map(col => `COALESCE(CAST(${col} AS VARCHAR), '') AS ${col}`).join(', ')
      : columnList;
    
    const withClause = format === 'JSON'
      ? `format = 'JSON', compression = 'NONE'`
      : `format = 'TEXTFILE', field_delimiter = ';', compression = 'NONE'`;
    
    const query = `UNLOAD (
  SELECT ${columns.length > 0 ? nullHandledColumns : columnList}
  FROM ${this.databaseName}.${this.tableName}
  WHERE (${partitionFilter})
    ${imeiFilter}
    ${timestampFilter}
)
TO '${s3Path}'
WITH (
  ${withClause}
)`;

    try {
      const startQueryCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: {
          Database: this.databaseName,
        },
        ResultConfiguration: {
          OutputLocation: this.athenaOutputLocation,
        },
        WorkGroup: this.athenaWorkGroup,
      });

      const response = await this.athena.send(startQueryCommand);
      const queryExecutionId = response.QueryExecutionId;

      if (!queryExecutionId) {
        throw new InternalServerErrorException('Failed to start query execution');
      }

      this.jobStore.set(jobId, {
        queryExecutionId,
        createdAt: new Date(),
        columns: columns.length > 0 ? columns : [],
        format,
      });

      return { jobId };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to create export: ${error.message}`);
    }
  }

  async getExportStatus(jobId: string) {
    const job = this.jobStore.get(jobId);
    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    try {
      const getQueryCommand = new GetQueryExecutionCommand({
        QueryExecutionId: job.queryExecutionId,
      });

      const response = await this.athena.send(getQueryCommand);
      const queryExecution = response.QueryExecution;

      if (!queryExecution) {
        throw new NotFoundException(`Query execution not found for job ${jobId}`);
      }

      const state = queryExecution.Status?.State as QueryExecutionState;
      const stateString = state ? String(state) : 'UNKNOWN';
      const s3Path = state === QueryExecutionState.SUCCEEDED
        ? `s3://${this.exportsBucket}/exports/${jobId}/`
        : undefined;

      let dataScannedBytes = queryExecution.Statistics?.DataScannedInBytes || 0;
      let isEstimated = false;
      
      if (dataScannedBytes === 0 && state === QueryExecutionState.SUCCEEDED) {
        try {
          const prefix = `exports/${jobId}/`;
          const listCommand = new ListObjectsV2Command({
            Bucket: this.exportsBucket,
            Prefix: prefix,
          });
          
          const s3Response = await this.s3.send(listCommand);
          const totalFileSize = (s3Response.Contents || [])
            .filter((obj) => {
              if (!obj.Key) return false;
              const fileName = obj.Key.split('/').pop() || '';
              const isMetadata = fileName === 'manifest' 
                || fileName === '_SUCCESS' 
                || fileName.startsWith('_')
                || fileName === '';
              return !isMetadata;
            }) 
            .reduce((sum, obj) => sum + (obj.Size || 0), 0);
          
          if (totalFileSize > 0) {
            dataScannedBytes = totalFileSize;
            isEstimated = true;
          }
        } catch (error) {
          // Ignore error, keep dataScannedBytes at 0
        }
      }
      
      const cost = dataScannedBytes > 0 ? this.calculateCost(dataScannedBytes, isEstimated) : null;

      return {
        state: stateString,
        s3Path,
        error: queryExecution.Status?.StateChangeReason,
        cost,
        statistics: {
          dataScannedBytes,
          executionTimeMs: queryExecution.Statistics?.TotalExecutionTimeInMillis,
          engineExecutionTimeMs: queryExecution.Statistics?.EngineExecutionTimeInMillis,
        },
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to get export status: ${error.message}`);
    }
  }

  async getExportFiles(jobId: string) {
    const job = this.jobStore.get(jobId);
    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    const status = await this.getExportStatus(jobId);
    if (status.state !== 'SUCCEEDED') {
      throw new InternalServerErrorException(`Export job ${jobId} is not completed. Current state: ${status.state}`);
    }

    try {
      const prefix = `exports/${jobId}/`;
      const listCommand = new ListObjectsV2Command({
        Bucket: this.exportsBucket,
        Prefix: prefix,
      });

      const response = await this.s3.send(listCommand);

      const files = (response.Contents || [])
        .filter((obj) => {
          if (!obj.Key) return false;
          const fileName = obj.Key.split('/').pop() || '';
          const isMetadata = fileName === 'manifest' 
            || fileName === '_SUCCESS' 
            || fileName.startsWith('_')
            || fileName === '';
          return !isMetadata;
        })
        .map(async (obj) => {
          const key = obj.Key!;
          const fileName = key.split('/').pop() || key;

          const getObjectCommand = new GetObjectCommand({
            Bucket: this.exportsBucket,
            Key: key,
          });

          // @ts-ignore
          const downloadUrl = await getSignedUrl(this.s3, getObjectCommand, {
            expiresIn: 3600,
          });

          return {
            name: fileName,
            size: obj.Size || 0,
            downloadUrl,
          };
        });

      return Promise.all(files);
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to list export files: ${error.message}`);
    }
  }

  async refreshDownloadUrls(jobId: string) {
    return this.getExportFiles(jobId);
  }
}


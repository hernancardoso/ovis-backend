import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  QueryExecutionState,
} from '@aws-sdk/client-athena';
import { GlueClient, GetTableCommand } from '@aws-sdk/client-glue';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { CreateExportDto } from './dto/create-export.dto';
import moment from 'moment';
import { PassThrough, Readable } from 'stream';
import { once } from 'events';

type ExportFormat = 'CSV' | 'JSON';
type ExportMode = 'UNLOAD' | 'QUERY_RESULTS';
type PostProcessingState = 'NOT_REQUIRED' | 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

type ExportPostProcessing = {
  type: 'NONE' | 'JSONL_MERGE';
  state: PostProcessingState;
  outputFileName?: string;
  s3Key?: string;
  error?: string;
};

type ExportJob = {
  queryExecutionId: string;
  createdAt: Date;
  columns: string[];
  format: ExportFormat;
  mode: ExportMode;
  singleFile: boolean;
  postProcessing: ExportPostProcessing;
  postProcessingPromise?: Promise<void>;
};

@Injectable()
export class ExportsService {
  private readonly athena: AthenaClient;
  private readonly glue: GlueClient;
  private readonly s3: S3Client;
  private readonly databaseName = 'iot_raw';
  private readonly tableName = 'collar_messages';
  private readonly exportsBucket = process.env.AWS_EXPORTS_BUCKET || 'iot-exports-prod';
  private readonly athenaWorkGroup = process.env.AWS_ATHENA_WORKGROUP || 'primary';
  private readonly athenaOutputLocation =
    process.env.AWS_ATHENA_OUTPUT_LOCATION || `s3://${this.exportsBucket}/athena-results/`;

  private readonly jobStore = new Map<string, ExportJob>();

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
    this.glue = new GlueClient(awsConfig);
    this.s3 = new S3Client(awsConfig);
  }

  private async getGlueColumnTypes(): Promise<Record<string, string>> {
    const response = await this.glue.send(
      new GetTableCommand({
        DatabaseName: this.databaseName,
        Name: this.tableName,
      })
    );

    const columns = response.Table?.StorageDescriptor?.Columns ?? [];

    return columns.reduce<Record<string, string>>((acc, column) => {
      const name = column.Name?.trim();
      const type = column.Type?.trim().toLowerCase();

      if (name && type) {
        acc[name] = type;
      }

      return acc;
    }, {});
  }

  private isComplexGlueType(type?: string) {
    if (!type) {
      return false;
    }

    return (
      type.startsWith('array<') ||
      type.startsWith('map<') ||
      type.startsWith('struct<') ||
      type.startsWith('row(')
    );
  }

  private buildExportColumnExpression(columnName: string, glueType?: string) {
    if (this.isComplexGlueType(glueType)) {
      return `CASE WHEN ${columnName} IS NULL THEN '' ELSE json_format(CAST(${columnName} AS JSON)) END AS ${columnName}`;
    }

    if (glueType === 'string' || glueType?.startsWith('varchar') || glueType?.startsWith('char')) {
      return `COALESCE(${columnName}, '') AS ${columnName}`;
    }

    return `COALESCE(CAST(${columnName} AS VARCHAR), '') AS ${columnName}`;
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

      const conditions = ranges.map((range) => {
        if (range.start === range.end) {
          return `day = ${range.start}`;
        } else {
          return `day BETWEEN ${range.start} AND ${range.end}`;
        }
      });

      const dayCondition = conditions.length === 1 ? conditions[0] : `(${conditions.join(' OR ')})`;

      partitions.push(`(year = ${year} AND month = ${month} AND ${dayCondition})`);
    });

    return partitions;
  }

  private resolveTimestampRange(createExportDto: CreateExportDto) {
    const { fromTimestamp, toTimestamp } = createExportDto;
    const hasValidFromTimestamp =
      typeof fromTimestamp === 'number' && Number.isFinite(fromTimestamp);
    const hasValidToTimestamp = typeof toTimestamp === 'number' && Number.isFinite(toTimestamp);

    if (!hasValidFromTimestamp || !hasValidToTimestamp) {
      throw new BadRequestException('Invalid export range');
    }

    if (fromTimestamp > toTimestamp) {
      throw new BadRequestException('Invalid export range');
    }

    const partitionFromDate = moment.utc(fromTimestamp).startOf('day');
    const partitionToDate = moment.utc(toTimestamp).startOf('day');

    return {
      fromTimestamp,
      toTimestamp,
      partitionFromDate,
      partitionToDate,
    };
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

  private getFileExtension(format: ExportFormat): 'csv' | 'json' {
    return format === 'JSON' ? 'json' : 'csv';
  }

  private getDownloadFileExtension(job: ExportJob, totalParts: number): 'csv' | 'json' | 'jsonl' {
    if (job.format === 'JSON' && job.singleFile && totalParts <= 1) {
      return 'jsonl';
    }

    return this.getFileExtension(job.format);
  }

  private getContentType(format: ExportFormat, singleFile: boolean = false): string {
    if (format === 'JSON' && singleFile) {
      return 'application/x-ndjson; charset=utf-8';
    }

    return format === 'JSON' ? 'application/json' : 'text/csv; charset=utf-8';
  }

  private isMetadataKey(key?: string): boolean {
    if (!key) return true;

    const fileName = key.split('/').pop() || '';
    if (!fileName || fileName.startsWith('_')) return true;

    const lowerName = fileName.toLowerCase();
    return (
      lowerName === 'manifest' ||
      lowerName === 'metadata' ||
      lowerName.endsWith('.manifest') ||
      lowerName.endsWith('.metadata') ||
      lowerName === 'success'
    );
  }

  private parseS3Uri(s3Uri: string): { bucket: string; key: string } {
    if (!s3Uri.startsWith('s3://')) {
      throw new InternalServerErrorException(`Invalid S3 URI: ${s3Uri}`);
    }

    const withoutScheme = s3Uri.slice(5);
    const firstSlash = withoutScheme.indexOf('/');
    if (firstSlash <= 0 || firstSlash === withoutScheme.length - 1) {
      throw new InternalServerErrorException(`Invalid S3 URI: ${s3Uri}`);
    }

    return {
      bucket: withoutScheme.slice(0, firstSlash),
      key: withoutScheme.slice(firstSlash + 1),
    };
  }

  private buildFriendlyFileName(
    jobId: string,
    job: ExportJob,
    index: number,
    totalParts: number
  ): string {
    const extension = this.getDownloadFileExtension(job, totalParts);
    if (totalParts <= 1) {
      return `export_${jobId}.${extension}`;
    }

    const paddedIndex = String(index + 1).padStart(3, '0');
    return `export_${jobId}_part_${paddedIndex}.${extension}`;
  }

  private async createSignedDownloadUrl(
    bucket: string,
    key: string,
    downloadFileName: string,
    format: ExportFormat,
    singleFile: boolean = false
  ): Promise<string> {
    const safeFileName = downloadFileName.replace(/["\\]/g, '_');
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeFileName}"`,
      ResponseContentType: this.getContentType(format, singleFile),
    });

    // Double assertion needed: CI gets duplicate @smithy/types from different AWS packages, so
    // S3Client and GetObjectCommand are not assignable to presigner's expected types.
    return getSignedUrl(
      this.s3 as unknown as Parameters<typeof getSignedUrl>[0],
      getObjectCommand as unknown as Parameters<typeof getSignedUrl>[1],
      { expiresIn: 3600 }
    );
  }

  private requiresJsonSingleFileMerge(job: ExportJob) {
    return job.format === 'JSON' && job.singleFile && job.mode === 'UNLOAD';
  }

  private buildInitialPostProcessing(
    jobId: string,
    format: ExportFormat,
    mode: ExportMode,
    singleFile: boolean
  ): ExportPostProcessing {
    if (format === 'JSON' && singleFile && mode === 'UNLOAD') {
      return {
        type: 'JSONL_MERGE',
        state: 'PENDING',
        outputFileName: `export_${jobId}.jsonl`,
        s3Key: this.getMergedJsonlKey(jobId),
      };
    }

    return {
      type: 'NONE',
      state: 'NOT_REQUIRED',
    };
  }

  private getMergedJsonlKey(jobId: string) {
    return `exports/${jobId}/merged/export_${jobId}.jsonl`;
  }

  private buildJsonExportColumnExpression(columnName: string) {
    return `${columnName}`;
  }

  private buildCsvExportColumnExpression(columnName: string, glueType?: string) {
    return this.buildExportColumnExpression(columnName, glueType);
  }

  private async listAllObjects(bucket: string, prefix: string) {
    const objects: Array<{ Key?: string; Size?: number }> = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      objects.push(...(response.Contents ?? []));
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
  }

  private async listUnloadDataObjects(jobId: string) {
    const prefix = `exports/${jobId}/`;
    const mergedKey = this.getMergedJsonlKey(jobId);
    const objects = await this.listAllObjects(this.exportsBucket, prefix);

    return objects
      .filter((obj) => !this.isMetadataKey(obj.Key))
      .filter((obj) => obj.Key !== mergedKey)
      .filter((obj) => !obj.Key?.startsWith(`${prefix}merged/`))
      .sort((a, b) => (a.Key || '').localeCompare(b.Key || ''));
  }

  private async writeChunk(target: PassThrough, chunk: Buffer | Uint8Array | string) {
    const buffer =
      typeof chunk === 'string'
        ? Buffer.from(chunk)
        : Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk);

    if (!target.write(buffer)) {
      await once(target, 'drain');
    }

    return buffer;
  }

  private async pipeReadableToTarget(body: Readable, target: PassThrough) {
    let bytesWritten = 0;
    let endedWithNewline = false;

    for await (const chunk of body) {
      const buffer = await this.writeChunk(target, chunk as Buffer | Uint8Array | string);
      bytesWritten += buffer.length;
      endedWithNewline = buffer.length > 0 && buffer[buffer.length - 1] === 0x0a;
    }

    return {
      bytesWritten,
      endedWithNewline,
    };
  }

  private async mergeUnloadJsonPartsToJsonl(jobId: string, job: ExportJob) {
    const targetKey = this.getMergedJsonlKey(jobId);
    const outputFileName = this.buildFriendlyFileName(jobId, job, 0, 1);
    const dataObjects = await this.listUnloadDataObjects(jobId);

    const outputStream = new PassThrough();
    const uploadPromise = this.s3.send(
      new PutObjectCommand({
        Bucket: this.exportsBucket,
        Key: targetKey,
        Body: outputStream,
        ContentType: this.getContentType(job.format, true),
      })
    );

    try {
      for (const obj of dataObjects) {
        const key = obj.Key;
        if (!key) continue;

        const response = await this.s3.send(
          new GetObjectCommand({
            Bucket: this.exportsBucket,
            Key: key,
          })
        );

        const body = response.Body as Readable | undefined;
        if (!body) {
          continue;
        }

        const { bytesWritten, endedWithNewline } = await this.pipeReadableToTarget(
          body,
          outputStream
        );
        if (bytesWritten > 0 && !endedWithNewline) {
          await this.writeChunk(outputStream, '\n');
        }
      }

      outputStream.end();
      await uploadPromise;

      job.postProcessing = {
        type: 'JSONL_MERGE',
        state: 'SUCCEEDED',
        outputFileName,
        s3Key: targetKey,
      };
    } catch (error: any) {
      outputStream.destroy(error);
      await uploadPromise.catch(() => undefined);
      await this.s3
        .send(
          new DeleteObjectCommand({
            Bucket: this.exportsBucket,
            Key: targetKey,
          })
        )
        .catch(() => undefined);

      job.postProcessing = {
        type: 'JSONL_MERGE',
        state: 'FAILED',
        outputFileName,
        s3Key: targetKey,
        error: error?.message || 'Failed to merge JSON files into NDJSON',
      };

      throw error;
    }
  }

  private ensureJsonSingleFileMerge(jobId: string, job: ExportJob) {
    if (!this.requiresJsonSingleFileMerge(job)) {
      return;
    }

    if (
      job.postProcessing.state === 'SUCCEEDED' ||
      job.postProcessing.state === 'RUNNING' ||
      job.postProcessing.state === 'FAILED'
    ) {
      return;
    }

    job.postProcessing = {
      ...job.postProcessing,
      type: 'JSONL_MERGE',
      state: 'RUNNING',
      outputFileName: this.buildFriendlyFileName(jobId, job, 0, 1),
      s3Key: this.getMergedJsonlKey(jobId),
      error: undefined,
    };

    job.postProcessingPromise = this.mergeUnloadJsonPartsToJsonl(jobId, job)
      .catch(() => undefined)
      .finally(() => {
        job.postProcessingPromise = undefined;
      });
  }

  async createExport(createExportDto: CreateExportDto) {
    const jobId = randomUUID();
    const { collarImeis, columns, format, singleFile = false } = createExportDto;
    const glueColumnTypes = columns.length > 0 ? await this.getGlueColumnTypes() : {};
    const { fromTimestamp, toTimestamp, partitionFromDate, partitionToDate } =
      this.resolveTimestampRange(createExportDto);
    const partitions = this.buildPartitions(partitionFromDate, partitionToDate);
    const columnList = columns.length > 0 ? columns.join(', ') : '*';
    const shouldUseSingleFileQuery = format === 'CSV' && singleFile;

    const imeiFilter = collarImeis.length > 0 ? `AND imei IN (${collarImeis.join(', ')})` : '';

    const timestampFilter = `AND timestamp >= ${fromTimestamp} AND timestamp <= ${toTimestamp}`;

    const partitionFilter = partitions.join(' OR ');
    const unloadS3Path = `s3://${this.exportsBucket}/exports/${jobId}/`;

    const selectedColumnsExpression =
      columns.length > 0
        ? format === 'JSON'
          ? columns.map((col) => this.buildJsonExportColumnExpression(col)).join(', ')
          : columns
              .map((col) => this.buildCsvExportColumnExpression(col, glueColumnTypes[col]))
              .join(', ')
        : columnList;

    let query: string;
    let mode: ExportMode;

    const orderByClause = 'ORDER BY timestamp ASC';

    if (shouldUseSingleFileQuery) {
      mode = 'QUERY_RESULTS';
      query = `SELECT ${columns.length > 0 ? selectedColumnsExpression : columnList}
FROM ${this.databaseName}.${this.tableName}
WHERE (${partitionFilter})
  ${imeiFilter}
  ${timestampFilter}
  ${orderByClause}`;
    } else {
      mode = 'UNLOAD';
      const withClause =
        format === 'JSON'
          ? `format = 'JSON', compression = 'NONE'`
          : `format = 'TEXTFILE', field_delimiter = ';', compression = 'NONE'`;

      query = `UNLOAD (
  SELECT ${columns.length > 0 ? selectedColumnsExpression : columnList}
  FROM ${this.databaseName}.${this.tableName}
  WHERE (${partitionFilter})
    ${imeiFilter}
    ${timestampFilter}
  ${orderByClause}
)
TO '${unloadS3Path}'
WITH (
  ${withClause}
)`;
    }

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

      const createdAt = new Date();
      this.jobStore.set(jobId, {
        queryExecutionId,
        createdAt,
        columns: columns.length > 0 ? columns : [],
        format,
        mode,
        singleFile,
        postProcessing: this.buildInitialPostProcessing(jobId, format, mode, singleFile),
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

      const athenaState = queryExecution.Status?.State as QueryExecutionState;
      let stateString = athenaState ? String(athenaState) : 'UNKNOWN';
      let error = queryExecution.Status?.StateChangeReason;
      let s3Path =
        athenaState === QueryExecutionState.SUCCEEDED
          ? job.mode === 'UNLOAD'
            ? `s3://${this.exportsBucket}/exports/${jobId}/`
            : queryExecution.ResultConfiguration?.OutputLocation
          : undefined;

      let dataScannedBytes = queryExecution.Statistics?.DataScannedInBytes || 0;
      let isEstimated = false;

      if (
        dataScannedBytes === 0 &&
        athenaState === QueryExecutionState.SUCCEEDED &&
        job.mode === 'UNLOAD'
      ) {
        try {
          const totalFileSize = (await this.listUnloadDataObjects(jobId)).reduce(
            (sum, obj) => sum + (obj.Size || 0),
            0
          );

          if (totalFileSize > 0) {
            dataScannedBytes = totalFileSize;
            isEstimated = true;
          }
        } catch (error) {
          // Ignore error, keep dataScannedBytes at 0
        }
      }

      const cost = dataScannedBytes > 0 ? this.calculateCost(dataScannedBytes, isEstimated) : null;

      if (athenaState === QueryExecutionState.SUCCEEDED && this.requiresJsonSingleFileMerge(job)) {
        this.ensureJsonSingleFileMerge(jobId, job);

        if (job.postProcessing.state === 'RUNNING' || job.postProcessing.state === 'PENDING') {
          stateString = 'RUNNING';
          error = undefined;
          s3Path = undefined;
        } else if (job.postProcessing.state === 'FAILED') {
          stateString = 'FAILED';
          error = job.postProcessing.error || 'Failed to prepare single NDJSON file';
          s3Path = undefined;
        } else if (job.postProcessing.state === 'SUCCEEDED') {
          stateString = 'SUCCEEDED';
          s3Path = job.postProcessing.s3Key
            ? `s3://${this.exportsBucket}/${job.postProcessing.s3Key}`
            : s3Path;
        }
      }

      return {
        state: stateString,
        mode: job.mode,
        format: job.format,
        singleFile: job.singleFile,
        columns: job.columns,
        s3Path,
        error,
        postProcessing: job.postProcessing,
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
      throw new InternalServerErrorException(
        `Export job ${jobId} is not completed. Current state: ${status.state}`
      );
    }

    try {
      if (this.requiresJsonSingleFileMerge(job)) {
        if (job.postProcessing.state !== 'SUCCEEDED' || !job.postProcessing.s3Key) {
          throw new InternalServerErrorException(
            `Export job ${jobId} is still preparing the single NDJSON file`
          );
        }

        const headResponse = await this.s3.send(
          new HeadObjectCommand({
            Bucket: this.exportsBucket,
            Key: job.postProcessing.s3Key,
          })
        );

        const friendlyName =
          job.postProcessing.outputFileName || this.buildFriendlyFileName(jobId, job, 0, 1);
        const downloadUrl = await this.createSignedDownloadUrl(
          this.exportsBucket,
          job.postProcessing.s3Key,
          friendlyName,
          job.format,
          true
        );

        return [
          {
            name: friendlyName,
            size: headResponse.ContentLength || 0,
            downloadUrl,
          },
        ];
      }

      if (job.mode === 'QUERY_RESULTS') {
        const getQueryCommand = new GetQueryExecutionCommand({
          QueryExecutionId: job.queryExecutionId,
        });
        const queryResponse = await this.athena.send(getQueryCommand);
        const outputLocation = queryResponse.QueryExecution?.ResultConfiguration?.OutputLocation;
        if (!outputLocation) {
          throw new InternalServerErrorException(
            `No output location found for export job ${jobId}`
          );
        }

        const { bucket, key } = this.parseS3Uri(outputLocation);
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: key,
        });
        const listResponse = await this.s3.send(listCommand);
        const outputObject = (listResponse.Contents || []).find((obj) => obj.Key === key);

        const friendlyName = this.buildFriendlyFileName(jobId, job, 0, 1);
        const downloadUrl = await this.createSignedDownloadUrl(
          bucket,
          key,
          friendlyName,
          job.format,
          job.singleFile
        );

        return [
          {
            name: friendlyName,
            size: outputObject?.Size || 0,
            downloadUrl,
          },
        ];
      }

      const dataObjects = await this.listUnloadDataObjects(jobId);

      const files = await Promise.all(
        dataObjects.map(async (obj, index) => {
          const key = obj.Key as string;
          const friendlyName = this.buildFriendlyFileName(jobId, job, index, dataObjects.length);
          const downloadUrl = await this.createSignedDownloadUrl(
            this.exportsBucket,
            key,
            friendlyName,
            job.format,
            false
          );

          return {
            name: friendlyName,
            size: obj.Size || 0,
            downloadUrl,
          };
        })
      );

      return files;
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to list export files: ${error.message}`);
    }
  }

  async refreshDownloadUrls(jobId: string) {
    return this.getExportFiles(jobId);
  }
}

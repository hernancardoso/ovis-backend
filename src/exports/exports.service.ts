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
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { CreateExportDto } from './dto/create-export.dto';
import moment from 'moment';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { User as IUser } from 'src/commons/interfaces/user.interface';
import { request as httpsRequest } from 'https';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Hash } from '@smithy/hash-node';
import type { AwsCredentialIdentity } from '@aws-sdk/types';

type ExportState = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'QUEUED' | 'CANCELLED' | 'UNKNOWN';
type PostProcessingState = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

type ExportPostProcessing = {
  type: 'JSONL_MERGE';
  state: PostProcessingState;
  outputFileName?: string;
  s3Key?: string;
  error?: string;
};

type ExportCollarSnapshot = {
  id: string;
  imei: number;
  name: string;
};

type ExportStatistics = {
  dataScannedBytes: number;
  executionTimeMs?: number;
  engineExecutionTimeMs?: number;
};

type ExportCostSummary = {
  estimatedCostUsd: number;
};

type ExportJobRecord = {
  jobId: string;
  queryExecutionId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  requestedBy?: Pick<IUser, 'name' | 'email' | 'isAdmin'>;
  collarImeis: number[];
  selectedCollars: ExportCollarSnapshot[];
  fromTimestamp: number;
  toTimestamp: number;
  columns: string[];
  status: ExportState;
  athenaState?: string;
  s3Path?: string;
  exportsBucket: string;
  error?: string;
  postProcessing: ExportPostProcessing;
  statistics?: ExportStatistics;
  fileLastModifiedAt?: string;
  fileSizeBytes?: number;
  ttl?: number;
};

type ExportJob = ExportJobRecord;

@Injectable()
export class ExportsService {
  private readonly athena: AthenaClient;
  private readonly s3: S3Client;
  private readonly dynamodb: DynamoDBDocumentClient;
  private readonly awsCredentials: AwsCredentialIdentity;
  private readonly databaseName = 'iot_raw';
  private readonly tableName = 'collar_messages';
  private readonly awsRegion = process.env.AWS_REGION || 'us-east-1';
  private readonly exportsBucket = process.env.AWS_EXPORTS_BUCKET || 'iot-exports-prod';
  private readonly athenaWorkGroup = process.env.AWS_ATHENA_WORKGROUP || 'primary';
  private readonly athenaOutputLocation =
    process.env.AWS_ATHENA_OUTPUT_LOCATION || `s3://${this.exportsBucket}/athena-results/`;
  private readonly exportJobsTable = process.env.AWS_EXPORT_JOBS_TABLE || '';
  private readonly exportMergeLambdaFunction =
    process.env.AWS_EXPORT_MERGE_LAMBDA_FUNCTION || '';
  private readonly exportHistoryRetentionDays = Number.parseInt(
    process.env.AWS_EXPORT_HISTORY_RETENTION_DAYS || '30',
    10
  );
  private readonly jobStore = new Map<string, ExportJob>();

  constructor(
    @InjectRepository(CollarEntity)
    private readonly collarRepository: Repository<CollarEntity>
  ) {
    this.awsCredentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
    };

    const awsConfig = {
      region: this.awsRegion,
      credentials: this.awsCredentials,
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
    };

    this.athena = new AthenaClient(awsConfig);
    this.s3 = new S3Client(awsConfig);
    this.dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient(awsConfig), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private nowIso() {
    return new Date().toISOString();
  }

  private isPersistentStoreEnabled() {
    return this.exportJobsTable.length > 0;
  }

  private buildJobTtl(createdAtIso: string) {
    const retentionDays = Number.isFinite(this.exportHistoryRetentionDays)
      ? this.exportHistoryRetentionDays
      : 30;
    return moment.utc(createdAtIso).add(retentionDays, 'days').unix();
  }

  private cloneJobForStorage(job: ExportJob): ExportJobRecord {
    return job;
  }

  private cacheJob(job: ExportJob) {
    this.jobStore.set(job.jobId, job);
    return job;
  }

  private async saveJob(job: ExportJob) {
    this.cacheJob(job);

    if (!this.isPersistentStoreEnabled()) {
      return;
    }

    await this.dynamodb.send(
      new PutCommand({
        TableName: this.exportJobsTable,
        Item: this.cloneJobForStorage(job),
      })
    );
  }

  private async loadPersistedJob(jobId: string): Promise<ExportJob | null> {
    if (!this.isPersistentStoreEnabled()) {
      return null;
    }

    const response = await this.dynamodb.send(
      new GetCommand({
        TableName: this.exportJobsTable,
        Key: { jobId },
      })
    );

    if (!response.Item) {
      return null;
    }

    const persistedJob = response.Item as ExportJobRecord;
    return this.cacheJob(persistedJob);
  }

  private async getJob(jobId: string) {
    const persistedJob = await this.loadPersistedJob(jobId);
    if (persistedJob) {
      return persistedJob;
    }

    const cachedJob = this.jobStore.get(jobId);
    if (cachedJob) {
      return cachedJob;
    }

    throw new NotFoundException(`Export job ${jobId} not found`);
  }

  private async listJobsFromStore() {
    if (!this.isPersistentStoreEnabled()) {
      return Array.from(this.jobStore.values());
    }

    const items: ExportJob[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const response = await this.dynamodb.send(
        new ScanCommand({
          TableName: this.exportJobsTable,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );

      items.push(...(response.Items || []).map((item) => this.cacheJob(item as ExportJob)));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private isTerminalState(state?: ExportState) {
    return state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED';
  }

  private buildExportCostSummary(statistics?: ExportStatistics): ExportCostSummary {
    const dataScannedBytes = statistics?.dataScannedBytes || 0;
    const dataScannedTb = dataScannedBytes / (1024 ** 4);
    const estimatedCostUsd = Number((dataScannedTb * 5).toFixed(6));

    return {
      estimatedCostUsd,
    };
  }

  private ensureJsonlPipelineConfigured() {
    if (!this.isPersistentStoreEnabled()) {
      throw new InternalServerErrorException(
        'Export jobs table is not configured. Set AWS_EXPORT_JOBS_TABLE before creating exports.'
      );
    }

    if (!this.exportMergeLambdaFunction) {
      throw new InternalServerErrorException(
        'Export merge lambda is not configured. Set AWS_EXPORT_MERGE_LAMBDA_FUNCTION before creating exports.'
      );
    }
  }

  private async getSelectedCollars(collarImeis: number[]) {
    if (collarImeis.length === 0) {
      return [];
    }

    const collars = await this.collarRepository.find({
      where: {
        imei: In(collarImeis),
      },
      select: {
        id: true,
        imei: true,
        name: true,
      },
    });

    const byImei = new Map(collars.map((collar) => [collar.imei, collar]));
    return collarImeis
      .map((imei) => {
        const collar = byImei.get(imei);
        if (!collar) {
          return null;
        }

        return {
          id: collar.id,
          imei: collar.imei,
          name: collar.name,
        } satisfies ExportCollarSnapshot;
      })
      .filter((collar): collar is ExportCollarSnapshot => collar !== null);
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

  private getContentType() {
    return 'application/x-ndjson; charset=utf-8';
  }

  private buildFriendlyFileName(jobId: string) {
    return `export_${jobId}.jsonl`;
  }

  private async createSignedDownloadUrl(
    bucket: string,
    key: string,
    downloadFileName: string
  ): Promise<string> {
    const safeFileName = downloadFileName.replace(/["\\]/g, '_');
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeFileName}"`,
      ResponseContentType: this.getContentType(),
    });

    // Double assertion needed: CI gets duplicate @smithy/types from different AWS packages, so
    // S3Client and GetObjectCommand are not assignable to presigner's expected types.
    return getSignedUrl(
      this.s3 as unknown as Parameters<typeof getSignedUrl>[0],
      getObjectCommand as unknown as Parameters<typeof getSignedUrl>[1],
      { expiresIn: 3600 }
    );
  }

  private async invokeMergeLambda(jobId: string) {
    if (!this.exportMergeLambdaFunction) {
      return false;
    }

    const body = JSON.stringify({ jobId });
    const hostname = `lambda.${this.awsRegion}.amazonaws.com`;
    const request = new HttpRequest({
      protocol: 'https:',
      hostname,
      method: 'POST',
      path: `/2015-03-31/functions/${encodeURIComponent(this.exportMergeLambdaFunction)}/invocations`,
      headers: {
        host: hostname,
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
        'x-amz-invocation-type': 'Event',
      },
      body,
    });

    const signer = new SignatureV4({
      credentials: this.awsCredentials,
      region: this.awsRegion,
      service: 'lambda',
      sha256: Hash.bind(null, 'sha256'),
    });

    const signedRequest = await signer.sign(request);

    await new Promise<void>((resolve, reject) => {
      const req = httpsRequest(
        {
          protocol: 'https:',
          hostname,
          method: 'POST',
          path: signedRequest.path,
          headers: signedRequest.headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf-8');
            if ((res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300) {
              resolve();
              return;
            }

            reject(
              new Error(
                `Lambda invoke failed with status ${res.statusCode}: ${responseBody || 'empty body'}`
              )
            );
          });
        }
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });

    return true;
  }

  private async captureFileMetadata(job: ExportJob, bucket: string, key: string) {
    const response = await this.s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    job.fileLastModifiedAt = response.LastModified?.toISOString();
    job.fileSizeBytes = response.ContentLength;
    job.completedAt = job.completedAt || response.LastModified?.toISOString() || this.nowIso();
  }

  private async buildDownloadFile(job: ExportJob) {
    if (
      job.status !== 'SUCCEEDED' ||
      job.postProcessing.state !== 'SUCCEEDED' ||
      !job.postProcessing.s3Key
    ) {
      return null;
    }

    const bucket = job.exportsBucket;
    const key = job.postProcessing.s3Key;

    if (!job.fileLastModifiedAt || typeof job.fileSizeBytes !== 'number') {
      await this.captureFileMetadata(job, bucket, key);
      await this.saveJob(job);
    }

    const fileName = job.postProcessing.outputFileName || this.buildFriendlyFileName(job.jobId);

    return {
      name: fileName,
      size: job.fileSizeBytes || 0,
      downloadUrl: await this.createSignedDownloadUrl(bucket, key, fileName),
    };
  }

  private buildInitialPostProcessing(jobId: string): ExportPostProcessing {
    return {
      type: 'JSONL_MERGE',
      state: 'PENDING',
      outputFileName: this.buildFriendlyFileName(jobId),
      s3Key: this.getMergedJsonlKey(jobId),
    };
  }

  private getMergedJsonlKey(jobId: string) {
    return `exports/${jobId}/merged/export_${jobId}.jsonl`;
  }

  private async ensureJsonlMergeStarted(jobId: string, job: ExportJob) {
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
      outputFileName: this.buildFriendlyFileName(jobId),
      s3Key: this.getMergedJsonlKey(jobId),
      error: undefined,
    };
    job.status = 'RUNNING';
    job.error = undefined;
    await this.saveJob(job);

    try {
      await this.invokeMergeLambda(jobId);
    } catch (error: any) {
      job.postProcessing = {
        ...job.postProcessing,
        state: 'FAILED',
        error: error?.message || 'Failed to invoke export merge lambda',
      };
      job.status = 'FAILED';
      job.error = job.postProcessing.error;
      await this.saveJob(job);
    }
  }

  private async refreshJobState(job: ExportJob) {
    const getQueryCommand = new GetQueryExecutionCommand({
      QueryExecutionId: job.queryExecutionId,
    });

    const response = await this.athena.send(getQueryCommand);
    const queryExecution = response.QueryExecution;

    if (!queryExecution) {
      throw new NotFoundException(`Query execution not found for job ${job.jobId}`);
    }

    const athenaState = queryExecution.Status?.State as QueryExecutionState;
    let stateString: ExportState = athenaState ? (String(athenaState) as ExportState) : 'UNKNOWN';
    let error = queryExecution.Status?.StateChangeReason;
    let s3Path =
      athenaState === QueryExecutionState.SUCCEEDED
        ? `s3://${this.exportsBucket}/exports/${job.jobId}/`
        : undefined;

    const dataScannedBytes = queryExecution.Statistics?.DataScannedInBytes || 0;

    if (athenaState === QueryExecutionState.SUCCEEDED) {
      await this.ensureJsonlMergeStarted(job.jobId, job);

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

    job.status = stateString;
    job.athenaState = athenaState ? String(athenaState) : 'UNKNOWN';
    job.s3Path = s3Path;
    job.error = error;
    job.statistics = {
      dataScannedBytes,
      executionTimeMs: queryExecution.Statistics?.TotalExecutionTimeInMillis,
      engineExecutionTimeMs: queryExecution.Statistics?.EngineExecutionTimeInMillis,
    };
    job.updatedAt = this.nowIso();
    if (stateString === 'SUCCEEDED') {
      job.completedAt = job.completedAt || this.nowIso();
    }

    await this.saveJob(job);
    return job;
  }

  async listExportHistory() {
    const jobs = (await this.listJobsFromStore()).slice(0, 50);

    const hydratedJobs = await Promise.all(
      jobs.map(async (job) => {
        if (this.isTerminalState(job.status)) {
          return job;
        }

        try {
          return await this.refreshJobState(job);
        } catch (error: any) {
          job.error = job.error || error?.message || 'Failed to refresh export state';
          job.updatedAt = this.nowIso();
          return job;
        }
      })
    );

    return Promise.all(
      hydratedJobs.map(async (job) => {
        let downloadFile: Awaited<ReturnType<typeof this.buildDownloadFile>> = null;

        try {
          downloadFile = await this.buildDownloadFile(job);
        } catch {
          downloadFile = null;
        }

        return {
          jobId: job.jobId,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt,
          requestedBy: job.requestedBy,
          collarImeis: job.collarImeis,
          selectedCollars: job.selectedCollars,
          fromTimestamp: job.fromTimestamp,
          toTimestamp: job.toTimestamp,
          columns: job.columns,
          state: job.status,
          athenaState: job.athenaState,
          error: job.error,
          s3Path: job.s3Path,
          postProcessing: job.postProcessing,
          fileLastModifiedAt: job.fileLastModifiedAt,
          fileSizeBytes: job.fileSizeBytes,
          cost: this.buildExportCostSummary(job.statistics),
          downloadFile,
        };
      })
    );
  }

  async createExport(createExportDto: CreateExportDto, user?: IUser) {
    this.ensureJsonlPipelineConfigured();

    const jobId = randomUUID();
    const { collarImeis, columns } = createExportDto;
    const selectedCollars = await this.getSelectedCollars(collarImeis);
    const { fromTimestamp, toTimestamp, partitionFromDate, partitionToDate } =
      this.resolveTimestampRange(createExportDto);
    const partitions = this.buildPartitions(partitionFromDate, partitionToDate);
    const columnList = columns.length > 0 ? columns.join(', ') : '*';

    const imeiFilter = collarImeis.length > 0 ? `AND imei IN (${collarImeis.join(', ')})` : '';

    const timestampFilter = `AND timestamp >= ${fromTimestamp} AND timestamp <= ${toTimestamp}`;

    const partitionFilter = partitions.join(' OR ');
    const unloadS3Path = `s3://${this.exportsBucket}/exports/${jobId}/`;

    const orderByClause = 'ORDER BY timestamp ASC';
    const query = `UNLOAD (
  SELECT ${columnList}
  FROM ${this.databaseName}.${this.tableName}
  WHERE (${partitionFilter})
    ${imeiFilter}
    ${timestampFilter}
  ${orderByClause}
)
TO '${unloadS3Path}'
WITH (
  format = 'JSON',
  compression = 'NONE'
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

      const createdAt = this.nowIso();
      await this.saveJob({
        jobId,
        queryExecutionId,
        createdAt,
        updatedAt: createdAt,
        requestedBy: user
          ? {
              name: user.name,
              email: user.email,
              isAdmin: user.isAdmin,
            }
          : undefined,
        collarImeis,
        selectedCollars,
        fromTimestamp,
        toTimestamp,
        columns: columns.length > 0 ? columns : [],
        status: 'QUEUED',
        athenaState: 'QUEUED',
        exportsBucket: this.exportsBucket,
        postProcessing: this.buildInitialPostProcessing(jobId),
        ttl: this.buildJobTtl(createdAt),
      });

      return { jobId };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to create export: ${error.message}`);
    }
  }

  async getExportStatus(jobId: string) {
    const job = await this.getJob(jobId);

    try {
      const refreshedJob = await this.refreshJobState(job);

      return {
        state: refreshedJob.status,
        columns: refreshedJob.columns,
        s3Path: refreshedJob.s3Path,
        error: refreshedJob.error,
        postProcessing: refreshedJob.postProcessing,
        statistics: refreshedJob.statistics,
        cost: this.buildExportCostSummary(refreshedJob.statistics),
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to get export status: ${error.message}`);
    }
  }

  async getExportFiles(jobId: string) {
    const status = await this.getExportStatus(jobId);
    if (status.state !== 'SUCCEEDED') {
      throw new InternalServerErrorException(
        `Export job ${jobId} is not completed. Current state: ${status.state}`
      );
    }

    try {
      const job = await this.getJob(jobId);

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

      const friendlyName = job.postProcessing.outputFileName || this.buildFriendlyFileName(jobId);
      await this.captureFileMetadata(job, this.exportsBucket, job.postProcessing.s3Key);
      await this.saveJob(job);
      const downloadUrl = await this.createSignedDownloadUrl(
        this.exportsBucket,
        job.postProcessing.s3Key,
        friendlyName
      );

      return [
        {
          name: friendlyName,
          size: headResponse.ContentLength || 0,
          downloadUrl,
        },
      ];
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to list export files: ${error.message}`);
    }
  }

  async refreshDownloadUrls(jobId: string) {
    return this.getExportFiles(jobId);
  }
}

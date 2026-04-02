import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AthenaClient,
  GetQueryExecutionCommand,
  QueryExecutionState,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { request as httpsRequest } from 'https';
import moment from 'moment';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Hash } from '@smithy/hash-node';
import type { AwsCredentialIdentity } from '@aws-sdk/types';
import { User as IUser } from 'src/commons/interfaces/user.interface';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import {
  SheepAssociationInterval,
  SheepCollarService,
} from 'src/sheep-collar/sheep-collar.service';
import { CreateExportBySheepDto } from './dto/create-export-by-sheep.dto';

type ExportState = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'QUEUED' | 'CANCELLED' | 'UNKNOWN';
type PostProcessingState = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

type ExportPostProcessing = {
  type: 'JSONL_MERGE';
  state: PostProcessingState;
  outputFileName?: string;
  s3Key?: string;
  error?: string;
};

type ExportStatistics = {
  dataScannedBytes: number;
  executionTimeMs?: number;
  engineExecutionTimeMs?: number;
};

type ExportCostSummary = {
  estimatedCostUsd: number;
};

type SheepExportSelection = {
  id: string;
  name: string;
};

type SelectedSheepRecord = {
  id: string;
  name: string;
};

type SheepExportAssociation = {
  collarId: string;
  collarImei: number;
  fromTimestamp: number;
  toTimestamp: number | null;
};

type SheepExportChildRecord = {
  jobId: string;
  jobType: 'SHEEP_EXPORT_CHILD';
  parentJobId: string;
  sheepId: string;
  sheepName: string;
  outputFileName: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  queryExecutionId?: string;
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
  associations: SheepExportAssociation[];
  ttl?: number;
};

type SheepExportBatchChild = {
  jobId: string;
  sheepId: string;
  sheepName: string;
  outputFileName: string;
};

type SheepExportBatchRecord = {
  jobId: string;
  jobType: 'SHEEP_EXPORT_BATCH';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  requestedBy?: Pick<IUser, 'name' | 'email' | 'isAdmin'>;
  sheepIds: string[];
  selectedSheep: SheepExportSelection[];
  fromTimestamp: number;
  toTimestamp: number;
  columns: string[];
  status: ExportState;
  error?: string;
  exportsBucket: string;
  postProcessing?: ExportPostProcessing;
  statistics?: ExportStatistics;
  children: SheepExportBatchChild[];
  ttl?: number;
};

type SheepExportRecord = SheepExportBatchRecord | SheepExportChildRecord;

type ExportFile = {
  name: string;
  size: number;
  downloadUrl: string;
};

@Injectable()
export class ExportBySheepService {
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
  private readonly exportMergeLambdaFunction = process.env.AWS_EXPORT_MERGE_LAMBDA_FUNCTION || '';
  private readonly exportHistoryRetentionDays = Number.parseInt(
    process.env.AWS_EXPORT_HISTORY_RETENTION_DAYS || '30',
    10
  );
  private readonly jobStore = new Map<string, SheepExportRecord>();

  constructor(
    @InjectRepository(SheepEntity)
    private readonly sheepRepository: Repository<SheepEntity>,
    @InjectRepository(CollarEntity)
    private readonly collarRepository: Repository<CollarEntity>,
    private readonly sheepCollarService: SheepCollarService
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

  private ensureJsonlPipelineConfigured() {
    if (!this.isPersistentStoreEnabled()) {
      throw new InternalServerErrorException(
        'Export jobs table is not configured. Set AWS_EXPORT_JOBS_TABLE before creating sheep exports.'
      );
    }

    if (!this.exportMergeLambdaFunction) {
      throw new InternalServerErrorException(
        'Export merge lambda is not configured. Set AWS_EXPORT_MERGE_LAMBDA_FUNCTION before creating sheep exports.'
      );
    }
  }

  private buildJobTtl(createdAtIso: string) {
    const retentionDays = Number.isFinite(this.exportHistoryRetentionDays)
      ? this.exportHistoryRetentionDays
      : 30;
    return moment.utc(createdAtIso).add(retentionDays, 'days').unix();
  }

  private cacheJob<T extends SheepExportRecord>(job: T) {
    this.jobStore.set(job.jobId, job);
    return job;
  }

  private async saveJob<T extends SheepExportRecord>(job: T) {
    this.cacheJob(job);

    if (!this.isPersistentStoreEnabled()) {
      return;
    }

    await this.dynamodb.send(
      new PutCommand({
        TableName: this.exportJobsTable,
        Item: job,
      })
    );
  }

  private async loadPersistedJob(jobId: string): Promise<SheepExportRecord | null> {
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

    return this.cacheJob(response.Item as SheepExportRecord);
  }

  private async getJob<T extends SheepExportRecord>(jobId: string): Promise<T> {
    const persistedJob = await this.loadPersistedJob(jobId);
    if (persistedJob) {
      return persistedJob as T;
    }

    const cachedJob = this.jobStore.get(jobId);
    if (cachedJob) {
      return cachedJob as T;
    }

    throw new NotFoundException(`Export job ${jobId} not found`);
  }

  private async listJobsFromStore() {
    if (!this.isPersistentStoreEnabled()) {
      return Array.from(this.jobStore.values());
    }

    const items: SheepExportRecord[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const response = await this.dynamodb.send(
        new ScanCommand({
          TableName: this.exportJobsTable,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );

      items.push(...(response.Items || []).map((item) => this.cacheJob(item as SheepExportRecord)));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }

  private isTerminalState(state?: ExportState) {
    return state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED';
  }

  private buildExportCostSummary(statistics?: ExportStatistics): ExportCostSummary {
    const dataScannedBytes = statistics?.dataScannedBytes || 0;
    const dataScannedTb = dataScannedBytes / 1024 ** 4;
    const estimatedCostUsd = Number((dataScannedTb * 5).toFixed(6));

    return {
      estimatedCostUsd,
    };
  }

  private resolveTimestampRange(createExportDto: CreateExportBySheepDto) {
    const { fromTimestamp, toTimestamp } = createExportDto;
    const hasValidFromTimestamp =
      typeof fromTimestamp === 'number' && Number.isFinite(fromTimestamp);
    const hasValidToTimestamp = typeof toTimestamp === 'number' && Number.isFinite(toTimestamp);

    if (!hasValidFromTimestamp || !hasValidToTimestamp || fromTimestamp > toTimestamp) {
      throw new BadRequestException('Invalid export range');
    }

    return {
      fromTimestamp,
      toTimestamp,
      partitionFromDate: moment.utc(fromTimestamp).startOf('day'),
      partitionToDate: moment.utc(toTimestamp).startOf('day'),
    };
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
        }

        return `day BETWEEN ${range.start} AND ${range.end}`;
      });

      const dayCondition = conditions.length === 1 ? conditions[0] : `(${conditions.join(' OR ')})`;
      partitions.push(`(year = ${year} AND month = ${month} AND ${dayCondition})`);
    });

    return partitions;
  }

  private buildInitialPostProcessing(jobId: string, outputFileName: string): ExportPostProcessing {
    return {
      type: 'JSONL_MERGE',
      state: 'PENDING',
      outputFileName,
      s3Key: this.getMergedJsonlKey(jobId),
    };
  }

  private getMergedJsonlKey(jobId: string) {
    return `exports/${jobId}/merged/export_${jobId}.jsonl`;
  }

  private getContentType() {
    return 'application/x-ndjson; charset=utf-8';
  }

  private sanitizeFileSegment(value: string) {
    const normalized = value
      .normalize('NFKD')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

    return normalized || 'sheep';
  }

  private buildChildOutputFileName(sheepName: string, sheepId: string) {
    const shortId = sheepId.replace(/-/g, '').slice(0, 8);
    return `${this.sanitizeFileSegment(sheepName)}_${shortId}.jsonl`;
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

    return getSignedUrl(
      this.s3 as unknown as Parameters<typeof getSignedUrl>[0],
      getObjectCommand as unknown as Parameters<typeof getSignedUrl>[1],
      { expiresIn: 3600 }
    );
  }

  private async invokeMergeLambda(jobId: string) {
    const body = JSON.stringify({ jobId });
    const hostname = `lambda.${this.awsRegion}.amazonaws.com`;
    const request = new HttpRequest({
      protocol: 'https:',
      hostname,
      method: 'POST',
      path: `/2015-03-31/functions/${encodeURIComponent(this.exportMergeLambdaFunction)}/invocations`,
      headers: {
        'host': hostname,
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
          res.on('data', (chunk) =>
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          );
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
  }

  private async captureFileMetadata(job: SheepExportChildRecord, bucket: string, key: string) {
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

  private async buildDownloadFile(job: SheepExportChildRecord): Promise<ExportFile | null> {
    if (
      job.status !== 'SUCCEEDED' ||
      job.postProcessing.state !== 'SUCCEEDED' ||
      !job.postProcessing.s3Key
    ) {
      return null;
    }

    if (!job.fileLastModifiedAt || typeof job.fileSizeBytes !== 'number') {
      await this.captureFileMetadata(job, job.exportsBucket, job.postProcessing.s3Key);
      await this.saveJob(job);
    }

    return {
      name: job.outputFileName,
      size: job.fileSizeBytes || 0,
      downloadUrl: await this.createSignedDownloadUrl(
        job.exportsBucket,
        job.postProcessing.s3Key,
        job.outputFileName
      ),
    };
  }

  private async ensureJsonlMergeStarted(job: SheepExportChildRecord) {
    if (
      job.postProcessing.state === 'SUCCEEDED' ||
      job.postProcessing.state === 'RUNNING' ||
      job.postProcessing.state === 'FAILED'
    ) {
      return;
    }

    job.postProcessing = {
      ...job.postProcessing,
      state: 'RUNNING',
      error: undefined,
    };
    job.status = 'RUNNING';
    job.error = undefined;
    await this.saveJob(job);

    try {
      await this.invokeMergeLambda(job.jobId);
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

  private async refreshChildState(job: SheepExportChildRecord) {
    if (!job.queryExecutionId) {
      return job;
    }

    const response = await this.athena.send(
      new GetQueryExecutionCommand({
        QueryExecutionId: job.queryExecutionId,
      })
    );

    const queryExecution = response.QueryExecution;
    if (!queryExecution) {
      throw new NotFoundException(`Query execution not found for child job ${job.jobId}`);
    }

    const athenaState = queryExecution.Status?.State as QueryExecutionState;
    let stateString: ExportState = athenaState ? (String(athenaState) as ExportState) : 'UNKNOWN';
    let error = queryExecution.Status?.StateChangeReason;
    let s3Path =
      athenaState === QueryExecutionState.SUCCEEDED
        ? `s3://${job.exportsBucket}/exports/${job.jobId}/`
        : undefined;

    const dataScannedBytes = queryExecution.Statistics?.DataScannedInBytes || 0;

    if (athenaState === QueryExecutionState.SUCCEEDED) {
      await this.ensureJsonlMergeStarted(job);

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
          ? `s3://${job.exportsBucket}/${job.postProcessing.s3Key}`
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

  private aggregatePostProcessing(
    children: SheepExportChildRecord[]
  ): ExportPostProcessing | undefined {
    if (children.length === 0) {
      return undefined;
    }

    if (children.some((child) => child.postProcessing.state === 'FAILED')) {
      return { type: 'JSONL_MERGE', state: 'FAILED' };
    }

    if (children.some((child) => child.postProcessing.state === 'RUNNING')) {
      return { type: 'JSONL_MERGE', state: 'RUNNING' };
    }

    if (children.some((child) => child.postProcessing.state === 'PENDING')) {
      return { type: 'JSONL_MERGE', state: 'PENDING' };
    }

    return { type: 'JSONL_MERGE', state: 'SUCCEEDED' };
  }

  private aggregateState(children: SheepExportChildRecord[]): ExportState {
    if (children.some((child) => child.status === 'FAILED')) {
      return 'FAILED';
    }

    if (children.every((child) => child.status === 'SUCCEEDED')) {
      return 'SUCCEEDED';
    }

    if (children.every((child) => child.status === 'QUEUED')) {
      return 'QUEUED';
    }

    return 'RUNNING';
  }

  private aggregateError(children: SheepExportChildRecord[]) {
    const failedChildren = children.filter((child) => child.status === 'FAILED');
    if (failedChildren.length === 0) {
      return undefined;
    }

    return failedChildren
      .slice(0, 3)
      .map((child) => `${child.sheepName}: ${child.error || 'Export failed'}`)
      .join(' | ');
  }

  private aggregateStatistics(children: SheepExportChildRecord[]): ExportStatistics {
    return {
      dataScannedBytes: children.reduce(
        (total, child) => total + (child.statistics?.dataScannedBytes || 0),
        0
      ),
      executionTimeMs: children.reduce(
        (total, child) => total + (child.statistics?.executionTimeMs || 0),
        0
      ),
      engineExecutionTimeMs: children.reduce(
        (total, child) => total + (child.statistics?.engineExecutionTimeMs || 0),
        0
      ),
    };
  }

  private async loadBatchChildren(batch: SheepExportBatchRecord) {
    return Promise.all(
      batch.children.map((childRef) => this.getJob<SheepExportChildRecord>(childRef.jobId))
    );
  }

  private async refreshBatchState(batch: SheepExportBatchRecord) {
    const children = await this.loadBatchChildren(batch);
    const refreshedChildren = await Promise.all(
      children.map(async (child) => {
        if (
          this.isTerminalState(child.status) &&
          this.isTerminalState(child.postProcessing.state as ExportState)
        ) {
          return child;
        }

        try {
          return await this.refreshChildState(child);
        } catch (error: any) {
          child.status = 'FAILED';
          child.error = child.error || error?.message || 'Failed to refresh sheep export state';
          child.postProcessing = {
            ...child.postProcessing,
            state: 'FAILED',
            error: child.error,
          };
          child.updatedAt = this.nowIso();
          await this.saveJob(child);
          return child;
        }
      })
    );

    batch.status = this.aggregateState(refreshedChildren);
    batch.error = this.aggregateError(refreshedChildren);
    batch.statistics = this.aggregateStatistics(refreshedChildren);
    batch.postProcessing = this.aggregatePostProcessing(refreshedChildren);
    batch.updatedAt = this.nowIso();

    if (batch.status === 'SUCCEEDED') {
      const completedAtValues = refreshedChildren
        .map((child) => child.completedAt)
        .filter((value): value is string => Boolean(value))
        .sort();
      batch.completedAt = completedAtValues[completedAtValues.length - 1] || this.nowIso();
    }

    await this.saveJob(batch);
    return { batch, children: refreshedChildren };
  }

  private buildWindowFilters(
    associations: SheepExportAssociation[],
    fromTimestamp: number,
    toTimestamp: number
  ) {
    return associations
      .map((association) => {
        const windowStart = Math.max(fromTimestamp, association.fromTimestamp);
        const toClause =
          association.toTimestamp === null
            ? ''
            : ` AND timestamp < ${Math.min(association.toTimestamp, toTimestamp + 1)}`;

        return `(imei = ${association.collarImei} AND timestamp >= ${windowStart}${toClause})`;
      })
      .join(' OR ');
  }

  private buildChildQuery({
    jobId,
    columns,
    partitions,
    associations,
    fromTimestamp,
    toTimestamp,
  }: {
    jobId: string;
    columns: string[];
    partitions: string[];
    associations: SheepExportAssociation[];
    fromTimestamp: number;
    toTimestamp: number;
  }) {
    const columnList = columns.length > 0 ? columns.join(', ') : '*';
    const partitionFilter = partitions.join(' OR ');
    const windowFilter = this.buildWindowFilters(associations, fromTimestamp, toTimestamp);
    const unloadS3Path = `s3://${this.exportsBucket}/exports/${jobId}/`;

    return `UNLOAD (
  SELECT ${columnList}
  FROM ${this.databaseName}.${this.tableName}
  WHERE (${partitionFilter})
    AND timestamp >= ${fromTimestamp}
    AND timestamp <= ${toTimestamp}
    AND (${windowFilter})
  ORDER BY timestamp ASC
)
TO '${unloadS3Path}'
WITH (
  format = 'JSON',
  compression = 'NONE'
)`;
  }

  private async getSelectedSheep(sheepIds: string[]) {
    const sheep = await this.sheepRepository.find({
      where: { id: In(sheepIds) },
      select: {
        id: true,
        name: true,
      },
    });

    const byId = new Map(sheep.map((item) => [item.id, item]));
    const ordered: SelectedSheepRecord[] = sheepIds
      .map((id) => byId.get(id))
      .filter((item): item is SheepEntity => Boolean(item))
      .map((item) => ({ id: item.id, name: item.name }));

    if (ordered.length !== sheepIds.length) {
      const foundIds = new Set(ordered.map((item) => item.id));
      const missingIds = sheepIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Sheep not found: ${missingIds.join(', ')}`);
    }

    return ordered;
  }

  private async resolveAssociationsBySheep(
    sheep: SelectedSheepRecord[],
    fromTimestamp: number,
    toTimestamp: number
  ) {
    const rawAssociations = await Promise.all(
      sheep.map(async (item) => ({
        sheepId: item.id,
        associations: await this.sheepCollarService.findAssociationsForSheepWithinInterval({
          sheepId: item.id,
          start: new Date(fromTimestamp),
          end: new Date(toTimestamp),
        }),
      }))
    );

    const collarIds = Array.from(
      new Set(
        rawAssociations.flatMap((item) =>
          item.associations.map((association) => association.collarId)
        )
      )
    );

    const collars = collarIds.length
      ? await this.collarRepository
          .createQueryBuilder('collar')
          .withDeleted()
          .where('collar.id IN (:...ids)', { ids: collarIds })
          .select(['collar.id', 'collar.imei'])
          .getMany()
      : [];

    const collarImeiById = new Map(collars.map((collar) => [collar.id, collar.imei]));

    return new Map(
      rawAssociations.map((item) => [
        item.sheepId,
        item.associations.map((association) =>
          this.mapAssociationToExportWindow(association, collarImeiById, fromTimestamp, toTimestamp)
        ),
      ])
    );
  }

  private mapAssociationToExportWindow(
    association: SheepAssociationInterval,
    collarImeiById: Map<string, number>,
    fromTimestamp: number,
    toTimestamp: number
  ): SheepExportAssociation {
    const collarImei = collarImeiById.get(association.collarId);
    if (typeof collarImei !== 'number') {
      throw new NotFoundException(`Collar IMEI not found for collar ${association.collarId}`);
    }

    const from = Math.max(fromTimestamp, association.from.getTime());
    const to = association.to ? Math.min(toTimestamp + 1, association.to.getTime()) : null;

    return {
      collarId: association.collarId,
      collarImei,
      fromTimestamp: from,
      toTimestamp: to,
    };
  }

  private async createEmptyChildExport(job: SheepExportChildRecord) {
    const outputKey = job.postProcessing.s3Key || this.getMergedJsonlKey(job.jobId);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.exportsBucket,
        Key: outputKey,
        Body: '',
        ContentType: this.getContentType(),
      })
    );

    job.status = 'SUCCEEDED';
    job.athenaState = 'NOT_REQUIRED';
    job.s3Path = `s3://${this.exportsBucket}/${outputKey}`;
    job.postProcessing = {
      ...job.postProcessing,
      state: 'SUCCEEDED',
      s3Key: outputKey,
    };

    await this.captureFileMetadata(job, this.exportsBucket, outputKey);
    job.updatedAt = this.nowIso();
    job.completedAt = job.completedAt || this.nowIso();
    await this.saveJob(job);
  }

  private async createFailedChildExport(
    batchJobId: string,
    sheepId: string,
    sheepName: string,
    fromTimestamp: number,
    toTimestamp: number,
    columns: string[],
    errorMessage: string
  ) {
    const createdAt = this.nowIso();
    const childJobId = randomUUID();
    const outputFileName = this.buildChildOutputFileName(sheepName, sheepId);

    const childJob: SheepExportChildRecord = {
      jobId: childJobId,
      jobType: 'SHEEP_EXPORT_CHILD',
      parentJobId: batchJobId,
      sheepId,
      sheepName,
      outputFileName,
      createdAt,
      updatedAt: createdAt,
      fromTimestamp,
      toTimestamp,
      columns,
      status: 'FAILED',
      exportsBucket: this.exportsBucket,
      error: errorMessage,
      postProcessing: {
        type: 'JSONL_MERGE',
        state: 'FAILED',
        outputFileName,
        s3Key: this.getMergedJsonlKey(childJobId),
        error: errorMessage,
      },
      statistics: { dataScannedBytes: 0 },
      associations: [],
      ttl: this.buildJobTtl(createdAt),
    };

    await this.saveJob(childJob);
    return childJob;
  }

  private async createChildExport(
    batchJobId: string,
    sheepId: string,
    sheepName: string,
    fromTimestamp: number,
    toTimestamp: number,
    columns: string[],
    partitions: string[],
    associations: SheepExportAssociation[]
  ) {
    const createdAt = this.nowIso();
    const childJobId = randomUUID();
    const outputFileName = this.buildChildOutputFileName(sheepName, sheepId);

    const childJob: SheepExportChildRecord = {
      jobId: childJobId,
      jobType: 'SHEEP_EXPORT_CHILD',
      parentJobId: batchJobId,
      sheepId,
      sheepName,
      outputFileName,
      createdAt,
      updatedAt: createdAt,
      fromTimestamp,
      toTimestamp,
      columns,
      status: 'QUEUED',
      athenaState: 'QUEUED',
      exportsBucket: this.exportsBucket,
      postProcessing: this.buildInitialPostProcessing(childJobId, outputFileName),
      statistics: { dataScannedBytes: 0 },
      associations,
      ttl: this.buildJobTtl(createdAt),
    };

    if (associations.length === 0) {
      await this.saveJob(childJob);
      await this.createEmptyChildExport(childJob);
      return childJob;
    }

    const query = this.buildChildQuery({
      jobId: childJobId,
      columns,
      partitions,
      associations,
      fromTimestamp,
      toTimestamp,
    });

    const response = await this.athena.send(
      new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: {
          Database: this.databaseName,
        },
        ResultConfiguration: {
          OutputLocation: this.athenaOutputLocation,
        },
        WorkGroup: this.athenaWorkGroup,
      })
    );

    if (!response.QueryExecutionId) {
      throw new InternalServerErrorException('Failed to start sheep export query execution');
    }

    childJob.queryExecutionId = response.QueryExecutionId;
    await this.saveJob(childJob);
    return childJob;
  }

  async createExport(createExportDto: CreateExportBySheepDto, user?: IUser) {
    this.ensureJsonlPipelineConfigured();

    if (!createExportDto.sheepIds.length) {
      throw new BadRequestException('At least one sheep must be selected');
    }

    const batchJobId = randomUUID();
    const { fromTimestamp, toTimestamp, partitionFromDate, partitionToDate } =
      this.resolveTimestampRange(createExportDto);
    const partitions = this.buildPartitions(partitionFromDate, partitionToDate);
    const selectedSheep = await this.getSelectedSheep(createExportDto.sheepIds);
    const associationsBySheep = await this.resolveAssociationsBySheep(
      selectedSheep,
      fromTimestamp,
      toTimestamp
    );
    const createdAt = this.nowIso();

    const batchJob: SheepExportBatchRecord = {
      jobId: batchJobId,
      jobType: 'SHEEP_EXPORT_BATCH',
      createdAt,
      updatedAt: createdAt,
      requestedBy: user
        ? {
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
          }
        : undefined,
      sheepIds: selectedSheep.map((sheep) => sheep.id),
      selectedSheep: selectedSheep.map((sheep) => ({ id: sheep.id, name: sheep.name })),
      fromTimestamp,
      toTimestamp,
      columns: createExportDto.columns.length > 0 ? createExportDto.columns : [],
      status: 'QUEUED',
      exportsBucket: this.exportsBucket,
      children: [],
      ttl: this.buildJobTtl(createdAt),
    };

    await this.saveJob(batchJob);

    for (const sheep of selectedSheep) {
      try {
        const childJob = await this.createChildExport(
          batchJobId,
          sheep.id,
          sheep.name,
          fromTimestamp,
          toTimestamp,
          batchJob.columns,
          partitions,
          associationsBySheep.get(sheep.id) || []
        );

        batchJob.children.push({
          jobId: childJob.jobId,
          sheepId: sheep.id,
          sheepName: sheep.name,
          outputFileName: childJob.outputFileName,
        });
      } catch (error: any) {
        const failedChild = await this.createFailedChildExport(
          batchJobId,
          sheep.id,
          sheep.name,
          fromTimestamp,
          toTimestamp,
          batchJob.columns,
          error?.message || 'Failed to create sheep export'
        );

        batchJob.children.push({
          jobId: failedChild.jobId,
          sheepId: sheep.id,
          sheepName: sheep.name,
          outputFileName: failedChild.outputFileName,
        });
      }
    }

    await this.saveJob(batchJob);
    await this.refreshBatchState(batchJob);
    return { jobId: batchJobId };
  }

  async listExportHistory() {
    const jobs = (await this.listJobsFromStore())
      .filter((job): job is SheepExportBatchRecord => job.jobType === 'SHEEP_EXPORT_BATCH')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);

    return Promise.all(
      jobs.map(async (job) => {
        const { batch, children } = this.isTerminalState(job.status)
          ? { batch: job, children: await this.loadBatchChildren(job) }
          : await this.refreshBatchState(job);

        const downloadFiles = await Promise.all(
          children.map((child) => this.buildDownloadFile(child))
        );
        const completedFiles = downloadFiles.filter((file): file is ExportFile => Boolean(file));
        const fileSizeBytes = children.reduce(
          (total, child) =>
            total + (typeof child.fileSizeBytes === 'number' ? child.fileSizeBytes : 0),
          0
        );
        const latestFileDate = children
          .map((child) => child.fileLastModifiedAt || child.completedAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .pop();

        return {
          jobId: batch.jobId,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
          completedAt: batch.completedAt,
          requestedBy: batch.requestedBy,
          collarImeis: [],
          selectedCollars: [],
          sheepIds: batch.sheepIds,
          selectedSheep: batch.selectedSheep,
          targetType: 'SHEEP',
          fromTimestamp: batch.fromTimestamp,
          toTimestamp: batch.toTimestamp,
          columns: batch.columns,
          state: batch.status,
          athenaState: children.every((child) => child.athenaState === 'NOT_REQUIRED')
            ? 'NOT_REQUIRED'
            : undefined,
          error: batch.error,
          s3Path: completedFiles.length === 1 ? children[0]?.s3Path : undefined,
          postProcessing: batch.postProcessing,
          fileLastModifiedAt: latestFileDate,
          fileSizeBytes,
          cost: this.buildExportCostSummary(batch.statistics),
          downloadFile: completedFiles.length === 1 ? completedFiles[0] : null,
        };
      })
    );
  }

  async getExportStatus(jobId: string) {
    const batchJob = await this.getJob<SheepExportBatchRecord>(jobId);
    const { batch, children } = await this.refreshBatchState(batchJob);

    return {
      state: batch.status,
      columns: batch.columns,
      s3Path: children.length === 1 ? children[0]?.s3Path : undefined,
      error: batch.error,
      postProcessing: batch.postProcessing,
      statistics: batch.statistics,
      cost: this.buildExportCostSummary(batch.statistics),
    };
  }

  async getExportFiles(jobId: string) {
    const status = await this.getExportStatus(jobId);
    if (status.state !== 'SUCCEEDED') {
      throw new InternalServerErrorException(
        `Export job ${jobId} is not completed. Current state: ${status.state}`
      );
    }

    const batchJob = await this.getJob<SheepExportBatchRecord>(jobId);
    const children = await this.loadBatchChildren(batchJob);
    const files = await Promise.all(children.map((child) => this.buildDownloadFile(child)));

    return files
      .filter((file): file is ExportFile => Boolean(file))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async refreshDownloadUrls(jobId: string) {
    return this.getExportFiles(jobId);
  }
}

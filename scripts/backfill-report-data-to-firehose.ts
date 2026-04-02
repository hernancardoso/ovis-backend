import 'dotenv/config';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { FirehoseClient, PutRecordBatchCommand } from '@aws-sdk/client-firehose';
import {
  BatchGetCommand,
  BatchGetCommandInput,
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { parseKeyValueLines } from '../src/reports/utils/parse-key-value-lines.util';
// Reuse the same acceleration decoding used by the ingest lambda.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { computeODBAAndVeDBA } = require('../../aws/lambda/mqtt_receiver/odba.js') as {
  computeODBAAndVeDBA: (
    accelerations: string[],
    windowSize?: number
  ) => {
    odba: number;
    vedba: number;
    decoded_x: number[];
    decoded_y: number[];
    decoded_z: number[];
  };
};

type QueryItem = {
  imei: number;
  timestamp: number;
  data?: string;
};

type FirehoseBatchItem = {
  data: Uint8Array;
  byteLength: number;
  payload: Record<string, unknown>;
};

type FirehoseBatchSummary = {
  records: number;
  bytes: number;
  firstImei: number | null;
  firstTimestamp: number | null;
  lastImei: number | null;
  lastTimestamp: number | null;
  minTimestamp: number | null;
  maxTimestamp: number | null;
};

type ScriptConfig = {
  imeis: number[];
  from: number;
  to: number;
  scanAllImeis: boolean;
  firehoseStream: string;
  batchSize: number;
  parallelImei: number;
  rawTableName: string;
  accTableName: string;
};

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_PARALLEL_IMEI = 3;
const MAX_FIREHOSE_BATCH_SIZE = 500;
const MAX_BATCH_GET_SIZE = 100;
// Firehose allows up to 4 MB per PutRecordBatch request.
// Keep a conservative headroom to reduce timeout risk on heavy batches.
const MAX_FIREHOSE_BATCH_BYTES = 2 * 1024 * 1024;
const MAX_FIREHOSE_RECORD_BYTES = 1000 * 1024;
const MAX_FIREHOSE_SEND_ATTEMPTS = 5;

type HardcodedBackfillConfig = {
  imeis: number[];
  from?: number;
  to?: number;
};

// Convenience defaults for ad-hoc backfills.
// CLI args / env vars still take precedence over these values.
const HARDCODED_BACKFILL_CONFIG: HardcodedBackfillConfig = {
  imeis: [],
  from: 1759460400000,
  to: 1760324400000,
};

function getAwsConfig() {
  return {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
    },
  };
}

function getArgValue(flagName: string) {
  const args = process.argv.slice(2);
  const inlineArg = args.find((arg) => arg.startsWith(`--${flagName}=`));
  if (inlineArg) {
    return inlineArg.slice(flagName.length + 3);
  }

  const flagIndex = args.findIndex((arg) => arg === `--${flagName}`);
  if (flagIndex === -1) {
    return undefined;
  }

  return args[flagIndex + 1];
}

function getHardcodedImeisValue() {
  if (HARDCODED_BACKFILL_CONFIG.imeis.length === 0) {
    return undefined;
  }

  return HARDCODED_BACKFILL_CONFIG.imeis.join(',');
}

function getHardcodedNumberValue(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return String(value);
}

function parseImeis(rawValue?: string) {
  if (rawValue == null) {
    return HARDCODED_BACKFILL_CONFIG.imeis;
  }

  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === '[]') {
    return [];
  }

  return trimmed
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value));
}

function readRequiredNumber(name: string, fallback?: string) {
  const rawValue = getArgValue(name) ?? fallback;
  const parsed = Number(rawValue);

  if (!rawValue || Number.isNaN(parsed)) {
    throw new Error(`Missing or invalid ${name}. Pass --${name}=... or set the matching env var.`);
  }

  return parsed;
}

function readOptionalNumber(name: string, fallback: number) {
  const rawValue = getArgValue(name);
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${name}: ${rawValue}`);
  }

  return parsed;
}

function readConfig(): ScriptConfig {
  const imeisRaw = getArgValue('imeis') ?? process.env.IMEIS ?? getHardcodedImeisValue();
  const imeis = parseImeis(imeisRaw);
  const scanAllImeis = imeis.length === 0;

  const batchSize = readOptionalNumber(
    'batch-size',
    Number(process.env.BATCH_SIZE) || DEFAULT_BATCH_SIZE
  );
  if (batchSize <= 0 || batchSize > MAX_FIREHOSE_BATCH_SIZE) {
    throw new Error(`batch-size must be between 1 and ${MAX_FIREHOSE_BATCH_SIZE}.`);
  }

  return {
    imeis,
    from: readRequiredNumber(
      'from',
      process.env.FROM ?? getHardcodedNumberValue(HARDCODED_BACKFILL_CONFIG.from)
    ),
    to: readRequiredNumber(
      'to',
      process.env.TO ?? getHardcodedNumberValue(HARDCODED_BACKFILL_CONFIG.to)
    ),
    scanAllImeis,
    firehoseStream: getArgValue('stream') ?? process.env.FIREHOSE_STREAM ?? 'iot-to-s3',
    batchSize,
    parallelImei: readOptionalNumber(
      'parallel-imeis',
      Number(process.env.PARALLEL_IMEIS) || DEFAULT_PARALLEL_IMEI
    ),
    rawTableName: getArgValue('raw-table') ?? process.env.RAW_TABLE_NAME ?? 'report_data_raw',
    accTableName: getArgValue('acc-table') ?? process.env.ACC_TABLE_NAME ?? 'report_acc_raw',
  };
}

async function sendBatchToFirehose(
  firehose: FirehoseClient,
  firehoseStream: string,
  batch: FirehoseBatchItem[]
) {
  if (batch.length === 0) {
    return;
  }

  const batchSummary = summarizeFirehoseBatch(batch);
  console.log(
    `[FIREHOSE_SEND] records=${batchSummary.records} bytes=${batchSummary.bytes} first_imei=${batchSummary.firstImei} first_timestamp=${batchSummary.firstTimestamp} last_imei=${batchSummary.lastImei} last_timestamp=${batchSummary.lastTimestamp} min_timestamp=${batchSummary.minTimestamp} max_timestamp=${batchSummary.maxTimestamp}`
  );

  let pendingBatch = batch;
  let attempt = 0;

  while (pendingBatch.length > 0) {
    attempt += 1;

    let response;

    try {
      response = await firehose.send(
        new PutRecordBatchCommand({
          DeliveryStreamName: firehoseStream,
          Records: pendingBatch.map((item) => ({
            Data: item.data,
          })),
        })
      );
    } catch (error) {
      const httpStatusCode =
        typeof error === 'object' && error !== null && '$metadata' in error
          ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
          : undefined;
      const retryable =
        httpStatusCode === 408 ||
        httpStatusCode === 429 ||
        httpStatusCode === 500 ||
        httpStatusCode === 502 ||
        httpStatusCode === 503 ||
        httpStatusCode === 504;
      const pendingSummary = summarizeFirehoseBatch(pendingBatch);

      console.warn(
        `[FIREHOSE_SEND_EXCEPTION] attempt=${attempt} retryable=${retryable} status=${httpStatusCode ?? 'unknown'} records=${pendingSummary.records} bytes=${pendingSummary.bytes} first_imei=${pendingSummary.firstImei} first_timestamp=${pendingSummary.firstTimestamp} last_imei=${pendingSummary.lastImei} last_timestamp=${pendingSummary.lastTimestamp} min_timestamp=${pendingSummary.minTimestamp} max_timestamp=${pendingSummary.maxTimestamp}`
      );

      if (!retryable || attempt >= MAX_FIREHOSE_SEND_ATTEMPTS) {
        throw new Error(
          `Firehose batch send failed after ${attempt} attempts. status=${httpStatusCode ?? 'unknown'} first_imei=${pendingSummary.firstImei} first_timestamp=${pendingSummary.firstTimestamp} last_imei=${pendingSummary.lastImei} last_timestamp=${pendingSummary.lastTimestamp} min_timestamp=${pendingSummary.minTimestamp} max_timestamp=${pendingSummary.maxTimestamp}`
        );
      }

      const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 15000);
      console.warn(
        `[FIREHOSE_SEND_RETRY] attempt=${attempt} wait_ms=${backoffMs} min_timestamp=${pendingSummary.minTimestamp} max_timestamp=${pendingSummary.maxTimestamp}`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    const failedPutCount = response.FailedPutCount ?? 0;
    if (failedPutCount === 0) {
      const pendingSummary = summarizeFirehoseBatch(pendingBatch);
      console.log(
        `[FIREHOSE_SEND_DONE] records=${pendingSummary.records} bytes=${pendingSummary.bytes} attempt=${attempt} min_timestamp=${pendingSummary.minTimestamp} max_timestamp=${pendingSummary.maxTimestamp}`
      );
      return;
    }

    const failedItems = pendingBatch.filter((_, index) => {
      const entry = response.RequestResponses?.[index];
      return entry?.ErrorCode || entry?.ErrorMessage;
    });

    console.warn(
      `[FIREHOSE_SEND_PARTIAL_FAILURE] attempt=${attempt} failed=${failedItems.length}/${pendingBatch.length}`
    );

    if (failedItems.length === 0) {
      throw new Error(
        `Firehose returned FailedPutCount=${failedPutCount} but no failed records were identifiable.`
      );
    }

    if (attempt >= MAX_FIREHOSE_SEND_ATTEMPTS) {
      const failedSummary = summarizeFirehoseBatch(failedItems);
      throw new Error(
        `Firehose partial failure persisted after ${attempt} attempts. first_imei=${failedSummary.firstImei} first_timestamp=${failedSummary.firstTimestamp} last_imei=${failedSummary.lastImei} last_timestamp=${failedSummary.lastTimestamp} min_timestamp=${failedSummary.minTimestamp} max_timestamp=${failedSummary.maxTimestamp}`
      );
    }

    const backoffMs = Math.min(500 * 2 ** (attempt - 1), 5000);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    pendingBatch = failedItems;
  }
}

function encodeFirehoseRecord(payload: Record<string, unknown>) {
  const serialized = `${JSON.stringify(payload)}\n`;
  const data = new TextEncoder().encode(serialized);
  const byteLength = data.byteLength;

  if (byteLength > MAX_FIREHOSE_RECORD_BYTES) {
    console.warn(
      `[SKIP_OVERSIZED_RECORD] imei=${payload.imei} timestamp=${payload.timestamp} bytes=${byteLength}`
    );
    return null;
  }

  return {
    data,
    byteLength,
    payload,
  } satisfies FirehoseBatchItem;
}

function summarizeFirehoseBatch(batch: FirehoseBatchItem[]): FirehoseBatchSummary {
  const firstPayload = batch[0]?.payload;
  const lastPayload = batch[batch.length - 1]?.payload;
  const timestamps = batch
    .map((item) => item.payload.timestamp)
    .filter(
      (timestamp): timestamp is number =>
        typeof timestamp === 'number' && Number.isFinite(timestamp)
    );

  return {
    records: batch.length,
    bytes: batch.reduce((total, item) => total + item.byteLength, 0),
    firstImei: typeof firstPayload?.imei === 'number' ? firstPayload.imei : null,
    firstTimestamp: typeof firstPayload?.timestamp === 'number' ? firstPayload.timestamp : null,
    lastImei: typeof lastPayload?.imei === 'number' ? lastPayload.imei : null,
    lastTimestamp: typeof lastPayload?.timestamp === 'number' ? lastPayload.timestamp : null,
    minTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
    maxTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
  };
}

function hasFiniteNumericValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed);
  }

  return false;
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatTimestampUtc(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function formatTimestampWithOffset(timestamp: number, offsetHours: number) {
  const shiftedDate = new Date(timestamp + offsetHours * 60 * 60 * 1000);
  const year = shiftedDate.getUTCFullYear();
  const month = padDatePart(shiftedDate.getUTCMonth() + 1);
  const day = padDatePart(shiftedDate.getUTCDate());
  const hours = padDatePart(shiftedDate.getUTCHours());
  const minutes = padDatePart(shiftedDate.getUTCMinutes());
  const seconds = padDatePart(shiftedDate.getUTCSeconds());
  const offsetSign = offsetHours >= 0 ? '+' : '-';
  const offsetLabel = `${offsetSign}${padDatePart(Math.abs(offsetHours))}:00`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetLabel}`;
}

function enrichAccelerationFields(
  payload: Record<string, unknown>,
  rawAccelerationLines: string[]
) {
  if (rawAccelerationLines.length === 0) {
    return payload;
  }

  try {
    const { odba, vedba, decoded_x, decoded_y, decoded_z } =
      computeODBAAndVeDBA(rawAccelerationLines);

    payload.decoded_x = decoded_x;
    payload.decoded_y = decoded_y;
    payload.decoded_z = decoded_z;

    const needsOdba = !hasFiniteNumericValue(payload.odba);
    const needsVedba = !hasFiniteNumericValue(payload.vedba);

    if (needsOdba) {
      payload.odba = odba;
    }

    if (needsVedba) {
      payload.vedba = vedba;
    }
  } catch (error) {
    console.warn('[ACC_ENRICH_FAILED]', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return payload;
}

async function appendItemsToBatch(
  dynamoDb: DynamoDBDocumentClient,
  firehose: FirehoseClient,
  config: ScriptConfig,
  items: QueryItem[],
  batch: FirehoseBatchItem[],
  processed: number,
  progressLabel: string
) {
  let batchBytes = batch.reduce((total, item) => total + item.byteLength, 0);
  const keys = items.map((item) => ({
    imei: item.imei,
    timestamp: item.timestamp,
  }));

  const accMap = keys.length > 0 ? await batchGetAccData(dynamoDb, config.accTableName, keys) : {};

  for (const item of items) {
    processed += 1;

    const parsedData = parseKeyValueLines(item.data);
    const rawAccData = accMap[`${item.imei}_${item.timestamp}`];
    const parsedAcc = parseKeyValueLines(rawAccData);
    const rawAccelerationLines = (rawAccData ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => ['x:', 'y:', 'z:'].includes(line.slice(0, 2)));

    const firehosePayload = enrichAccelerationFields(
      {
        imei: item.imei,
        timestamp: item.timestamp,
        ...parsedData,
        ...parsedAcc,
      },
      rawAccelerationLines
    );

    const encodedRecord = encodeFirehoseRecord(firehosePayload);
    if (!encodedRecord) {
      continue;
    }

    const wouldExceedBatchSize = batch.length >= config.batchSize;
    const wouldExceedBatchBytes = batchBytes + encodedRecord.byteLength > MAX_FIREHOSE_BATCH_BYTES;

    if (wouldExceedBatchSize || wouldExceedBatchBytes) {
      await sendBatchToFirehose(firehose, config.firehoseStream, batch);
      batch = [];
      batchBytes = 0;
    }

    batch.push(encodedRecord);
    batchBytes += encodedRecord.byteLength;

    if (processed % 100 === 0) {
      console.log(`[PROGRESS] ${progressLabel} processed=${processed}`);
    }
  }

  return { batch, processed };
}

async function batchGetAccData(
  dynamoDb: DynamoDBDocumentClient,
  accTableName: string,
  keys: Array<{ imei: number; timestamp: number }>
) {
  const accMap: Record<string, string> = {};

  for (let offset = 0; offset < keys.length; offset += MAX_BATCH_GET_SIZE) {
    const chunk = keys.slice(offset, offset + MAX_BATCH_GET_SIZE);

    let request: BatchGetCommandInput = {
      RequestItems: {
        [accTableName]: {
          Keys: chunk,
        },
      },
    };

    let retryCount = 0;

    while (true) {
      const response = await dynamoDb.send(new BatchGetCommand(request));

      for (const item of response.Responses?.[accTableName] ?? []) {
        if (typeof item?.imei === 'number' && typeof item?.timestamp === 'number') {
          accMap[`${item.imei}_${item.timestamp}`] = item.data ?? '';
        }
      }

      const unprocessedKeys = response.UnprocessedKeys?.[accTableName];
      if (!unprocessedKeys?.Keys?.length) {
        break;
      }

      retryCount += 1;
      const backoffMs = Math.min(250 * 2 ** retryCount, 5000);
      console.warn(
        `[BATCH_GET_RETRY] chunk=${offset / MAX_BATCH_GET_SIZE + 1} remaining=${unprocessedKeys.Keys.length} retry=${retryCount} wait_ms=${backoffMs}`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));

      request = {
        RequestItems: {
          [accTableName]: unprocessedKeys,
        },
      };
    }
  }

  return accMap;
}

async function processImei(
  dynamoDb: DynamoDBDocumentClient,
  firehose: FirehoseClient,
  config: ScriptConfig,
  imei: number
) {
  console.log(`[START] IMEI=${imei}`);

  let exclusiveStartKey: Record<string, unknown> | undefined;
  let page = 0;
  let processed = 0;
  let batch: FirehoseBatchItem[] = [];
  const startTime = Date.now();

  do {
    page += 1;
    console.log(`[QUERY] IMEI=${imei} page=${page}`);

    const response = await dynamoDb.send(
      new QueryCommand({
        TableName: config.rawTableName,
        KeyConditionExpression: 'imei = :imei AND #ts BETWEEN :from AND :to',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':imei': imei,
          ':from': config.from,
          ':to': config.to,
        },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    const items = (response.Items ?? []) as QueryItem[];
    console.log(`[QUERY_RESULT] IMEI=${imei} page=${page} items=${items.length}`);

    const nextState = await appendItemsToBatch(
      dynamoDb,
      firehose,
      config,
      items,
      batch,
      processed,
      `IMEI=${imei}`
    );
    batch = nextState.batch;
    processed = nextState.processed;

    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  if (batch.length > 0) {
    await sendBatchToFirehose(firehose, config.firehoseStream, batch);
  }

  console.log(`[DONE] IMEI=${imei} processed=${processed} duration_ms=${Date.now() - startTime}`);
}

async function processAllImeis(
  dynamoDb: DynamoDBDocumentClient,
  firehose: FirehoseClient,
  config: ScriptConfig
) {
  console.warn(
    `[SCAN_ALL_MODE] Scanning ${config.rawTableName} for timestamp range ${config.from}..${config.to} using ${config.parallelImei} segment(s)`
  );

  const startTime = Date.now();
  const segments = Array.from({ length: Math.max(config.parallelImei, 1) }, (_, index) => index);

  const results = await Promise.all(
    segments.map((segment) =>
      processScanSegment(dynamoDb, firehose, config, segment, segments.length)
    )
  );

  const processed = results.reduce((total, result) => total + result.processed, 0);

  console.log(`[DONE] SCAN_ALL processed=${processed} duration_ms=${Date.now() - startTime}`);
}

async function processScanSegment(
  dynamoDb: DynamoDBDocumentClient,
  firehose: FirehoseClient,
  config: ScriptConfig,
  segment: number,
  totalSegments: number
) {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  let page = 0;
  let processed = 0;
  let batch: FirehoseBatchItem[] = [];
  const startTime = Date.now();

  do {
    page += 1;
    console.log(`[SCAN] segment=${segment} page=${page}`);

    const response = await dynamoDb.send(
      new ScanCommand({
        TableName: config.rawTableName,
        FilterExpression: '#ts BETWEEN :from AND :to',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':from': config.from,
          ':to': config.to,
        },
        Segment: segment,
        TotalSegments: totalSegments,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    const items = (response.Items ?? []) as QueryItem[];
    console.log(`[SCAN_RESULT] segment=${segment} page=${page} items=${items.length}`);

    const nextState = await appendItemsToBatch(
      dynamoDb,
      firehose,
      config,
      items,
      batch,
      processed,
      `SCAN segment=${segment}`
    );
    batch = nextState.batch;
    processed = nextState.processed;

    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  if (batch.length > 0) {
    await sendBatchToFirehose(firehose, config.firehoseStream, batch);
  }

  console.log(
    `[DONE] SCAN_SEGMENT segment=${segment} processed=${processed} duration_ms=${Date.now() - startTime}`
  );

  return { processed };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const nextItem = queue.shift();
      if (nextItem === undefined) {
        return;
      }

      await worker(nextItem);
    }
  });

  await Promise.all(workers);
}

async function main() {
  const config = readConfig();
  const awsConfig = getAwsConfig();
  const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient(awsConfig));
  const firehose = new FirehoseClient(awsConfig);

  console.log(
    `[RANGE_DATES] from_utc=${formatTimestampUtc(config.from)} from_utc_minus_3=${formatTimestampWithOffset(config.from, -3)} to_utc=${formatTimestampUtc(config.to)} to_utc_minus_3=${formatTimestampWithOffset(config.to, -3)}`
  );

  console.log(
    `[START_JOB] imeis=${config.scanAllImeis ? 'ALL' : config.imeis.length} from=${config.from} to=${config.to} stream=${config.firehoseStream} batch_size=${config.batchSize} parallel_imeis=${config.parallelImei}`
  );

  const interval = setInterval(() => {
    console.log('[HEARTBEAT] still running...');
  }, 10000);

  try {
    if (config.scanAllImeis) {
      await processAllImeis(dynamoDb, firehose, config);
    } else {
      await runWithConcurrency(config.imeis, config.parallelImei, async (imei) => {
        await processImei(dynamoDb, firehose, config, imei);
      });
    }
  } finally {
    clearInterval(interval);
  }

  console.log('[JOB_DONE]');
}

void main().catch((error) => {
  console.error('[JOB_FAILED]', error);
  process.exitCode = 1;
});

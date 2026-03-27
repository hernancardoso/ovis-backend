import 'dotenv/config';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { FirehoseClient, PutRecordBatchCommand } from '@aws-sdk/client-firehose';
import {
  BatchGetCommand,
  BatchGetCommandInput,
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { parseKeyValueLines } from '../src/reports/utils/parse-key-value-lines.util';

type QueryItem = {
  imei: number;
  timestamp: number;
  data?: string;
};

type ScriptConfig = {
  imeis: number[];
  from: number;
  to: number;
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
  const imeisRaw = getArgValue('imeis') ?? process.env.IMEIS;
  if (!imeisRaw) {
    throw new Error('Missing imeis. Pass --imeis=123,456 or set IMEIS.');
  }

  const imeis = imeisRaw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value));

  if (imeis.length === 0) {
    throw new Error('No valid IMEIs found in --imeis / IMEIS.');
  }

  const batchSize = readOptionalNumber(
    'batch-size',
    Number(process.env.BATCH_SIZE) || DEFAULT_BATCH_SIZE
  );
  if (batchSize <= 0 || batchSize > MAX_FIREHOSE_BATCH_SIZE) {
    throw new Error(`batch-size must be between 1 and ${MAX_FIREHOSE_BATCH_SIZE}.`);
  }

  return {
    imeis,
    from: readRequiredNumber('from', process.env.FROM),
    to: readRequiredNumber('to', process.env.TO),
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
  batch: Array<Record<string, unknown>>
) {
  if (batch.length === 0) {
    return;
  }

  await firehose.send(
    new PutRecordBatchCommand({
      DeliveryStreamName: firehoseStream,
      Records: batch.map((payload) => ({
        Data: new TextEncoder().encode(`${JSON.stringify(payload)}\n`),
      })),
    })
  );
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
  let batch: Array<Record<string, unknown>> = [];
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

    const keys = items.map((item) => ({
      imei: item.imei,
      timestamp: item.timestamp,
    }));

    const accMap =
      keys.length > 0 ? await batchGetAccData(dynamoDb, config.accTableName, keys) : {};

    for (const item of items) {
      processed += 1;

      const parsedData = parseKeyValueLines(item.data);
      const parsedAcc = parseKeyValueLines(accMap[`${item.imei}_${item.timestamp}`]);

      batch.push({
        imei: item.imei,
        timestamp: item.timestamp,
        ...parsedData,
        ...parsedAcc,
      });

      if (batch.length >= config.batchSize) {
        await sendBatchToFirehose(firehose, config.firehoseStream, batch);
        batch = [];
      }

      if (processed % 100 === 0) {
        console.log(`[PROGRESS] IMEI=${imei} processed=${processed}`);
      }
    }

    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  if (batch.length > 0) {
    await sendBatchToFirehose(firehose, config.firehoseStream, batch);
  }

  console.log(`[DONE] IMEI=${imei} processed=${processed} duration_ms=${Date.now() - startTime}`);
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
    `[START_JOB] imeis=${config.imeis.length} from=${config.from} to=${config.to} stream=${config.firehoseStream} batch_size=${config.batchSize} parallel_imeis=${config.parallelImei}`
  );

  const interval = setInterval(() => {
    console.log('[HEARTBEAT] still running...');
  }, 10000);

  try {
    await runWithConcurrency(config.imeis, config.parallelImei, async (imei) => {
      await processImei(dynamoDb, firehose, config, imei);
    });
  } finally {
    clearInterval(interval);
  }

  console.log('[JOB_DONE]');
}

void main().catch((error) => {
  console.error('[JOB_FAILED]', error);
  process.exitCode = 1;
});

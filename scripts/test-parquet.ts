import { parquetToJson } from './parquet-to-json';
import { decodeAccelerations } from './decode-accelerations';

export async function runParquetTest(filePath: string) {
  try {
    const data = await parquetToJson(filePath, {
      writeToFile: false,
    });

    const safe = JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);

    console.log(safe);

    return data;
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    throw err;
  }
}

// 👇 ejecución directa
(async () => {
  const filePath =
    '/Users/hernan/Downloads/iot-to-s3-1-2026-03-31-08-54-39-3062226e-e7a5-32c6-b85b-6064ac8d35f9.parquet';

  const data = await runParquetTest(filePath);

  const results: any[] = [];

  for (const row of data) {
    // validar que existan
    if (!row.x || !row.y || !row.z) continue;

    const acc = [`x:${row.x}`, `y:${row.y}`, `z:${row.z}`];

    try {
      const decoded = decodeAccelerations(acc);

      results.push({
        imei: row.imei,
        timestamp: row.timestamp,
        ...decoded,
      });
    } catch (err) {
      console.warn('Skipping row due to decode error');
    }
  }

  console.log('Processed rows:', results.length);
  console.log(results[0]);
})();

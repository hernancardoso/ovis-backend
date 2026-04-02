import path from 'path';
import fs from 'fs';

// duckdb no tiene types perfectos → usamos require tipado
// eslint-disable-next-line @typescript-eslint/no-var-requires
import duckdb from 'duckdb';

export interface ParquetOptions {
  writeToFile?: boolean;
}

/**
 * Convierte un parquet a JSON
 */
export function parquetToJson(relativePath: string, options: ParquetOptions = {}): Promise<any[]> {
  const { writeToFile = true } = options;

  return new Promise((resolve, reject) => {
    try {
      if (!relativePath) {
        throw new Error('You must provide a file path');
      }

      const inputPath = path.resolve(relativePath);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
      }

      const db = new duckdb.Database(':memory:');

      db.all(`SELECT * FROM read_parquet('${inputPath}')`, (err: Error | null, rows: any[]) => {
        if (err) return reject(err);

        if (writeToFile) {
          const dir = path.dirname(inputPath);
          const baseName = path.basename(inputPath, '.parquet');
          const outputPath = path.join(dir, `${baseName}.json`);

          fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
          console.log(`✅ JSON creado en: ${outputPath}`);
        }

        resolve(rows);
      });
    } catch (err) {
      reject(err);
    }
  });
}

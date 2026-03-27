import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  GlueClient,
  GetTableCommand,
  UpdateTableCommand,
  Column,
  TableInput,
} from '@aws-sdk/client-glue';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class GlueDataService implements OnModuleInit {
  private readonly glue: GlueClient;
  private readonly s3: S3Client;

  private readonly databaseName = 'iot_raw';
  private readonly tables = ['collar_messages', 'collar_messages_firehose'];
  private readonly internalsBucket = 'ovis-internals';
  private readonly internalsSchemaKey = 'schema.json';

  constructor() {
    const awsConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      },
    };

    this.glue = new GlueClient(awsConfig);
    this.s3 = new S3Client(awsConfig);
  }

  async onModuleInit() {
    // Best-effort: la aplicación no debe caerse si S3/Glue no están disponibles.
    try {
      await this.persistSchemaToS3();
    } catch (err) {
      console.error('Initial schema.json sync failed', err);
    }
  }

  private async getTable(tableName: string) {
    try {
      const res = await this.glue.send(
        new GetTableCommand({
          DatabaseName: this.databaseName,
          Name: tableName,
        })
      );

      return res.Table;
    } catch (error: any) {
      if (error.name === 'EntityNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  private async updateTable(tableName: string, tableInput: TableInput) {
    await this.glue.send(
      new UpdateTableCommand({
        DatabaseName: this.databaseName,
        TableInput: tableInput,
      })
    );
  }

  private parseTaggedComment(comment?: string) {
    const trimmedComment = comment?.trim();
    if (!trimmedComment) {
      return {
        category: undefined,
        comment: undefined,
      };
    }

    const tagMatch = trimmedComment.match(/^\|([^|]+)\|\s*(.*)$/s);
    if (!tagMatch) {
      return {
        category: undefined,
        comment: trimmedComment,
      };
    }

    const [, rawCategory, rawComment] = tagMatch;
    const category = rawCategory.trim() || undefined;
    const cleanComment = rawComment.trim() || undefined;

    return {
      category,
      comment: cleanComment,
    };
  }

  private buildTaggedComment(comment?: string, category?: string) {
    const cleanComment = comment?.trim();
    const cleanCategory = category?.trim();

    if (cleanCategory && cleanComment) {
      return `|${cleanCategory}| ${cleanComment}`;
    }

    if (cleanCategory) {
      return `|${cleanCategory}|`;
    }

    return cleanComment || undefined;
  }

  async getTableSchema() {
    try {
      const table = await this.getTable(this.tables[0]);

      if (!table) {
        return {
          databaseName: this.databaseName,
          tableName: this.tables[0],
          columns: [],
          location: '',
        };
      }

      const sd = table.StorageDescriptor;
      const columns = (sd?.Columns ?? []).map((col) => ({
        ...this.parseTaggedComment(col.Comment),
        name: col.Name ?? '',
        type: col.Type ?? '',
      }));

      return {
        databaseName: this.databaseName,
        tableName: table.Name ?? this.tables[0],
        columns,
        location: sd?.Location ?? '',
        inputFormat: sd?.InputFormat,
        outputFormat: sd?.OutputFormat,
        serdeInfo: sd?.SerdeInfo,
      };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to get table schema from Glue');
    }
  }

  private buildInternalsSchemaJson(columns: Array<{ name: string; type: string }>) {
    // Formato requerido: { "<columnName>": "<glueTypeString>", ... }
    return columns.reduce<Record<string, string>>((acc, col) => {
      if (!col?.name) return acc;
      acc[col.name] = col.type ?? '';
      return acc;
    }, {});
  }

  private async persistSchemaToS3() {
    try {
      // Leer directo desde Glue (no dependemos de getTableSchema/getSchema endpoint).
      const table = await this.getTable(this.tables[0]);
      if (!table) {
        throw new InternalServerErrorException('Glue table not found while persisting schema.json');
      }

      const sd = table.StorageDescriptor;
      const columns = (sd?.Columns ?? []).map((col) => ({
        name: col.Name ?? '',
        type: col.Type ?? '',
      }));

      const payload = this.buildInternalsSchemaJson(columns);

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.internalsBucket,
          Key: this.internalsSchemaKey,
          Body: JSON.stringify(payload, null, 2),
          ContentType: 'application/json; charset=utf-8',
        })
      );
    } catch (err) {
      console.error('Failed to persist Glue schema to S3', err);
      throw new InternalServerErrorException('Failed to persist schema.json to S3');
    }
  }

  async addColumn(name: string, type: string, comment?: string, category?: string) {
    try {
      const taggedComment = this.buildTaggedComment(comment, category);

      for (const tableName of this.tables) {
        const table = await this.getTable(tableName);
        if (!table) continue;

        const sd = table.StorageDescriptor;
        if (!sd) continue;

        const columns = sd.Columns ?? [];

        if (columns.some((c) => c.Name === name)) {
          continue; // ya existe → skip
        }

        const newColumn: Column = {
          Name: name,
          Type: type,
          Comment: taggedComment,
        };

        const updatedColumns = [...columns, newColumn];

        const tableInput: TableInput = {
          Name: table.Name,
          TableType: table.TableType,
          Parameters: table.Parameters,
          PartitionKeys: table.PartitionKeys,
          StorageDescriptor: {
            ...sd,
            Columns: updatedColumns,
          },
        };

        await this.updateTable(tableName, tableInput);
      }

      await this.persistSchemaToS3();
      return { ok: true };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to add column to Glue tables');
    }
  }

  async deleteColumn(columnName: string) {
    try {
      for (const tableName of this.tables) {
        const table = await this.getTable(tableName);
        if (!table) continue;

        const sd = table.StorageDescriptor;
        if (!sd) continue;

        const columns = sd.Columns ?? [];

        const filtered = columns.filter((c) => c.Name !== columnName);

        if (filtered.length === columns.length) {
          continue; // no existía → skip
        }

        const tableInput: TableInput = {
          Name: table.Name,
          TableType: table.TableType,
          Parameters: table.Parameters,
          PartitionKeys: table.PartitionKeys,
          StorageDescriptor: {
            ...sd,
            Columns: filtered,
          },
        };

        await this.updateTable(tableName, tableInput);
      }

      await this.persistSchemaToS3();
      return { ok: true };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to delete column from Glue tables');
    }
  }

  async updateColumn(columnName: string, type: string, comment?: string, category?: string) {
    try {
      let updatedAny = false;
      const taggedComment = this.buildTaggedComment(comment, category);

      for (const tableName of this.tables) {
        const table = await this.getTable(tableName);
        if (!table) continue;

        const sd = table.StorageDescriptor;
        if (!sd) continue;

        const columns = sd.Columns ?? [];
        const columnIndex = columns.findIndex((c) => c.Name === columnName);
        if (columnIndex === -1) continue;

        const updatedColumn: Column = {
          ...columns[columnIndex],
          Type: type,
          Comment: taggedComment,
        };

        const updatedColumns = [...columns];
        updatedColumns[columnIndex] = updatedColumn;

        const tableInput: TableInput = {
          Name: table.Name,
          TableType: table.TableType,
          Parameters: table.Parameters,
          PartitionKeys: table.PartitionKeys,
          StorageDescriptor: {
            ...sd,
            Columns: updatedColumns,
          },
        };

        await this.updateTable(tableName, tableInput);
        updatedAny = true;
      }

      if (!updatedAny) {
        throw new NotFoundException(`Column ${columnName} not found in Glue tables`);
      }

      await this.persistSchemaToS3();
      return { ok: true };
    } catch (err) {
      console.error(err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to update column in Glue tables');
    }
  }
}

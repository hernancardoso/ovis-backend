import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  GlueClient,
  GetTableCommand,
  UpdateTableCommand,
  Column,
  TableInput,
} from '@aws-sdk/client-glue';

@Injectable()
export class GlueDataService {
  private readonly glue: GlueClient;

  private readonly databaseName = 'iot_raw';
  private readonly tables = ['collar_messages', 'collar_messages_firehose'];
  

  constructor() {
    this.glue = new GlueClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      },
    });
  }

  private async getTable(tableName: string) {
    try {
      const res = await this.glue.send(
        new GetTableCommand({
          DatabaseName: this.databaseName,
          Name: tableName,
        }),
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
      }),
    );
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
        name: col.Name ?? '',
        type: col.Type ?? '',
        comment: col.Comment,
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

  async addColumn(name: string, type: string, comment?: string) {
    try {
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
          Comment: comment,
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

      return { ok: true };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to delete column from Glue tables');
    }
  }
}

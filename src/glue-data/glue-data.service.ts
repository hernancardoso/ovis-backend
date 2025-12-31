import { Injectable, Logger } from '@nestjs/common';
import { GlueClient, GetTableCommand, GetTableCommandOutput, UpdateTableCommand } from '@aws-sdk/client-glue';

@Injectable()
export class GlueDataService {
  private readonly logger = new Logger(GlueDataService.name);
  private readonly glueClient: GlueClient;
  private readonly databaseName = 'iot_raw';
  private readonly tableName = 'collar_messages_parquet';

  constructor() {
    const awsConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    };

    this.glueClient = new GlueClient(awsConfig);
  }

  async getTableSchema() {
    try {
      const command = new GetTableCommand({
        DatabaseName: this.databaseName,
        Name: this.tableName,
      });

      const response: GetTableCommandOutput = await this.glueClient.send(command);
      const table = response.Table;

      if (!table) {
        throw new Error('Table not found');
      }

      // Extract column information
      const columns = table.StorageDescriptor?.Columns?.map((col) => ({
        name: col.Name,
        type: col.Type,
        comment: col.Comment,
      })) || [];

      return {
        databaseName: table.DatabaseName,
        tableName: table.Name,
        columns,
        location: table.StorageDescriptor?.Location,
        inputFormat: table.StorageDescriptor?.InputFormat,
        outputFormat: table.StorageDescriptor?.OutputFormat,
        serdeInfo: table.StorageDescriptor?.SerdeInfo,
      };
    } catch (error) {
      this.logger.error(`Error getting table schema: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addColumn(name: string, type: string, comment?: string) {
    try {
      // First, get the current table definition
      const getCommand = new GetTableCommand({
        DatabaseName: this.databaseName,
        Name: this.tableName,
      });

      const response = await this.glueClient.send(getCommand);
      const table = response.Table;

      if (!table || !table.StorageDescriptor) {
        throw new Error('Table not found or invalid');
      }

      // Check if column already exists
      const existingColumns = table.StorageDescriptor.Columns || [];
      const columnExists = existingColumns.some((col) => col.Name === name);
      if (columnExists) {
        throw new Error(`Column ${name} already exists`);
      }

      // Add the new column
      const newColumns = [
        ...existingColumns,
        {
          Name: name,
          Type: type,
          Comment: comment,
        },
      ];

      // Prepare TableInput with all required fields
      const tableInput: any = {
        Name: table.Name,
        StorageDescriptor: {
          ...table.StorageDescriptor,
          Columns: newColumns,
        },
      };

      if (table.PartitionKeys) {
        tableInput.PartitionKeys = table.PartitionKeys;
      }
      if (table.Parameters) {
        tableInput.Parameters = table.Parameters;
      }
      if (table.TableType) {
        tableInput.TableType = table.TableType;
      }
      if (table.Description) {
        tableInput.Description = table.Description;
      }
      if (table.Owner) {
        tableInput.Owner = table.Owner;
      }

      // Update the table with the new column
      const updateCommand = new UpdateTableCommand({
        DatabaseName: this.databaseName,
        TableInput: tableInput,
      });

      await this.glueClient.send(updateCommand);

      this.logger.log(`Column ${name} added successfully`);

      return {
        success: true,
        message: `Column ${name} added successfully`,
      };
    } catch (error) {
      this.logger.error(`Error adding column: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteColumn(columnName: string) {
    try {
      // First, get the current table definition
      const getCommand = new GetTableCommand({
        DatabaseName: this.databaseName,
        Name: this.tableName,
      });

      const response = await this.glueClient.send(getCommand);
      const table = response.Table;

      if (!table || !table.StorageDescriptor) {
        throw new Error('Table not found or invalid');
      }

      // Remove the column
      const existingColumns = table.StorageDescriptor.Columns || [];
      const filteredColumns = existingColumns.filter((col) => col.Name !== columnName);

      if (filteredColumns.length === existingColumns.length) {
        throw new Error(`Column ${columnName} not found`);
      }

      // Prepare TableInput with all required fields
      const tableInput: any = {
        Name: table.Name,
        StorageDescriptor: {
          ...table.StorageDescriptor,
          Columns: filteredColumns,
        },
      };

      if (table.PartitionKeys) {
        tableInput.PartitionKeys = table.PartitionKeys;
      }
      if (table.Parameters) {
        tableInput.Parameters = table.Parameters;
      }
      if (table.TableType) {
        tableInput.TableType = table.TableType;
      }
      if (table.Description) {
        tableInput.Description = table.Description;
      }
      if (table.Owner) {
        tableInput.Owner = table.Owner;
      }

      // Update the table without the column
      const updateCommand = new UpdateTableCommand({
        DatabaseName: this.databaseName,
        TableInput: tableInput,
      });

      await this.glueClient.send(updateCommand);

      this.logger.log(`Column ${columnName} deleted successfully`);

      return {
        success: true,
        message: `Column ${columnName} deleted successfully`,
      };
    } catch (error) {
      this.logger.error(`Error deleting column: ${error.message}`, error.stack);
      throw error;
    }
  }
}


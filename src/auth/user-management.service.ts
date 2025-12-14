import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  AdminUpdateUserAttributesCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  AttributeType,
  UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoConfig, IConfigService } from 'src/config/interfaces/config.interface';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);
  private cognitoClient: CognitoIdentityProviderClient;
  private userPoolId: string;

  constructor(private readonly configService: ConfigService<IConfigService, true>) {
    const cognitoConfig = this.configService.get<CognitoConfig>('cognito');
    this.userPoolId = cognitoConfig.userPoolId;

    const clientConfig: any = {
      region: cognitoConfig.region,
    };

    // If AWS credentials are provided via environment variables, use them
    // Otherwise, AWS SDK will try to use default credential provider chain
    if (process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.cognitoClient = new CognitoIdentityProviderClient(clientConfig);
  }

  async createUser(createUserDto: CreateUserDto) {
    const { name, email, password, establishmentIds, isAdmin } = createUserDto;

    const attributes: AttributeType[] = [
      { Name: 'name', Value: name },
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
    ];

    // Store establishment IDs as comma-separated string
    if (establishmentIds && establishmentIds.length > 0) {
      attributes.push({
        Name: 'custom:establishmentIds',
        Value: establishmentIds.join(','),
      });
    }

    try {
      const command = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: attributes,
        TemporaryPassword: password,
        MessageAction: 'SUPPRESS', // Suppress welcome email
      });

      const result = await this.cognitoClient.send(command);

      // Set permanent password
      if (result.User) {
        await this.setUserPassword(email, password);
      }

      // Add user to admin group if isAdmin is true
      if (isAdmin && result.User) {
        await this.addUserToAdminGroup(email);
      }

      // Get user with group info
      const userInfo = await this.getUser(email);

      return {
        userId: result.User?.Username,
        email: result.User?.Attributes?.find((attr) => attr.Name === 'email')?.Value,
        name: result.User?.Attributes?.find((attr) => attr.Name === 'name')?.Value,
        establishmentIds,
        isAdmin: userInfo.isAdmin,
      };
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        throw new BadRequestException('User with this email already exists');
      }
      throw new BadRequestException(`Failed to create user: ${error.message}`);
    }
  }

  async setUserPassword(email: string, password: string) {
    try {
      // Set permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      });

      await this.cognitoClient.send(setPasswordCommand);

      // Verify email
      const verifyEmailCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
      });

      await this.cognitoClient.send(verifyEmailCommand);
    } catch (error) {
      console.error('Error setting user password:', error);
      throw error;
    }
  }

  async getUser(email: string) {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      const result = await this.cognitoClient.send(command);

      const establishmentIdsStr =
        result.UserAttributes?.find((attr) => attr.Name === 'custom:establishmentIds')?.Value ||
        result.UserAttributes?.find((attr) => attr.Name === 'custom:establishmentId')?.Value ||
        '';

      const establishmentIds = establishmentIdsStr
        ? establishmentIdsStr.split(',').map((id) => id.trim()).filter(Boolean)
        : [];

      // Check if user is in admin group
      const isAdmin = await this.isUserInAdminGroup(email);

      return {
        userId: result.Username,
        email: result.UserAttributes?.find((attr) => attr.Name === 'email')?.Value,
        name: result.UserAttributes?.find((attr) => attr.Name === 'name')?.Value,
        establishmentIds,
        isAdmin,
        enabled: result.Enabled,
        userStatus: result.UserStatus,
        createdAt: result.UserCreateDate,
        updatedAt: result.UserLastModifiedDate,
      };
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        throw new NotFoundException('User not found');
      }
      throw new BadRequestException(`Failed to get user: ${error.message}`);
    }
  }

  async listUsers() {
    try {
      const allUsers: any[] = [];
      let paginationToken: string | undefined = undefined;

      do {
        const command = new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Limit: 60,
          PaginationToken: paginationToken,
        });

        const result = await this.cognitoClient.send(command);

        const users = await Promise.all(
          (result.Users || []).map(async (user) => {
            const establishmentIdsStr =
              user.Attributes?.find((attr) => attr.Name === 'custom:establishmentIds')?.Value ||
              '';

            const establishmentIds = establishmentIdsStr
              ? establishmentIdsStr.split(',').map((id) => id.trim()).filter(Boolean)
              : [];

            // Check if user is in admin group
            const isAdmin = await this.isUserInAdminGroup(user.Username || '');

            return {
              userId: user.Username,
              email: user.Attributes?.find((attr) => attr.Name === 'email')?.Value,
              name: user.Attributes?.find((attr) => attr.Name === 'name')?.Value,
              establishmentIds,
              isAdmin,
              enabled: user.Enabled,
              userStatus: user.UserStatus,
              createdAt: user.UserCreateDate,
              updatedAt: user.UserLastModifiedDate,
            };
          })
        );

        allUsers.push(...users);
        paginationToken = (result as any).PaginationToken;
      } while (paginationToken);

      return allUsers;
    } catch (error: any) {
      throw new BadRequestException(`Failed to list users: ${error.message}`);
    }
  }

  async updateUser(email: string, updateUserDto: UpdateUserDto) {
    try {
      const attributes: AttributeType[] = [];

      if (updateUserDto.establishmentIds !== undefined) {
        // If array is empty, set empty string to clear the attribute
        const establishmentIdsValue = updateUserDto.establishmentIds.length > 0 
          ? updateUserDto.establishmentIds.join(',') 
          : '';
        attributes.push({
          Name: 'custom:establishmentIds',
          Value: establishmentIdsValue,
        });
      }

      if (updateUserDto.name !== undefined) {
        attributes.push({
          Name: 'name',
          Value: updateUserDto.name,
        });
      }

      // Update user attributes if any
      if (attributes.length > 0) {
        const command = new AdminUpdateUserAttributesCommand({
          UserPoolId: this.userPoolId,
          Username: email,
          UserAttributes: attributes,
        });

        await this.cognitoClient.send(command);
      }

      // Handle admin group membership
      if (updateUserDto.isAdmin !== undefined) {
        const currentlyAdmin = await this.isUserInAdminGroup(email);
        if (updateUserDto.isAdmin && !currentlyAdmin) {
          await this.addUserToAdminGroup(email);
        } else if (!updateUserDto.isAdmin && currentlyAdmin) {
          await this.removeUserFromAdminGroup(email);
        }
      }

      // If no updates were made, throw error
      if (attributes.length === 0 && updateUserDto.isAdmin === undefined) {
        throw new BadRequestException('No attributes to update');
      }

      return this.getUser(email);
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        throw new NotFoundException('User not found');
      }
      throw new BadRequestException(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(email: string) {
    try {
      const command = new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      await this.cognitoClient.send(command);
      return { message: 'User deleted successfully' };
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        throw new NotFoundException('User not found');
      }
      throw new BadRequestException(`Failed to delete user: ${error.message}`);
    }
  }

  private async isUserInAdminGroup(email: string): Promise<boolean> {
    try {
      const command = new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      const result = await this.cognitoClient.send(command);
      return result.Groups?.some((group) => group.GroupName === 'admin') || false;
    } catch (error) {
      // If user doesn't exist or other error, return false
      return false;
    }
  }

  private async addUserToAdminGroup(email: string): Promise<void> {
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      GroupName: 'admin',
    });

    await this.cognitoClient.send(command);
  }

  private async removeUserFromAdminGroup(email: string): Promise<void> {
    const command = new AdminRemoveUserFromGroupCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      GroupName: 'admin',
    });

    await this.cognitoClient.send(command);
  }

  async removeEstablishmentFromAllUsers(establishmentId: string) {
    try {
      // Obtener todos los usuarios
      const allUsers = await this.listUsers();
      
      // Filtrar usuarios que tienen el establishmentId
      const usersWithEstablishment = allUsers.filter(
        (user) => user.establishmentIds && user.establishmentIds.includes(establishmentId)
      );

      this.logger.log(`Found ${usersWithEstablishment.length} users with establishment ${establishmentId}`);

      // Actualizar cada usuario removiendo el establishmentId
      const updatePromises = usersWithEstablishment.map(async (user) => {
        const updatedEstablishmentIds = user.establishmentIds.filter((id) => id !== establishmentId);
        
        this.logger.log(`Updating user ${user.email}: removing establishment ${establishmentId}. Remaining: ${updatedEstablishmentIds.join(',') || 'none'}`);
        
        // Si después de remover no quedan establecimientos, dejamos un array vacío
        await this.updateUser(user.email, {
          establishmentIds: updatedEstablishmentIds,
        });
      });

      await Promise.all(updatePromises);

      this.logger.log(`Successfully updated ${usersWithEstablishment.length} users in Cognito`);

      return {
        message: `Establishment removed from ${usersWithEstablishment.length} user(s)`,
        affectedUsers: usersWithEstablishment.length,
      };
    } catch (error: any) {
      this.logger.error(`Error in removeEstablishmentFromAllUsers: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to remove establishment from users: ${error.message}`);
    }
  }
}


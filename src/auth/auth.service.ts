import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';
import {
  IAuthConfig,
  IConfigService,
} from 'src/config/interfaces/config.interface';

@Injectable()
export class AuthService {
  private userPool: CognitoUserPool;

  constructor(
    private readonly configService: ConfigService<IConfigService, true>
  ) {
    const { userPoolId, clientId } =
      this.configService.get<IAuthConfig>('auth');

    this.userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });
  }

  authenticateUser(user: { name: string; password: string }) {
    const { name, password } = user;

    const authenticationDetails = new AuthenticationDetails({
      Username: name,
      Password: password,
    });
    const userData = {
      Username: name,
      Pool: this.userPool,
    };

    const newUser = new CognitoUser(userData);
    return new Promise((resolve, reject) => {
      return newUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          resolve(result);
        },
        onFailure: (err) => {
          reject(err);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // User was signed in, but a new password is required
          console.log('New password is required');
          // You can strip out attributes you don't want the user to be able to modify
          delete userAttributes.email_verified; // for example
          delete userAttributes.email; // for example
          console.log('THis is , ', userAttributes);
          // Assume you get the new password from user input
          const newPassword = 'Hola1234..';
          newUser.completeNewPasswordChallenge(newPassword, userAttributes, {
            onSuccess: (result) => {
              resolve(result);
            },
            onFailure: (err) => {
              reject(err);
            },
          });
        },
      });
    });
  }
}

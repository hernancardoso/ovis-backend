import { Injectable } from '@nestjs/common';
import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { ConfigService } from '@nestjs/config';
import { CognitoConfig, IConfigService } from 'src/config/interfaces/config.interface';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';
import { ChangePasswordUserDto } from './dtos/change-password-user.dto';
import { ForgotPasswordUserDto } from './dtos/forgot-password-user.dto';
import { RefreshTokenUserDto } from './dtos/refresh-token-user.dto';

type AuthResult = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AwsCognitoService {
  private userPool: CognitoUserPool;

  constructor(private readonly configService: ConfigService<IConfigService, true>) {
    const cognitoConfig = this.configService.get<CognitoConfig>('cognito');

    this.userPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.clientId,
    });
  }

  async registerUser(authRegisterUserDto: RegisterUserDto) {
    const { name, email, password } = authRegisterUserDto;

    return new Promise((resolve, reject) => {
      this.userPool.signUp(
        email,
        password,
        [
          new CognitoUserAttribute({
            Name: 'name',
            Value: name,
          }),
        ],
        [],
        (err, result) => {
          if (!result) {
            reject(err);
          } else {
            resolve(result.user);
          }
        }
      );
    });
  }

  async authenticateUser(authLoginUserDto: LoginUserDto): Promise<AuthResult> {
    const { email, password } = authLoginUserDto;
    const userData = {
      Username: email,
      Pool: this.userPool,
    };

    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const userCognito = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      userCognito.authenticateUser(authenticationDetails, {
        onSuccess: (result: CognitoUserSession) => {
          resolve({
            idToken: result.getIdToken().getJwtToken(),
            accessToken: result.getAccessToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken(),
          });
        },
        onFailure: (err) => {
          reject(err);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          const session = (userCognito as any).Session;
          const userAttr = {
            'name': userAttributes.name !== '' ? userAttributes.name : 'OVIS USER',
            'custom:establishmentId': process.env.ESTABLISHMENT_KEY,
          };
          this.respondToNewPasswordChallenge({
            email,
            newPassword: password,
            userAttr,
            session,
          })
            .then(resolve)
            .catch(reject);
        },
      });
    });
  }

  async respondToNewPasswordChallenge(forceChangePasswordUserDto: any): Promise<AuthResult> {
    const { email, newPassword, userAttr, session } = forceChangePasswordUserDto;

    const userData = {
      Username: email,
      Pool: this.userPool,
    };

    const userCognito = new CognitoUser(userData);
    // Set the session token on the user object
    (userCognito as any).Session = session;

    return new Promise((resolve, reject) => {
      userCognito.completeNewPasswordChallenge(
        newPassword,
        userAttr, // Ensure this is a valid object (map)
        {
          onSuccess: (result: CognitoUserSession) => {
            resolve({
              idToken: result.getIdToken().getJwtToken(),
              accessToken: result.getAccessToken().getJwtToken(),
              refreshToken: result.getRefreshToken().getToken(),
            });
          },
          onFailure: (err) => {
            reject(err);
          },
        }
      );
    });
  }

  async changeUserPassword(authChangePasswordUserDto: ChangePasswordUserDto) {
    const { email, currentPassword, newPassword } = authChangePasswordUserDto;
    const userData = {
      Username: email,
      Pool: this.userPool,
    };

    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: currentPassword,
    });

    const userCognito = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      userCognito.authenticateUser(authenticationDetails, {
        onSuccess: () => {
          userCognito.changePassword(currentPassword, newPassword, (err, result) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(result);
          });
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }

  async forgotUserPassword(authForgotPasswordUserDto: ForgotPasswordUserDto) {
    const { email } = authForgotPasswordUserDto;
    const userData = {
      Username: email,
      Pool: this.userPool,
    };

    const userCognito = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      userCognito.forgotPassword({
        onSuccess: (result) => {
          resolve(result);
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }

  async refreshToken(refreshTokenUserDto: RefreshTokenUserDto) {
    const RefreshToken = new CognitoRefreshToken({
      RefreshToken: refreshTokenUserDto.refreshToken,
    });
    const userData = {
      Username: '', // Username should be fetched differently as it's not included in the refresh token
      Pool: this.userPool,
    };

    const userCognito = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      userCognito.refreshSession(RefreshToken, (err, session) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        });
      });
    });
  }
}

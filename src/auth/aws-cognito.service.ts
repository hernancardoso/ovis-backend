import { Injectable } from '@nestjs/common';
import { AuthenticationDetails, CognitoUser, CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';
import { LoginUserDto } from './dtos/login-user.dto';
import { RegisterUserDto } from './dtos/register-user.dto';
import { ConfigService } from '@nestjs/config';
import { CognitoConfig, IConfigService } from 'src/config/interfaces/config.interface';

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

    console.log(authRegisterUserDto);

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

  async authenticateUser(authLoginUserDto: LoginUserDto) {
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
        onSuccess: (result) => {
          resolve({
            accessToken: result.getAccessToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken(),
          });
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }
}

import { exit } from 'process';
import { CognitoConfig } from './interfaces/config.interface';
import { cognitoConfigSchema } from './schemas/config.schema';
import { Logger } from '@nestjs/common';

export default (): { cognito: CognitoConfig } => {
  try {
    return {
      cognito: cognitoConfigSchema.parse({
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID,
        region: process.env.COGNITO_REGION,
        authority: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      }),
    };
  } catch (error) {
    Logger.error('Error loading auth config', error, 'AuthConfig');
    exit(1);
  }
};

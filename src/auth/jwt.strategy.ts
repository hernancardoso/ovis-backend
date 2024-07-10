import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoIdToken } from 'amazon-cognito-identity-js';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CognitoConfig, IConfigService } from 'src/config/interfaces/config.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hZaNEqLFK',
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_hZaNEqLFK/.well-known/jwks.json',
      }),
    });
  }

  async validate(payload: { [key: string]: any }) {
    return { userId: payload.sub, email: payload.email, establishmentId: payload['custom:establishmentId'] };
  }
}

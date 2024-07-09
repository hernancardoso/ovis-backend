import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CognitoConfig, IConfigService } from 'src/config/interfaces/config.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService<IConfigService, true>) {
    const cognito = configService.get<CognitoConfig>('cognito');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: cognito.clientId,
      issuer: cognito.authority,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: cognito.authority + '/.well-known/jwks.json',
      }),
    });
  }

  async validate(payload: any) {
    return { idUser: payload.sub, email: payload.email };
  }
}

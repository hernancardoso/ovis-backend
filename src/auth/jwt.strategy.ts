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
    // Only use custom:establishmentIds (not custom:establishmentId)
    console.log('payload', payload);
    const establishmentIdsStr = payload['custom:establishmentIds'] || '';
    const establishmentIds = establishmentIdsStr 
      ? (establishmentIdsStr.includes(',') ? establishmentIdsStr.split(',').map(id => id.trim()).filter(Boolean) : [establishmentIdsStr])
      : [];
    
    // Check if user is admin via Cognito groups
    const isAdmin = payload['cognito:groups']?.includes('admin') || false;
    
    // Always set establishmentId from establishmentIds[0] if available for backward compatibility
    const establishmentId = establishmentIds.length > 0 ? establishmentIds[0] : undefined;
    
    // Debug log if custom:establishmentIds is missing from token
    if (!establishmentIdsStr) {
      const availableCustomAttrs = Object.keys(payload).filter(key => key.startsWith('custom:'));
      console.warn('JWT Strategy: custom:establishmentIds is missing from JWT token', {
        email: payload.email,
        userId: payload.sub,
        availableCustomAttributes: availableCustomAttrs,
        message: 'The custom:establishmentIds attribute exists in Cognito but is not included in the JWT token. ' +
          'Please configure the App Client to include custom:establishmentIds in the ID token claims.'
      });
    }
    
    return { 
      userId: payload.sub, 
      email: payload.email, 
      establishmentId,
      establishmentIds,
      isAdmin 
    };
  }
}

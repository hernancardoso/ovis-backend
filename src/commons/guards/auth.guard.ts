import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGaurd } from '@nestjs/passport';

@Injectable()
export class AuthGuard extends PassportAuthGaurd('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublicRoute = this.reflector.get<boolean>('isPublicRoute', context.getClass());

    if (isPublicRoute) {
      return true;
    }

    return super.canActivate(context);
  }
}

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class EstablishmentGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Admins can access any establishment
    if (user?.isAdmin) {
      // If establishmentId is provided in query/params, use it; otherwise allow access
      const establishmentId = request.query?.establishmentId || request.params?.establishmentId;
      if (establishmentId) {
        request.establishmentId = establishmentId;
      }
      return true;
    }

    // Regular users need at least one establishment
    const establishmentIds = user?.establishmentIds || (user?.establishmentId ? [user.establishmentId] : []);
    if (establishmentIds.length === 0) {
      return false;
    }

    // Use the first establishment ID for backward compatibility
    request.establishmentId = establishmentIds[0];
    request.establishmentIds = establishmentIds;
    return true;
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User as IUser } from '../interfaces/user.interface';

export const User = createParamDecorator<
  keyof IUser | undefined, // the type of `data`
  ExecutionContext // the type of `ctx`
>((data, ctx) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  
  if (!data) {
    return user;
  }
  
  // Special handling for establishmentId: 
  // 1. First check if it's in query params (for switching establishments)
  // 2. Then check if it's in request.establishmentId (set by guards)
  // 3. Then try to get it from establishmentIds array
  // 4. Finally fallback to user.establishmentId
  if (data === 'establishmentId') {
    const queryEstablishmentId = request.query?.establishmentId;
    const requestEstablishmentId = request.establishmentId;
    
    // If query param is provided and user has access to it, use it
    if (queryEstablishmentId) {
      const userEstablishmentIds = user?.establishmentIds || (user?.establishmentId ? [user.establishmentId] : []);
      const hasAccess = user?.isAdmin || userEstablishmentIds.includes(queryEstablishmentId);
      if (hasAccess) {
        return queryEstablishmentId;
      }
    }
    
    // Use request.establishmentId if set by guards
    if (requestEstablishmentId) {
      return requestEstablishmentId;
    }
    
    // Try to get it from establishmentIds array
    if (!user?.[data] && user?.establishmentIds?.length > 0) {
      return user.establishmentIds[0];
    }
  }
  
  return user?.[data];
});

// This allows calling @User('establishmentId') establishmentId
// or @User user and then user.establishmentId

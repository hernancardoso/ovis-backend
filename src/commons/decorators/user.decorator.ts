import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User as IUser } from '../interfaces/user.interface';

export const User = createParamDecorator<
  keyof IUser | undefined, // the type of `data`
  ExecutionContext // the type of `ctx`
>((data, ctx) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  return data ? user?.[data] : user;
});

// This allows calling @User('establishmentId') establishmentId
// or @User user and then user.establishmentId

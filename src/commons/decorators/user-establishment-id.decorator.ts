import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserEstablishmentId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  // return request.user.establishmentId;
  return '9feb0b68-c819-45de-ada9-105a6c985812';
});

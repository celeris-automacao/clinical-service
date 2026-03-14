import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../../shared/auth/user-context';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Dados injetados pelo Guard
  },
);

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import {
  AuthenticatedRequest,
  AuthUser,
} from '../../modules/auth/interfaces/auth-user.interface.js';

type RequestWithUser = Request & AuthenticatedRequest;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

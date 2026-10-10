import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from '../../modules/auth/session.service.js';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/auth-user.interface.js';

type RequestWithAuth = Request & Partial<AuthenticatedRequest>;

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = this.readCookie(
      request.headers.cookie,
      this.sessionService.getCookieName(),
    );

    if (!token) {
      throw new UnauthorizedException('Invalid session');
    }

    const { user, session } =
      await this.sessionService.validateSessionToken(token);
    request.user = user;
    request.session = session;

    return true;
  }

  private readCookie(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) {
      return undefined;
    }

    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName === name) {
        return decodeURIComponent(rawValue.join('='));
      }
    }

    return undefined;
  }
}

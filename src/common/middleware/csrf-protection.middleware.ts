import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) { }

  use(request: Request, _response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const secFetchSite = request.header('sec-fetch-site');
    if (secFetchSite === 'cross-site') {
      throw new ForbiddenException('Untrusted request origin');
    }

    const origin = request.header('origin');
    console.log({ origin });

    if (!origin || secFetchSite === 'same-origin') {
      next();
      return;
    }

    if (!this.getTrustedOrigins().has(origin)) {
      throw new ForbiddenException('Untrusted request origin');
    }

    next();
  }

  private getTrustedOrigins(): Set<string> {
    const origins = [
      this.configService.get<string>('FRONTEND_URL') ?? '',
      this.configService.get<string>('CORS_ORIGIN') ?? '',
    ]
      .flatMap((value) => value.split(','))
      .map((origin) => origin.trim())
      .filter(Boolean);

    return new Set(origins);
  }
}

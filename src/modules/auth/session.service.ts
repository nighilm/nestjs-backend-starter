import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import {
  AuthenticatedSession,
  AuthUser,
} from './interfaces/auth-user.interface.js';

type CookieSameSite = 'lax' | 'strict';

interface ValidatedSession {
  user: AuthUser;
  session: AuthenticatedSession;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getCookieName(): string {
    return this.configService.get<string>('SESSION_COOKIE_NAME') ?? 'session';
  }

  async createSession(user: AuthUser): Promise<string> {
    const sessionId = this.generateTokenPart(24);
    const sessionSecret = this.generateTokenPart(32);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.getAbsoluteTimeoutSeconds() * 1000,
    );

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        secretHash: this.hashSecret(sessionSecret),
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
      },
    });

    return `${sessionId}.${sessionSecret}`;
  }

  async validateSessionToken(token: string): Promise<ValidatedSession> {
    const parsed = this.parseSessionToken(token);
    if (!parsed) {
      throw new UnauthorizedException('Invalid session');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || !session.user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }

    if (!this.secretMatches(parsed.sessionSecret, session.secretHash)) {
      throw new UnauthorizedException('Invalid session');
    }

    const now = new Date();
    const idleExpiresAt = new Date(
      session.lastUsedAt.getTime() + this.getIdleTimeoutSeconds() * 1000,
    );
    if (session.expiresAt <= now || idleExpiresAt <= now) {
      throw new UnauthorizedException('Invalid session');
    }

    await this.refreshLastUsedAtIfNeeded(session.id, session.lastUsedAt, now);

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      session: {
        id: session.id,
        userId: session.userId,
      },
    };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  setSessionCookie(response: Response, token: string): void {
    const secure = this.isSecureCookie();
    const cookieName = this.getCookieName();
    if (cookieName.startsWith('__Host-') && !secure) {
      throw new InternalServerErrorException(
        '__Host- session cookies require Secure=true',
      );
    }

    response.cookie(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite: this.getSameSite(),
      path: '/',
      maxAge: this.getAbsoluteTimeoutSeconds() * 1000,
    });
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(this.getCookieName(), {
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: this.getSameSite(),
      path: '/',
    });
  }

  private parseSessionToken(
    token: string,
  ): { sessionId: string; sessionSecret: string } | null {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }

    return { sessionId: parts[0], sessionSecret: parts[1] };
  }

  private generateTokenPart(byteLength: number): string {
    return randomBytes(byteLength).toString('base64url');
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private secretMatches(secret: string, expectedHash: string): boolean {
    const suppliedHash = this.hashSecret(secret);
    const supplied = Buffer.from(suppliedHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  }

  private async refreshLastUsedAtIfNeeded(
    sessionId: string,
    lastUsedAt: Date,
    now: Date,
  ): Promise<void> {
    const refreshAfterMs = this.getActivityRefreshSeconds() * 1000;
    if (now.getTime() - lastUsedAt.getTime() < refreshAfterMs) {
      return;
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: now },
    });
  }

  private getIdleTimeoutSeconds(): number {
    return this.configService.get<number>('SESSION_IDLE_TIMEOUT_SECONDS') ?? 86400;
  }

  private getAbsoluteTimeoutSeconds(): number {
    return (
      this.configService.get<number>('SESSION_ABSOLUTE_TIMEOUT_SECONDS') ?? 604800
    );
  }

  private getActivityRefreshSeconds(): number {
    return (
      this.configService.get<number>('SESSION_ACTIVITY_REFRESH_SECONDS') ?? 3600
    );
  }

  private isSecureCookie(): boolean {
    return this.configService.get<boolean>('SESSION_SECURE') ?? false;
  }

  private getSameSite(): CookieSameSite {
    return (
      this.configService.get<CookieSameSite>('SESSION_SAME_SITE') ?? 'lax'
    );
  }
}

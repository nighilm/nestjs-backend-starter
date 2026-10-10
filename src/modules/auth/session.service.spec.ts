import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { SessionService } from './session.service.js';

describe('SessionService', () => {
  const sessionCreate = jest.fn();
  const sessionFindUnique = jest.fn();
  const sessionUpdate = jest.fn();
  const sessionUpdateMany = jest.fn();
  const prisma = {
    session: {
      create: sessionCreate,
      findUnique: sessionFindUnique,
      update: sessionUpdate,
      updateMany: sessionUpdateMany,
    },
  } as unknown as PrismaService;
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        SESSION_COOKIE_NAME: 'session',
        SESSION_SECURE: false,
        SESSION_SAME_SITE: 'lax',
        SESSION_IDLE_TIMEOUT_SECONDS: 86400,
        SESSION_ABSOLUTE_TIMEOUT_SECONDS: 604800,
        SESSION_ACTIVITY_REFRESH_SECONDS: 3600,
      };

      return values[key];
    }),
  } as unknown as ConfigService;
  const service = new SessionService(prisma, config);

  beforeEach(() => {
    sessionCreate.mockReset();
    sessionFindUnique.mockReset();
    sessionUpdate.mockReset();
    sessionUpdateMany.mockReset();
  });

  it('creates an opaque token and stores only the session secret hash', async () => {
    sessionCreate.mockResolvedValue({});
    const token = await service.createSession({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver',
    });
    const [sessionId, sessionSecret] = token.split('.');
    const stored = sessionCreate.mock.calls[0][0].data as {
      id: string;
      secretHash: string;
    };

    expect(sessionId).toBe(stored.id);
    expect(sessionSecret.length).toBeGreaterThanOrEqual(43);
    expect(stored.secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.secretHash).not.toBe(sessionSecret);
  });

  it('validates a session using the secret hash and rejects raw id reuse', async () => {
    sessionCreate.mockImplementation(({ data }) => Promise.resolve(data));
    const token = await service.createSession({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver',
    });
    const session = sessionCreate.mock.calls[0][0].data;
    sessionFindUnique.mockResolvedValue({
      ...session,
      user: {
        id: 'user-1',
        email: 'driver@example.com',
        name: 'Driver',
        isActive: true,
      },
    });

    await expect(service.validateSessionToken(token)).resolves.toMatchObject({
      user: { id: 'user-1', email: 'driver@example.com', name: 'Driver' },
      session: { id: session.id, userId: 'user-1' },
    });
    await expect(service.validateSessionToken(session.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sets production cookie attributes for __Host-session', () => {
    const secureConfig = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          SESSION_COOKIE_NAME: '__Host-session',
          SESSION_SECURE: true,
          SESSION_SAME_SITE: 'lax',
          SESSION_ABSOLUTE_TIMEOUT_SECONDS: 604800,
        };

        return values[key];
      }),
    } as unknown as ConfigService;
    const response = { cookie: jest.fn() } as unknown as Response;

    new SessionService(prisma, secureConfig).setSessionCookie(
      response,
      'id.secret',
    );

    expect(response.cookie).toHaveBeenCalledWith(
      '__Host-session',
      'id.secret',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('rejects __Host-session without Secure cookies', () => {
    const insecureConfig = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          SESSION_COOKIE_NAME: '__Host-session',
          SESSION_SECURE: false,
          SESSION_SAME_SITE: 'lax',
        };

        return values[key];
      }),
    } as unknown as ConfigService;
    const response = { cookie: jest.fn() } as unknown as Response;

    expect(() =>
      new SessionService(prisma, insecureConfig).setSessionCookie(
        response,
        'id.secret',
      ),
    ).toThrow(InternalServerErrorException);
  });
});

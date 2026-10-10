import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const hash = bcrypt.hashSync('correct-password', 4);
  const findUnique = jest.fn();
  const sessionCreate = jest.fn();
  const sessionFindUnique = jest.fn();
  const sessionUpdate = jest.fn();
  const sessionUpdateMany = jest.fn();
  const user = {
    id: 'user-1',
    email: 'driver@example.com',
    name: 'Driver',
    passwordHash: hash,
    isActive: true,
  };
  const sessions = new Map<string, Record<string, unknown>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        user: { findUnique },
        session: {
          create: sessionCreate,
          findUnique: sessionFindUnique,
          update: sessionUpdate,
          updateMany: sessionUpdateMany,
        },
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: ['http://localhost:5173'],
      credentials: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    findUnique.mockReset();
    sessionCreate.mockReset();
    sessionFindUnique.mockReset();
    sessionUpdate.mockReset();
    sessionUpdateMany.mockReset();
    sessions.clear();

    sessionCreate.mockImplementation(({ data }) => {
      sessions.set(data.id, data);
      return Promise.resolve(data);
    });
    sessionFindUnique.mockImplementation(({ where }) => {
      const session = sessions.get(where.id);
      return Promise.resolve(session ? { ...session, user } : null);
    });
    sessionUpdate.mockImplementation(({ where, data }) => {
      const session = sessions.get(where.id);
      sessions.set(where.id, { ...session, ...data });
      return Promise.resolve(sessions.get(where.id));
    });
    sessionUpdateMany.mockImplementation(({ where, data }) => {
      const session = sessions.get(where.id);
      if (session && session.revokedAt === null) {
        sessions.set(where.id, { ...session, ...data });
      }

      return Promise.resolve({ count: session ? 1 : 0 });
    });
  });

  it('creates a server-side session and returns safe user data for valid credentials', async () => {
    findUnique.mockResolvedValue(user);
    const response = await request(await app.getUrl())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'driver@example.com', password: 'correct-password' })
      .expect(200);
    const body = response.body as Record<string, unknown> & {
      user: { passwordHash?: string };
    };
    expect(body).toMatchObject({
      user: { id: 'user-1', email: 'driver@example.com', name: 'Driver' },
    });
    expect(body.accessToken).toBeUndefined();
    expect(body.sessionSecret).toBeUndefined();
    expect(body.user.passwordHash).toBeUndefined();
    expect(sessionCreate).toHaveBeenCalledTimes(1);
    const storedSession = sessionCreate.mock.calls[0][0].data as {
      secretHash: string;
    };
    expect(storedSession.secretHash).toMatch(/^[a-f0-9]{64}$/);
    const setCookie = response.headers['set-cookie'] as string[];
    expect(setCookie[0]).toContain('session=');
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('SameSite=Lax');
    expect(setCookie[0]).toContain('Path=/');
  });

  it('returns 401 for an unknown email or incorrect password', async () => {
    findUnique.mockResolvedValue(null);
    await request(await app.getUrl())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'missing@example.com', password: 'wrong-password' })
      .expect(401);
  });

  it('returns the same 401 for an inactive account', async () => {
    findUnique.mockResolvedValue({ ...user, isActive: false });
    await request(await app.getUrl())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'driver@example.com', password: 'correct-password' })
      .expect(401);
  });

  it('rejects invalid and extra fields', async () => {
    await request(await app.getUrl())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'invalid', password: 'x' })
      .expect(400);
    await request(await app.getUrl())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'driver@example.com',
        password: 'correct-password',
        extra: true,
      })
      .expect(400);
  });

  it('authenticates /me with a valid session cookie', async () => {
    const cookie = await loginAndGetCookie();

    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          user: { id: 'user-1', email: 'driver@example.com', name: 'Driver' },
        });
        expect(body.user.passwordHash).toBeUndefined();
      });
  });

  it('rejects invalid session credentials', async () => {
    await request(await app.getUrl()).get('/api/auth/me').expect(401);
    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', 'session=malformed')
      .expect(401);
    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', 'session=missing.secret')
      .expect(401);

    const cookie = await loginAndGetCookie();
    const token = cookie.match(/session=([^;]+)/)?.[1] ?? '';
    const sessionId = token.split('.')[0];

    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', `session=${sessionId}.wrong-secret`)
      .expect(401);
    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', `session=${sessionId}`)
      .expect(401);
  });

  it('rejects expired and revoked sessions', async () => {
    const cookie = await loginAndGetCookie();
    const token = cookie.match(/session=([^;]+)/)?.[1] ?? '';
    const sessionId = token.split('.')[0];
    const stored = sessions.get(sessionId);

    sessions.set(sessionId, {
      ...stored,
      expiresAt: new Date(Date.now() - 1000),
    });
    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(401);

    sessions.set(sessionId, {
      ...stored,
      revokedAt: new Date(),
    });
    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('revokes the server-side session and clears the cookie on logout', async () => {
    const cookie = await loginAndGetCookie();

    await request(await app.getUrl())
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ headers }) => {
        expect((headers['set-cookie'] as string[])[0]).toContain(
          'session=;',
        );
      });

    expect(sessionUpdateMany).toHaveBeenCalledTimes(1);
    await request(await app.getUrl())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(401);

    await request(await app.getUrl())
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
  });

  it('applies browser-origin CSRF checks to state-changing requests', async () => {
    await request(await app.getUrl())
      .post('/api/auth/logout')
      .set('Origin', 'https://evil.example')
      .expect(403);
    await request(await app.getUrl())
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
    await request(await app.getUrl()).get('/api/auth/me').expect(401);
  });

  it('allows configured CORS origins with credentials', async () => {
    const response = await request(await app.getUrl())
      .options('/api/auth/me')
      .set('Origin', 'http://localhost:5173')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  async function loginAndGetCookie(): Promise<string> {
    findUnique.mockResolvedValue(user);
    const loginResponse = await request(await app.getUrl())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'driver@example.com', password: 'correct-password' });

    return (loginResponse.headers['set-cookie'] as string[])[0];
  }
});

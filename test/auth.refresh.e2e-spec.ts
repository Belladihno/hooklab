import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticatedRequest } from '../src/auth/types/authenticated-request.js';
import { SignedIn } from '../src/common/access/access.decorators.js';
import { createE2eApp, TestApp } from './e2e-app.js';

@Controller('api/v1/me-stub')
class MeStubController {
  @Get()
  @SignedIn()
  me(@Req() request: AuthenticatedRequest): { id: string; email: string } {
    return request.user;
  }
}

interface Cookies {
  access: string;
  refresh: string;
}

function cookiesFrom(response: request.Response): Cookies {
  const setCookie = response.headers['set-cookie'] as unknown as
    string[] | undefined;
  const values = setCookie ?? [];

  return {
    access: values.find((cookie) => cookie.startsWith('access_token=')) ?? '',
    refresh: values.find((cookie) => cookie.startsWith('refresh_token=')) ?? '',
  };
}

function cookiePair(cookie: string): string {
  return cookie.split(';')[0] ?? '';
}

function cookieValue(cookie: string): string {
  return cookiePair(cookie).replace(/^[^=]+=/, '');
}

describe('auth refresh sessions', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let loginCount = 0;

  beforeAll(async () => {
    testApp = await createE2eApp({ controllers: [MeStubController] });
    app = testApp.app;
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function login(): Promise<Cookies> {
    const email = `refresh-${++loginCount}@example.com`;
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    return cookiesFrom(response);
  }

  it('rotates the refresh token and issues a working access token', async () => {
    const first = await login();

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(first.refresh))
      .expect(200);

    expect(refreshed.body.data.email).toContain('refresh-');
    const second = cookiesFrom(refreshed);
    expect(cookiePair(second.refresh)).not.toBe(cookiePair(first.refresh));

    const payload = app.get(JwtService).verify(cookieValue(second.access));
    expect(payload.sub).toBe(refreshed.body.data.id);
    expect(payload.sid).toEqual(expect.any(String));

    const me = await request(app.getHttpServer())
      .get('/api/v1/me-stub')
      .set('Cookie', cookiePair(second.access))
      .expect(200);

    expect(me.body.data.id).toBe(refreshed.body.data.id);
  });

  it('revokes the session when an old refresh token is reused', async () => {
    const first = await login();

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(first.refresh))
      .expect(200);
    const second = cookiesFrom(refreshed);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(first.refresh))
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(second.refresh))
      .expect(401);
  });

  it('rejects missing and malformed refresh tokens', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=not-a-token')
      .expect(401);
  });

  it('logs out, clears cookies, and revokes the session', async () => {
    const session = await login();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [cookiePair(session.access), cookiePair(session.refresh)])
      .expect(204);

    const cleared = cookiesFrom(response);
    expect(cleared.access).toContain('access_token=;');
    expect(cleared.refresh).toContain('refresh_token=;');
    expect(response.text).toBe('');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(session.refresh))
      .expect(401);
  });

  it('rejects and revokes a session after the idle expiry passes', async () => {
    const session = await login();
    const payload = app.get(JwtService).verify(cookieValue(session.access));

    await testApp.database.dataSource.query(
      `UPDATE auth_sessions SET idle_expires_at = now() - interval '1 second' WHERE id = $1`,
      [payload.sid],
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(session.refresh))
      .expect(401);

    const rows = await testApp.database.dataSource.query<
      Array<{ revoked_at: Date | null }>
    >('SELECT revoked_at FROM auth_sessions WHERE id = $1', [payload.sid]);

    expect(rows[0]?.revoked_at).toBeInstanceOf(Date);
  });

  it('logs out with only a valid refresh cookie when access is expired or absent', async () => {
    const session = await login();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookiePair(session.refresh))
      .expect(204);

    expect(response.text).toBe('');
    expect(cookiesFrom(response).refresh).toContain('refresh_token=;');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(session.refresh))
      .expect(401);
  });
});

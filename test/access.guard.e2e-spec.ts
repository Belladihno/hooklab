import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public, SignedIn } from '../src/common/access/access.decorators.js';
import { createE2eApp, TestApp } from './e2e-app.js';

@Controller('api/v1/access-stub')
class AccessStubController {
  @Get('public')
  @Public()
  publicRoute(): { route: string } {
    return { route: 'public' };
  }

  @Get('signed-in')
  @SignedIn()
  signedInRoute(): { route: string } {
    return { route: 'signed-in' };
  }

  @Get('undeclared')
  undeclaredRoute(): { route: string } {
    return { route: 'undeclared' };
  }
}

describe('global access guard', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createE2eApp({ controllers: [AccessStubController] });
    app = testApp.app;
  });

  afterAll(async () => {
    await testApp.close();
  });

  let loginCount = 0;

  async function login(): Promise<string> {
    const email = `access-${++loginCount}@example.com`;
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as
      string[] | undefined;

    return cookies?.[0]?.split(';')[0] ?? '';
  }

  it('allows a public route without a cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/access-stub/public')
      .expect(200);

    expect(response.body.data).toEqual({ route: 'public' });
  });

  it('rejects a signed-in route without a cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/access-stub/signed-in')
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows a signed-in route with a valid cookie', async () => {
    const cookie = await login();

    const response = await request(app.getHttpServer())
      .get('/api/v1/access-stub/signed-in')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.data).toEqual({ route: 'signed-in' });
  });

  it('fails closed when a route declares no access', async () => {
    const cookie = await login();

    const response = await request(app.getHttpServer())
      .get('/api/v1/access-stub/undeclared')
      .set('Cookie', cookie)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      message: 'Route access is not declared',
      error: { code: 'FORBIDDEN' },
    });
  });
});

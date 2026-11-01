import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/auth/entities/user.entity.js';
import type { AuthenticatedRequest } from '../src/auth/types/authenticated-request.js';
import { SignedIn } from '../src/common/access/access.decorators.js';
import { createE2eApp, TestApp } from './e2e-app.js';

@Controller('api/v1/protected-stub')
class ProtectedStubController {
  @Get()
  @SignedIn()
  currentUser(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}

describe('JwtAuthGuard integration', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    testApp = await createE2eApp({
      controllers: [ProtectedStubController],
    });
    app = testApp.app;
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function login(
    email: string,
    password: string,
  ): Promise<{ cookie: string; id: string }> {
    const userResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const setCookie = loginResponse.headers['set-cookie'] as unknown as
      string[] | undefined;
    const cookie = setCookie?.[0]?.split(';')[0] ?? '';

    return {
      cookie,
      id: (userResponse.body.data as { id: string }).id,
    };
  }

  it('rejects a request without the access token cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/protected-stub')
      .expect(401);
  });

  it('accepts a valid cookie and attaches the database user', async () => {
    const { cookie, id } = await login('guard@example.com', 'password123');

    const response = await request(app.getHttpServer())
      .get('/api/v1/protected-stub')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.data).toEqual({
      id,
      email: 'guard@example.com',
    });
  });

  it('rejects a cookie whose user was deleted', async () => {
    const { cookie, id } = await login('deleted@example.com', 'password123');

    await dataSource.getRepository(User).delete({ id });

    await request(app.getHttpServer())
      .get('/api/v1/protected-stub')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects a tampered token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/protected-stub')
      .set('Cookie', 'access_token=not-a-jwt')
      .expect(401);
  });
});

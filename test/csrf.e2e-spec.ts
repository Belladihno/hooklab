import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, TestApp } from './e2e-app.js';

describe('CSRF origin checks', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let loginCount = 0;

  beforeAll(async () => {
    testApp = await createE2eApp();
    app = testApp.app;
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function createUser(): Promise<{ email: string; password: string }> {
    const email = `csrf-${++loginCount}@example.com`;
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    return { email, password };
  }

  it('allows unsafe requests without Origin or Referer for non-browser clients', async () => {
    const user = await createUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(user)
      .expect(200);
  });

  it('rejects a mismatched Origin on an unsafe request', async () => {
    const user = await createUser();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://evil.example.test')
      .send(user);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a mismatched Referer when Origin is absent', async () => {
    const user = await createUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Referer', 'http://evil.example.test/phish')
      .send(user)
      .expect(403);
  });

  it('allows a same-origin request', async () => {
    const user = await createUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Host', 'api.example.test')
      .set('Origin', 'http://api.example.test')
      .send(user)
      .expect(200);
  });

  it('allows an explicitly configured origin', async () => {
    const user = await createUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://allowed.example.test')
      .send(user)
      .expect(200);
  });

  it('rejects the null origin', async () => {
    const user = await createUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'null')
      .send(user)
      .expect(403);
  });

  it('does not apply to safe methods', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Origin', 'http://evil.example.test');

    expect(response.status).toBe(401);
  });
});

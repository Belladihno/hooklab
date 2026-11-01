import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, TestApp } from './e2e-app.js';

interface SafeUser {
  id: string;
  email: string;
  createdAt: string;
}

const unauthorizedBody = {
  success: false,
  message: 'Invalid email or password',
  data: null,
  error: {
    code: 'UNAUTHORIZED',
    message: 'Invalid email or password',
  },
};

describe('POST /api/v1/auth/login', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createE2eApp();
    app = testApp.app;
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function register(email: string, password: string): Promise<SafeUser> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    return response.body.data as SafeUser;
  }

  it('returns 200, the safe user, and an httpOnly session cookie', async () => {
    const user = await register('login@example.com', 'password123');

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'Login@Example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(user);
    expect(response.body.data).not.toHaveProperty('token');

    const setCookie = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    const cookie = setCookie?.join('; ') ?? '';

    expect(cookie).toContain('access_token=');
    expect(cookie).toContain('refresh_token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=900');
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toContain('Path=/api/v1/auth');

    const token = cookie.match(/access_token=([^;]+)/)?.[1];
    expect(token).toBeDefined();

    const payload = app.get(JwtService).verify(token as string);
    expect(payload.sub).toBe(user.id);
    expect(payload.sid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(payload.exp - payload.iat).toBe(15 * 60);
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('password');
  });

  it('returns 401 without a cookie for a wrong password', async () => {
    await register('wrong-password@example.com', 'password123');

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'wrong-password@example.com',
        password: 'wrong-password',
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject(unauthorizedBody);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('returns 401 without a cookie for an unknown email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.com', password: 'password123' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject(unauthorizedBody);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('returns 400 when required fields are missing or empty', async () => {
    const missingBoth = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({});

    expect(missingBoth.status).toBe(400);

    const missingPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com' });

    expect(missingPassword.status).toBe(400);

    const emptyPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: '' });

    expect(emptyPassword.status).toBe(400);
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createE2eApp, TestApp } from './e2e-app.js';

describe('auth attempt limits', () => {
  let testApp: TestApp;
  let app: INestApplication;
  const previousEmailLimit = process.env.AUTH_EMAIL_FAILURE_LIMIT;
  const previousIpLimit = process.env.AUTH_IP_ATTEMPT_LIMIT;

  beforeAll(async () => {
    process.env.AUTH_EMAIL_FAILURE_LIMIT = '3';
    process.env.AUTH_IP_ATTEMPT_LIMIT = '6';
    testApp = await createE2eApp();
    app = testApp.app;
  });

  beforeEach(async () => {
    await testApp.database.dataSource.query('DELETE FROM auth_attempts');
  });

  afterAll(async () => {
    await testApp.close();
    process.env.AUTH_EMAIL_FAILURE_LIMIT = previousEmailLimit;
    process.env.AUTH_IP_ATTEMPT_LIMIT = previousIpLimit;
  });

  async function register(email: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
  }

  function login(email: string, password: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
  }

  it('locks an email after repeated failures without locking other emails', async () => {
    await register('locked@example.com');
    await register('other@example.com');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await login('locked@example.com', 'wrong-password').expect(401);
    }

    const blocked = await login('locked@example.com', 'password123');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');

    await login('other@example.com', 'password123').expect(200);
  });

  it('limits attempts from one IP across different emails', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await login(`unknown-${attempt}@example.com`, 'password123').expect(401);
    }

    const blocked = await login('unknown-final@example.com', 'password123');
    expect(blocked.status).toBe(429);
  });

  it('records hashed email attempts without storing raw emails', async () => {
    await register('audit@example.com');

    await login('audit@example.com', 'wrong-password').expect(401);
    await login('audit@example.com', 'password123').expect(200);

    const rows = await testApp.database.dataSource.query<
      { email_hash: string; ip: string; action: string; outcome: string }[]
    >(
      'SELECT email_hash, ip, action, outcome FROM auth_attempts ORDER BY created_at',
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.email_hash).toHaveLength(64);
    expect(rows[0]?.email_hash).not.toContain('audit@example.com');
    expect(rows[0]?.ip.length).toBeGreaterThan(0);
    expect(rows[0]?.action).toBe('login');
    expect(rows[0]?.outcome).toBe('failure');
    expect(rows[1]?.outcome).toBe('success');
  });
});

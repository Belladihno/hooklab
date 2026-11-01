import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public } from '../src/common/access/access.decorators.js';
import { createE2eApp, TestApp } from './e2e-app.js';

@Controller('api/v1/boom')
@Public()
class ThrowingController {
  @Get()
  throwError(): never {
    throw new Error('database password is hunter2');
  }
}

describe('API envelope', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createE2eApp({ controllers: [ThrowingController] });
    app = testApp.app;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('wraps success responses with data and a request id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'envelope@example.com', password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'OK',
      error: null,
      meta: { requestId: expect.any(String) },
    });
    expect(response.body.data.email).toBe('envelope@example.com');
  });

  it('returns field messages for validation failures', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { messages: expect.any(Array) },
      },
    });
  });

  it('uses the catalogue for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/does-not-exist',
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('never leaks an unexpected exception', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/boom');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      message: 'An unexpected error occurred',
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });

  it('replaces an untrusted request id instead of reflecting it', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'attacker-controlled');

    expect(response.headers['x-request-id']).not.toBe('attacker-controlled');
    expect(response.body.meta.requestId).toBe(response.headers['x-request-id']);
  });

  it('leaves health responses untouched', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

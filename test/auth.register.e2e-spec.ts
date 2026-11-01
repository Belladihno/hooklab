import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/auth/entities/user.entity.js';
import { createE2eApp, TestApp } from './e2e-app.js';

describe('POST /api/v1/auth/register', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    testApp = await createE2eApp();
    app = testApp.app;
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns the safe user shape on success', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'new@example.com', password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.error).toBeNull();
    expect(response.body.meta.requestId).toEqual(expect.any(String));
    expect(Object.keys(response.body.data).sort()).toEqual([
      'createdAt',
      'email',
      'id',
    ]);
    expect(response.body.data.email).toBe('new@example.com');
    expect(response.body.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(Number.isNaN(Date.parse(response.body.data.createdAt))).toBe(false);
  });

  it('stores a bcrypt hash of the password, never the plaintext', async () => {
    const password = 'another-password';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'hash@example.com', password })
      .expect(201);

    const user = await dataSource.getRepository(User).findOne({
      where: { email: 'hash@example.com' },
      select: { id: true, email: true, passwordHash: true, createdAt: true },
    });

    expect(user?.passwordHash).not.toBe(password);
    expect(user?.passwordHash).toMatch(/^\$2[aby]\$04\$/);
    expect(await bcrypt.compare(password, user?.passwordHash ?? '')).toBe(true);

    const defaultSelect = await dataSource
      .getRepository(User)
      .findOneBy({ email: 'hash@example.com' });

    expect(defaultSelect).not.toBeNull();
    expect(defaultSelect?.passwordHash).toBeUndefined();
  });

  it('normalizes email and rejects a case-variant duplicate', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'Normalize@Example.COM', password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('normalize@example.com');

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'NORMALIZE@example.com', password: 'password123' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('returns 409 when the email already exists', async () => {
    const payload = { email: 'duplicate@example.com', password: 'password123' };

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('returns exactly one 201 and one 409 for concurrent duplicates', async () => {
    const payload = { email: 'race@example.com', password: 'password123' };

    const responses = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/auth/register').send(payload),
      request(app.getHttpServer()).post('/api/v1/auth/register').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
  });

  it('returns 400 for an invalid email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
    });
    expect(response.body.error.details.messages.length).toBeGreaterThan(0);
  });

  it('returns 400 when the password is missing, too short, or not a string', async () => {
    const missing = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'missing@example.com' });

    expect(missing.status).toBe(400);

    const short = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'short@example.com', password: 'short' });

    expect(short.status).toBe(400);

    const nonString = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'non-string@example.com', password: 12345678 });

    expect(nonString.status).toBe(400);
  });

  it('rejects passwords longer than 72 UTF-8 bytes', async () => {
    const password = '💩'.repeat(19);
    expect(Buffer.byteLength(password, 'utf8')).toBeGreaterThan(72);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'bytes@example.com', password });

    expect(response.status).toBe(400);
  });

  it('rejects unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'extra@example.com',
        password: 'password123',
        role: 'admin',
      });

    expect(response.status).toBe(400);
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, TestApp } from './e2e-app.js';

describe('health (e2e)', () => {
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

  it('reports liveness without touching the database', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('reports readiness when the database is reachable', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.info.database.status).toBe('up');
  });

  it('reports not ready when the database connection is gone', async () => {
    await dataSource.destroy();

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
  });
});

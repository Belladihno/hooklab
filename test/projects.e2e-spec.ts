import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, TestApp } from './e2e-app.js';

interface Session {
  cookie: string;
  id: string;
}

const ENDPOINT_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cookiesFrom(response: request.Response): string {
  const setCookie = response.headers['set-cookie'] as unknown as
    string[] | undefined;

  return setCookie?.[0]?.split(';')[0] ?? '';
}

describe('projects', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let sessionCount = 0;

  beforeAll(async () => {
    testApp = await createE2eApp();
    app = testApp.app;
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function registerAndLogin(emailPrefix: string): Promise<Session> {
    const email = `${emailPrefix}-${++sessionCount}@example.com`;
    const password = 'password123';

    const user = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      cookie: cookiesFrom(login),
      id: (user.body.data as { id: string }).id,
    };
  }

  function createProject(cookie: string, name: string) {
    return request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Cookie', cookie)
      .send({ name });
  }

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/api/v1/projects').expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .send({ name: 'no-auth' })
      .expect(401);
  });

  it('creates a project and returns the raw endpoint key once', async () => {
    const session = await registerAndLogin('create');

    const response = await createProject(session.cookie, 'payments');

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'payments',
      endpointKey: expect.stringMatching(ENDPOINT_KEY_PATTERN),
      createdAt: expect.any(String),
    });
    expect(response.body.data.id).toMatch(UUID_V7_PATTERN);
    expect(response.body.data).not.toHaveProperty('endpointKeyHash');
    expect(response.body.data).not.toHaveProperty('userId');
  });

  it('lists and reads only the signed-in user projects', async () => {
    const owner = await registerAndLogin('owner');
    const other = await registerAndLogin('other');

    const first = await createProject(owner.cookie, 'alpha').expect(201);
    const second = await createProject(owner.cookie, 'beta').expect(201);
    await createProject(other.cookie, 'alpha').expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(list.body.data).toHaveLength(2);

    expect(
      (list.body.data as Array<{ id: string }>).map((project) => project.id),
    ).toEqual(
      expect.arrayContaining([first.body.data.id, second.body.data.id]),
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/projects/${first.body.data.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(detail.body.data).toMatchObject({
      id: first.body.data.id,
      name: 'alpha',
    });
    expect(detail.body.data).not.toHaveProperty('endpointKey');

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${first.body.data.id}`)
      .set('Cookie', other.cookie)
      .expect(404);
  });

  it('rejects a duplicate name for the same user but allows it across users', async () => {
    const first = await registerAndLogin('duplicate');
    const second = await registerAndLogin('duplicate');

    await createProject(first.cookie, 'same').expect(201);

    const duplicate = await createProject(first.cookie, 'same');

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');

    await createProject(second.cookie, 'same').expect(201);
  });

  it('validates project names and ids', async () => {
    const session = await registerAndLogin('validate');

    await createProject(session.cookie, '').expect(400);
    await createProject(session.cookie, '   ').expect(400);
    await createProject(session.cookie, 'x'.repeat(256)).expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Cookie', session.cookie)
      .send({ name: 123 })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/projects/not-a-uuid')
      .set('Cookie', session.cookie)
      .expect(400);
  });

  it('deletes only the owner project', async () => {
    const owner = await registerAndLogin('delete');
    const other = await registerAndLogin('delete');
    const project = await createProject(owner.cookie, 'purge').expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${project.body.data.id}`)
      .set('Cookie', other.cookie)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.body.data.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${project.body.data.id}`)
      .set('Cookie', owner.cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.body.data.id}`)
      .set('Cookie', owner.cookie)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(list.body.data).toEqual([]);
  });

  it('paginates and bounds the project list', async () => {
    const owner = await registerAndLogin('pagination');

    await createProject(owner.cookie, 'one').expect(201);
    await createProject(owner.cookie, 'two').expect(201);
    await createProject(owner.cookie, 'three').expect(201);

    const firstPage = await request(app.getHttpServer())
      .get('/api/v1/projects?limit=2')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(firstPage.body.data).toHaveLength(2);

    const secondPage = await request(app.getHttpServer())
      .get('/api/v1/projects?limit=2&offset=2')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(secondPage.body.data).toHaveLength(1);

    await request(app.getHttpServer())
      .get('/api/v1/projects?limit=101')
      .set('Cookie', owner.cookie)
      .expect(400);
  });

  it('rotates the endpoint key for the owner only', async () => {
    const owner = await registerAndLogin('rotate');
    const other = await registerAndLogin('rotate');
    const project = await createProject(owner.cookie, 'rotate-me').expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.data.id}/rotate-key`)
      .set('Cookie', other.cookie)
      .expect(404);

    const rotated = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.data.id}/rotate-key`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(rotated.body.data.endpointKey).toMatch(ENDPOINT_KEY_PATTERN);
    expect(rotated.body.data.endpointKey).not.toBe(
      project.body.data.endpointKey,
    );
    expect(rotated.body.data).not.toHaveProperty('endpointKeyHash');

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.body.data.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
  });

  it('updates the project timestamp when the endpoint key rotates', async () => {
    const owner = await registerAndLogin('rotate-timestamp');
    const project = await createProject(owner.cookie, 'timestamp').expect(201);

    await testApp.database.dataSource.query(
      `UPDATE projects SET updated_at = '2000-01-01T00:00:00Z' WHERE id = $1`,
      [project.body.data.id],
    );

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.data.id}/rotate-key`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.body.data.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(new Date(detail.body.data.updatedAt).getTime()).toBeGreaterThan(
      new Date('2000-01-01T00:00:00Z').getTime(),
    );
  });
});

import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, TestApp } from './e2e-app.js';

const CLI_TOKEN_PATTERN = /^hl_cli_[A-Za-z0-9_-]{43}$/;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Session {
  cookie: string;
  id: string;
}

function cookiesFrom(response: request.Response): string {
  const setCookie = response.headers['set-cookie'] as unknown as
    string[] | undefined;

  return setCookie?.[0]?.split(';')[0] ?? '';
}

describe('cli tokens', () => {
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

  it('returns the raw token once and stores only its hash', async () => {
    const session = await registerAndLogin('cli-create');

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/cli-tokens')
      .set('Cookie', session.cookie)
      .send({ name: 'laptop' })
      .expect(201);

    const data = response.body.data as {
      id: string;
      name: string;
      token: string;
      createdAt: string;
    };

    expect(data).toMatchObject({
      name: 'laptop',
      token: expect.stringMatching(CLI_TOKEN_PATTERN),
      createdAt: expect.any(String),
    });
    expect(data.id).toMatch(UUID_V7_PATTERN);
    expect(data).not.toHaveProperty('tokenHash');
    expect(data).not.toHaveProperty('userId');

    const rows = await testApp.database.dataSource.query<
      {
        user_id: string;
        token_hash: string;
        last_used_at: Date | null;
        revoked_at: Date | null;
      }[]
    >(
      'SELECT user_id, token_hash, last_used_at, revoked_at FROM cli_tokens WHERE id = $1',
      [data.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(session.id);
    expect(rows[0]?.token_hash).toBe(
      createHash('sha256').update(data.token, 'utf8').digest('hex'),
    );
    expect(rows[0]?.token_hash).not.toContain(data.token);
    expect(rows[0]?.last_used_at).toBeNull();
    expect(rows[0]?.revoked_at).toBeNull();
  });

  it('rejects a blank name', async () => {
    const session = await registerAndLogin('cli-blank');

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/cli-tokens')
      .set('Cookie', session.cookie)
      .send({ name: '   ' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('revokes a token for its owner and sets revoked_at', async () => {
    const session = await registerAndLogin('cli-revoke');
    const created = await request(app.getHttpServer())
      .post('/api/v1/auth/cli-tokens')
      .set('Cookie', session.cookie)
      .send({ name: 'revoke-me' })
      .expect(201);

    const id = (created.body.data as { id: string }).id;

    const revoked = await request(app.getHttpServer())
      .delete(`/api/v1/auth/cli-tokens/${id}`)
      .set('Cookie', session.cookie)
      .expect(204);

    expect(revoked.text).toBe('');

    const rows = await testApp.database.dataSource.query<
      { revoked_at: Date | null }[]
    >('SELECT revoked_at FROM cli_tokens WHERE id = $1', [id]);

    expect(rows[0]?.revoked_at).not.toBeNull();

    const revokedAt = rows[0]?.revoked_at;

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/cli-tokens/${id}`)
      .set('Cookie', session.cookie)
      .expect(204);

    const repeated = await testApp.database.dataSource.query<
      { revoked_at: Date | null }[]
    >('SELECT revoked_at FROM cli_tokens WHERE id = $1', [id]);

    expect(repeated[0]?.revoked_at).toEqual(revokedAt);
  });

  it('returns 404 when another user tries to revoke the token', async () => {
    const owner = await registerAndLogin('cli-owner');
    const other = await registerAndLogin('cli-other');
    const created = await request(app.getHttpServer())
      .post('/api/v1/auth/cli-tokens')
      .set('Cookie', owner.cookie)
      .send({ name: 'owner-token' })
      .expect(201);

    const id = (created.body.data as { id: string }).id;

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/cli-tokens/${id}`)
      .set('Cookie', other.cookie)
      .expect(404);

    const rows = await testApp.database.dataSource.query<
      { revoked_at: Date | null }[]
    >('SELECT revoked_at FROM cli_tokens WHERE id = $1', [id]);

    expect(rows[0]?.revoked_at).toBeNull();

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/cli-tokens/${id}`)
      .set('Cookie', owner.cookie)
      .expect(204);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/cli-tokens')
      .send({ name: 'laptop' })
      .expect(401);

    await request(app.getHttpServer())
      .delete('/api/v1/auth/cli-tokens/00000000-0000-7000-8000-000000000000')
      .expect(401);
  });
});

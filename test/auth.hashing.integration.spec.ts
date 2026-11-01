import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthSession } from '../src/auth/entities/auth-session.entity.js';
import { User } from '../src/auth/entities/user.entity.js';
import { AuthSessionRepository } from '../src/auth/repositories/auth-session.repository.js';
import { createTestDatabase, TestDatabase } from './database.js';

describe('auth secret storage', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase([User, AuthSession]);
  });

  afterAll(async () => {
    if (database) {
      await database.drop();
    }
  });

  it('stores only a hash and excludes it from default selects', async () => {
    const users = database.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        email: 'hash-only@example.com',
        passwordHash: 'bcrypt-hash',
      }),
    );
    const sessions = new AuthSessionRepository(
      database.dataSource.getRepository(AuthSession),
    );
    const refreshTokenHash = 'a'.repeat(64);

    const created = await sessions.create({
      id: '00000000-0000-4000-8000-000000000001',
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      idleExpiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
    });

    const raw = await database.dataSource.query<
      Array<{ refresh_token_hash: string }>
    >('SELECT refresh_token_hash FROM auth_sessions WHERE id = $1', [
      created.id,
    ]);
    expect(raw[0]?.refresh_token_hash).toBe(refreshTokenHash);

    const defaultLoaded = await database.dataSource
      .getRepository(AuthSession)
      .findOneBy({ id: created.id });
    expect(defaultLoaded?.refreshTokenHash).toBeUndefined();

    const loaded = await sessions.findById(created.id);
    expect(loaded?.refreshTokenHash).toBe(refreshTokenHash);
  });
});

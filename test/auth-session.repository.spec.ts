import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../src/auth/entities/auth-session.entity.js';
import { AuthSessionPersistenceError } from '../src/auth/errors/auth-session-persistence.error.js';
import { AuthSessionRepository } from '../src/auth/repositories/auth-session.repository.js';

const sessionId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';

function databaseFailure(): Error & {
  driverError: {
    code: string;
    constraint: string;
    query: string;
    parameters: string[];
  };
} {
  return Object.assign(new Error('duplicate key'), {
    driverError: {
      code: '23505',
      constraint: 'UQ_auth_sessions_refresh_token_hash',
      query: 'INSERT INTO auth_sessions (refresh_token_hash) VALUES ($1)',
      parameters: ['secret-refresh-hash'],
    },
  });
}

function repositoryWith(failure: Error): Repository<AuthSession> {
  return {
    create: (data: Partial<AuthSession>) => data,
    save: vi.fn().mockRejectedValue(failure),
    createQueryBuilder: () => ({
      update: () => ({
        set: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                andWhere: () => ({
                  andWhere: () => ({
                    execute: vi.fn().mockRejectedValue(failure),
                  }),
                }),
              }),
              execute: vi.fn().mockRejectedValue(failure),
            }),
          }),
        }),
      }),
    }),
  } as unknown as Repository<AuthSession>;
}

const newSession = {
  id: sessionId,
  userId,
  refreshTokenHash: 'a'.repeat(64),
  expiresAt: new Date(Date.now() + 60_000),
  idleExpiresAt: new Date(Date.now() + 60_000),
  lastUsedAt: new Date(),
};

describe('AuthSessionRepository', () => {
  it('sanitizes create failures without leaking query parameters', async () => {
    const sessions = new AuthSessionRepository(
      repositoryWith(databaseFailure()),
    );

    const failure = sessions.create(newSession);

    await expect(failure).rejects.toBeInstanceOf(AuthSessionPersistenceError);
    await expect(failure).rejects.toMatchObject({
      name: 'AuthSessionPersistenceError',
      message: 'Auth session could not be saved',
      dbCode: '23505',
    });
    await expect(failure).rejects.not.toHaveProperty('query');
    await expect(failure).rejects.not.toHaveProperty('parameters');
  });

  it('sanitizes rotate failures', async () => {
    const sessions = new AuthSessionRepository(
      repositoryWith(databaseFailure()),
    );

    await expect(
      sessions.rotate(
        sessionId,
        'b'.repeat(64),
        'c'.repeat(64),
        new Date(Date.now() + 60_000),
        userId,
        new Date(),
      ),
    ).rejects.toBeInstanceOf(AuthSessionPersistenceError);
  });

  it('sanitizes revoke failures', async () => {
    const sessions = new AuthSessionRepository(
      repositoryWith(databaseFailure()),
    );

    await expect(sessions.revoke(sessionId, new Date())).rejects.toBeInstanceOf(
      AuthSessionPersistenceError,
    );
  });
});

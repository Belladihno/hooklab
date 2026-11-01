import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { User } from '../src/auth/entities/user.entity.js';
import { EmailAlreadyExistsError } from '../src/auth/errors/email-already-exists.error.js';
import { UserPersistenceError } from '../src/auth/errors/user-persistence.error.js';
import { UserRepository } from '../src/auth/repositories/user.repository.js';

function repositoryWithSaveFailure(error: unknown): UserRepository {
  const repository = {
    create: vi.fn((data: unknown) => data),
    save: vi.fn().mockRejectedValue(error),
  } as unknown as Repository<User>;

  return new UserRepository(repository);
}

const newUser = { email: 'user@example.com', passwordHash: 'hash' };

describe('UserRepository', () => {
  it('maps a unique violation to EmailAlreadyExistsError', async () => {
    const repository = repositoryWithSaveFailure({ code: '23505' });

    await expect(repository.create(newUser)).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('sanitizes unexpected persistence errors', async () => {
    const repository = repositoryWithSaveFailure({
      code: '22001',
      parameters: [newUser.passwordHash],
    });

    const error = await repository
      .create(newUser)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UserPersistenceError);
    expect((error as UserPersistenceError).dbCode).toBe('22001');
    expect(JSON.stringify(error)).not.toContain(newUser.passwordHash);
  });

  it('reads the driver error code fallback', async () => {
    const repository = repositoryWithSaveFailure({
      driverError: { code: '23505' },
    });

    await expect(repository.create(newUser)).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });
});

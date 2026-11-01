import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { BaseEntity } from '../src/database/base.entity.js';
import { BaseRepository } from '../src/database/base.repository.js';

class TestEntity extends BaseEntity {}

class TestRepository extends BaseRepository<TestEntity> {}

function repositoryFor(tableName: string, affected?: number) {
  const repository = {
    metadata: { tableName },
    delete: vi.fn().mockResolvedValue({ affected }),
  } as unknown as Repository<TestEntity>;

  return { repository, failure: repository.delete };
}

describe('BaseRepository', () => {
  it('refuses a permanent delete when the table is not allow-listed', async () => {
    const { repository } = repositoryFor('users');

    await expect(
      new TestRepository(repository).removePermanently(
        '00000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toThrow(/HARD_DELETE_TABLES/);
  });

  it('normalises an undefined affected count to false', async () => {
    const { repository } = repositoryFor('projects', undefined);

    await expect(
      new TestRepository(repository).removePermanently(
        '00000000-0000-4000-8000-000000000001',
      ),
    ).resolves.toBe(false);
  });

  it('returns true when one row is permanently deleted from an allow-listed table', async () => {
    const { repository } = repositoryFor('projects', 1);

    await expect(
      new TestRepository(repository).removePermanently(
        '00000000-0000-4000-8000-000000000001',
      ),
    ).resolves.toBe(true);
  });
});

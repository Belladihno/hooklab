import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/auth/entities/user.entity.js';
import { CliToken } from '../src/auth/entities/cli-token.entity.js';
import { createTestDatabase, TestDatabase } from './database.js';

async function tableExists(
  database: TestDatabase,
  name: string,
): Promise<boolean> {
  const rows = await database.dataSource.query<Array<{ name: string | null }>>(
    'SELECT to_regclass($1) AS name',
    [name],
  );

  return rows[0]?.name !== null;
}

describe('cli token migrations', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase([User, CliToken]);
  });

  afterAll(async () => {
    if (database) {
      await database.drop();
    }
  });

  it('matches the entity metadata to the migrated schema', async () => {
    const schemaDiff = await database.dataSource.driver
      .createSchemaBuilder()
      .log();

    expect(schemaDiff.upQueries.map((query) => query.query)).toEqual([]);
  });

  it('cascades token deletion when the owner is deleted', async () => {
    const userId = '00000000-0000-4000-8000-0000000000a1';
    const tokenId = '00000000-0000-4000-8000-0000000000a2';

    await database.dataSource.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [userId, 'cascade@example.com', 'bcrypt-hash'],
    );
    await database.dataSource.query(
      `INSERT INTO cli_tokens (id, user_id, name, token_hash)
       VALUES ($1, $2, $3, $4)`,
      [tokenId, userId, 'cascade', 'c'.repeat(64)],
    );

    await database.dataSource.query('DELETE FROM users WHERE id = $1', [
      userId,
    ]);

    const rows = await database.dataSource.query<Array<{ id: string }>>(
      'SELECT id FROM cli_tokens WHERE id = $1',
      [tokenId],
    );

    expect(rows).toEqual([]);
  });

  it('reverts and reapplies cli_tokens cleanly', async () => {
    expect(await tableExists(database, 'cli_tokens')).toBe(true);

    await database.dataSource.undoLastMigration();

    expect(await tableExists(database, 'cli_tokens')).toBe(false);

    await database.dataSource.runMigrations();

    expect(await tableExists(database, 'cli_tokens')).toBe(true);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthAttempt } from '../src/auth/entities/auth-attempt.entity.js';
import { AuthSession } from '../src/auth/entities/auth-session.entity.js';
import { User } from '../src/auth/entities/user.entity.js';
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

describe('auth migrations', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase([User, AuthSession, AuthAttempt]);
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

  it('reverts and reapplies auth attempts and sessions cleanly', async () => {
    expect(await tableExists(database, 'auth_attempts')).toBe(true);
    expect(await tableExists(database, 'auth_sessions')).toBe(true);

    await database.dataSource.undoLastMigration();
    await database.dataSource.undoLastMigration();

    expect(await tableExists(database, 'auth_attempts')).toBe(false);
    expect(await tableExists(database, 'auth_sessions')).toBe(true);

    await database.dataSource.runMigrations();
    expect(await tableExists(database, 'auth_attempts')).toBe(true);

    await database.dataSource.undoLastMigration();
    await database.dataSource.undoLastMigration();
    await database.dataSource.undoLastMigration();

    expect(await tableExists(database, 'auth_sessions')).toBe(false);
    expect(await tableExists(database, 'auth_attempts')).toBe(false);

    await database.dataSource.runMigrations();
    expect(await tableExists(database, 'auth_sessions')).toBe(true);
    expect(await tableExists(database, 'auth_attempts')).toBe(true);
  });
});

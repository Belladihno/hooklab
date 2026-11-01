import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidV7 } from '../src/database/uuid-v7.js';
import { createTestDatabase, TestDatabase } from './database.js';

interface UserRow {
  id: string;
  email: string;
  created_at: Date;
}

describe('users schema', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    if (database) {
      await database.drop();
    }
  });

  it('stores an application-assigned UUIDv7 and timestamps', async () => {
    const id = uuidV7();
    const rows = await database.dataSource.query<UserRow[]>(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, created_at`,
      [id, 'user@example.com', 'hashed-password'],
    );

    expect(rows[0]?.id).toBe(id);
    expect(rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(rows[0]?.email).toBe('user@example.com');
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it('rejects a duplicate email at the database level', async () => {
    const insert = (): Promise<unknown> =>
      database.dataSource.query(
        'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
        [uuidV7(), 'duplicate@example.com', 'hashed-password'],
      );

    await insert();

    await expect(insert()).rejects.toMatchObject({ code: '23505' });
  });
});

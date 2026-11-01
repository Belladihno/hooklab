import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, TestDatabase } from './database.js';

describe('database integration', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    if (database) {
      await database.drop();
    }
  });

  it('connects to the isolated test schema', async () => {
    const rows = await database.dataSource.query<
      Array<{ current_schema: string }>
    >('SELECT current_schema()');

    expect(rows[0]?.current_schema).toBe(database.schema);
  });

  it('runs the baseline migration', async () => {
    const rows = await database.dataSource.query<Array<{ name: string }>>(
      'SELECT name FROM migrations ORDER BY id',
    );

    expect(rows.map((row) => row.name)).toContain('Baseline1792859960445');
  });
});

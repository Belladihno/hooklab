import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDataSource,
  validateDatabaseEnv,
} from '../src/database/data-source.js';
import { requireTestDatabaseUrl } from './database.js';

describe('migration data source', () => {
  const url = requireTestDatabaseUrl();
  const schema = `ds_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  let admin: DataSource;

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
  });

  afterAll(async () => {
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.destroy();
    }
  });

  it('uses the configured schema as the connection search path', async () => {
    const env = validateDatabaseEnv({
      DATABASE_URL: url,
      DATABASE_SCHEMA: schema,
    });
    const dataSource = createDataSource(env);

    await dataSource.initialize();

    try {
      const rows =
        await dataSource.query<Array<{ search_path: string }>>(
          'SHOW search_path',
        );

      expect(rows[0]?.search_path).toContain(schema);
    } finally {
      await dataSource.destroy();
    }
  });
});

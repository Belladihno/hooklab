import { randomUUID } from 'node:crypto';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { migrations } from '../src/database/migrations/index.js';

export interface TestDatabase {
  dataSource: DataSource;
  schema: string;
  drop: () => Promise<void>;
}

export function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL or DATABASE_URL is required. Tests create and drop an isolated schema, so the database only needs schema-create permission.',
    );
  }

  return url;
}

async function withAdminConnection<T>(
  url: string,
  run: (dataSource: DataSource) => Promise<T>,
): Promise<T> {
  const admin = new DataSource({ type: 'postgres', url });
  await admin.initialize();

  try {
    return await run(admin);
  } finally {
    await admin.destroy();
  }
}

export async function createTestDatabase(
  entities: DataSourceOptions['entities'] = [],
): Promise<TestDatabase> {
  const url = requireTestDatabaseUrl();
  const workerId = process.env.VITEST_WORKER_ID ?? String(process.pid);
  const schema = `test_${workerId}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;

  await withAdminConnection(url, async (admin) => {
    await admin.query(`CREATE SCHEMA "${schema}"`);
  });

  const dataSource = new DataSource({
    type: 'postgres',
    url,
    schema,
    entities,
    migrations,
    migrationsRun: false,
    synchronize: false,
    extra: { options: `-c search_path=${schema}` },
  });

  await dataSource.initialize();
  await dataSource.runMigrations();

  return {
    dataSource,
    schema,
    drop: async () => {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }

      await withAdminConnection(url, async (admin) => {
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      });
    },
  };
}

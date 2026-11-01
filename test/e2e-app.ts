import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../src/app.setup.js';
import { createTestDatabase, TestDatabase } from './database.js';

export interface TestApp {
  app: INestApplication;
  database: TestDatabase;
  close: () => Promise<void>;
}

export interface E2eAppOptions {
  controllers?: Type<unknown>[];
}

export async function createE2eApp(
  options: E2eAppOptions = {},
): Promise<TestApp> {
  const database = await createTestDatabase();

  process.env.DATABASE_SCHEMA = database.schema;

  const { AppModule } = await import('../src/app.module.js');
  const imports = [AppModule];

  if (options.controllers?.length) {
    const { AuthModule } = await import('../src/auth/auth.module.js');
    imports.push(AuthModule);
  }

  const moduleFixture = await Test.createTestingModule({
    imports,
    controllers: options.controllers ?? [],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();

  return {
    app,
    database,
    close: async () => {
      await app.close();
      await database.drop();
    },
  };
}

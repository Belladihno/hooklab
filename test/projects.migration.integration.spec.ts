import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/auth/entities/user.entity.js';
import { Project } from '../src/projects/entities/project.entity.js';
import { uuidV7 } from '../src/database/uuid-v7.js';
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

async function undoUntilMissing(
  database: TestDatabase,
  table: string,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!(await tableExists(database, table))) {
      return;
    }

    await database.dataSource.undoLastMigration();
  }

  throw new Error(`Could not undo migrations until ${table} was removed`);
}

async function postgresErrorCode(
  run: () => Promise<unknown>,
): Promise<string | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    const databaseError = error as {
      code?: string;
      driverError?: { code?: string };
    };

    return databaseError.driverError?.code ?? databaseError.code;
  }
}

describe('projects migration', () => {
  let database: TestDatabase;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    database = await createTestDatabase([User, Project]);

    const users = await database.dataSource.query<Array<{ id: string }>>(
      `
        INSERT INTO "users" ("id", "email", "password_hash")
        VALUES ($1, $2, $3), ($4, $5, $6)
        RETURNING "id"
      `,
      [
        uuidV7(),
        `owner-a-${randomUUID()}@example.com`,
        'not-a-real-hash',
        uuidV7(),
        `owner-b-${randomUUID()}@example.com`,
        'not-a-real-hash',
      ],
    );

    userA = users[0]!.id;
    userB = users[1]!.id;
  });

  afterAll(async () => {
    if (database) {
      await database.drop();
    }
  });

  async function insertProject(
    userId: string,
    name: string,
    endpointKeyHash: string,
  ): Promise<void> {
    await database.dataSource.query(
      `
        INSERT INTO "projects" ("id", "user_id", "name", "endpoint_key_hash")
        VALUES ($1, $2, $3, $4)
      `,
      [uuidV7(), userId, name, endpointKeyHash],
    );
  }

  it('is recorded in the migrations table', async () => {
    const rows = await database.dataSource.query<Array<{ name: string }>>(
      'SELECT name FROM migrations ORDER BY id',
    );

    expect(rows.some((row) => row.name.startsWith('CreateProjects'))).toBe(
      true,
    );
  });

  it('reverts and reapplies cleanly', async () => {
    const separateDatabase = await createTestDatabase();

    try {
      expect(await tableExists(separateDatabase, 'projects')).toBe(true);

      await undoUntilMissing(separateDatabase, 'projects');

      expect(await tableExists(separateDatabase, 'projects')).toBe(false);

      await separateDatabase.dataSource.runMigrations();

      expect(await tableExists(separateDatabase, 'projects')).toBe(true);
    } finally {
      await separateDatabase.drop();
    }
  });

  it('allows different users to use the same project name', async () => {
    await insertProject(userA, 'same-name', 'a'.repeat(64));
    await insertProject(userB, 'same-name', 'b'.repeat(64));

    const rows = await database.dataSource.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM "projects" WHERE "name" = $1`,
      ['same-name'],
    );

    expect(rows[0]?.count).toBe('2');
  });

  it('rejects duplicate project names for the same user', async () => {
    await insertProject(userA, 'duplicate-name', 'c'.repeat(64));

    const code = await postgresErrorCode(() =>
      insertProject(userA, 'duplicate-name', 'd'.repeat(64)),
    );

    expect(code).toBe('23505');
  });

  it('rejects duplicate endpoint key hashes across users', async () => {
    await insertProject(userA, 'key-owner-a', 'e'.repeat(64));

    const code = await postgresErrorCode(() =>
      insertProject(userB, 'key-owner-b', 'e'.repeat(64)),
    );

    expect(code).toBe('23505');
  });

  it('matches the entity metadata to the migrated schema', async () => {
    const schemaDiff = await database.dataSource.driver
      .createSchemaBuilder()
      .log();

    expect(schemaDiff.upQueries.map((query) => query.query)).toEqual([]);
  });

  it('persists projects through the entity repository', async () => {
    const repository = database.dataSource.getRepository(Project);
    const project = await repository.save(
      repository.create({
        userId: userB,
        name: 'entity-mapping',
        endpointKeyHash: '1'.repeat(64),
      }),
    );

    const loaded = await repository.findOne({
      where: { id: project.id },
      relations: { user: true },
    });

    expect(loaded).toMatchObject({
      id: project.id,
      userId: userB,
      name: 'entity-mapping',
    });
    expect(loaded?.endpointKeyHash).toBeUndefined();
    expect(loaded?.createdAt).toBeInstanceOf(Date);
    expect(loaded?.user.id).toBe(userB);

    const withHash = await repository
      .createQueryBuilder('project')
      .addSelect('project.endpointKeyHash')
      .where('project.id = :id', { id: project.id })
      .getOne();

    expect(withHash?.endpointKeyHash).toBe('1'.repeat(64));
  });

  it('cascades project deletion when its owner is deleted', async () => {
    await database.dataSource.query('DELETE FROM "users" WHERE "id" = $1', [
      userA,
    ]);

    const rows = await database.dataSource.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM "projects" WHERE "user_id" = $1`,
      [userA],
    );

    expect(rows[0]?.count).toBe('0');
  });
});

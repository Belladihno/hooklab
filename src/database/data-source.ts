import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuthAttempt } from '../auth/entities/auth-attempt.entity.js';
import { AuthSession } from '../auth/entities/auth-session.entity.js';
import { CliToken } from '../auth/entities/cli-token.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DatabaseEnv, validateDatabaseEnv } from '../config/env.schema.js';
import { migrations } from './migrations/index.js';

export { validateDatabaseEnv } from '../config/env.schema.js';

export function createDataSource(env: DatabaseEnv): DataSource {
  return new DataSource({
    type: 'postgres',
    url: env.DATABASE_URL,
    schema: env.DATABASE_SCHEMA,
    entities: [User, AuthSession, AuthAttempt, CliToken, Project],
    migrations,
    migrationsRun: false,
    synchronize: false,
    logging: false,
    extra: { options: `-c search_path=${env.DATABASE_SCHEMA}` },
  });
}

const env = validateDatabaseEnv(process.env);

export default createDataSource(env);

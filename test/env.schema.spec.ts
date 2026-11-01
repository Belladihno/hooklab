import { describe, expect, it } from 'vitest';
import { validateDatabaseEnv, validateEnv } from '../src/config/env.schema.js';

const validConfig = {
  DATABASE_URL: 'postgres://hooklab:hooklab@127.0.0.1:5432/hooklab',
  JWT_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults for optional values', () => {
    const env = validateEnv(validConfig);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_SCHEMA: 'public',
      LOG_LEVEL: 'info',
    });
  });

  it('rejects missing required values', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects non-postgres connection strings', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects unsafe schema names', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        DATABASE_SCHEMA: 'public; DROP SCHEMA public CASCADE',
      }),
    ).toThrow(/DATABASE_SCHEMA/);
  });

  it('defaults the bcrypt cost to 12', () => {
    expect(validateEnv(validConfig).BCRYPT_COST_ROUNDS).toBe(12);
  });

  it('rejects a weak bcrypt cost in production', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        NODE_ENV: 'production',
        BCRYPT_COST_ROUNDS: '4',
      }),
    ).toThrow(/BCRYPT_COST_ROUNDS/);
  });

  it('allows a low bcrypt cost outside production', () => {
    expect(
      validateEnv({
        ...validConfig,
        NODE_ENV: 'test',
        BCRYPT_COST_ROUNDS: '4',
      }).BCRYPT_COST_ROUNDS,
    ).toBe(4);
  });

  it('requires a JWT secret of at least 32 characters', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(/JWT_SECRET/);

    expect(() =>
      validateEnv({
        DATABASE_URL: validConfig.DATABASE_URL,
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('defaults token lifetimes to 15 minutes, 7 days, and 30 days', () => {
    const env = validateEnv(validConfig);

    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_IDLE_TTL_SECONDS).toBe(604_800);
    expect(env.REFRESH_ABSOLUTE_TTL_SECONDS).toBe(2_592_000);
  });

  it('rejects a refresh idle lifetime longer than the absolute lifetime', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        REFRESH_IDLE_TTL_SECONDS: '2592000',
        REFRESH_ABSOLUTE_TTL_SECONDS: '604800',
      }),
    ).toThrow(/REFRESH_IDLE_TTL_SECONDS/);
  });

  it('validates database configuration without an auth secret', () => {
    const env = validateDatabaseEnv({
      DATABASE_URL: validConfig.DATABASE_URL,
      DATABASE_SCHEMA: 'hooklab_test',
    });

    expect(env.DATABASE_SCHEMA).toBe('hooklab_test');
  });

  it('validates CSRF allowed origins', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        CSRF_ALLOWED_ORIGINS: 'not-a-url',
      }),
    ).toThrow(/CSRF_ALLOWED_ORIGINS/);
  });

  it('defaults auth rate limits', () => {
    const env = validateEnv(validConfig);

    expect(env.AUTH_IP_ATTEMPT_LIMIT).toBe(30);
    expect(env.AUTH_EMAIL_FAILURE_LIMIT).toBe(5);
    expect(env.AUTH_RATE_LIMIT_WINDOW_SECONDS).toBe(900);
  });
});

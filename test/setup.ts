import 'reflect-metadata';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.test', override: true });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.BCRYPT_COST_ROUNDS = '4';
process.env.JWT_SECRET =
  'test-only-jwt-secret-that-is-at-least-32-characters-long';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.REFRESH_IDLE_TTL_SECONDS = '604800';
process.env.REFRESH_ABSOLUTE_TTL_SECONDS = '2592000';
process.env.CSRF_ALLOWED_ORIGINS = 'http://allowed.example.test';
process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '900';
process.env.AUTH_IP_ATTEMPT_LIMIT = '1000';
process.env.AUTH_EMAIL_FAILURE_LIMIT = '100';

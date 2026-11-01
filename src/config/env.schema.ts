import { z } from 'zod';

const databaseUrl = z.string().refine(
  (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    } catch {
      return false;
    }
  },
  { message: 'must be a postgres:// or postgresql:// connection string' },
);

export const databaseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: databaseUrl,
  DATABASE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, 'must be a valid PostgreSQL schema name')
    .default('public'),
});

export const envSchema = databaseEnvSchema
  .extend({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    BCRYPT_COST_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),
    REFRESH_IDLE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(2_592_000)
      .default(604_800),
    REFRESH_ABSOLUTE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(7_776_000)
      .default(2_592_000),
    CSRF_ALLOWED_ORIGINS: z.string().default(''),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(900),
    AUTH_IP_ATTEMPT_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(10_000)
      .default(30),
    AUTH_EMAIL_FAILURE_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(5),
  })
  .superRefine((env, ctx) => {
    for (const value of env.CSRF_ALLOWED_ORIGINS.split(',')) {
      const origin = value.trim();

      if (origin.length === 0) {
        continue;
      }

      try {
        const parsed = new URL(origin);

        if (
          (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
          parsed.origin !== origin
        ) {
          throw new Error('invalid origin');
        }
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['CSRF_ALLOWED_ORIGINS'],
          message: `must contain valid http(s) origins, got "${origin}"`,
        });
      }
    }
    if (env.NODE_ENV === 'production' && env.BCRYPT_COST_ROUNDS < 12) {
      ctx.addIssue({
        code: 'custom',
        path: ['BCRYPT_COST_ROUNDS'],
        message: 'must be at least 12 in production',
      });
    }

    if (env.REFRESH_IDLE_TTL_SECONDS > env.REFRESH_ABSOLUTE_TTL_SECONDS) {
      ctx.addIssue({
        code: 'custom',
        path: ['REFRESH_IDLE_TTL_SECONDS'],
        message: 'must not exceed REFRESH_ABSOLUTE_TTL_SECONDS',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function validateDatabaseEnv(
  config: Record<string, unknown>,
): DatabaseEnv {
  const parsed = databaseEnvSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid database environment configuration: ${issues}`);
  }

  return parsed.data;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return parsed.data;
}

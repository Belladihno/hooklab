import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { AccessGuard } from './common/access/access.guard.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor.js';
import { CsrfGuard } from './common/security/csrf.guard.js';
import { validateEnv } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ProjectsModule } from './projects/projects.module.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const environment = config.get<string>('NODE_ENV') ?? 'development';
        const isDevelopment = environment === 'development';

        return {
          pinoHttp: {
            level: config.get<string>('LOG_LEVEL') ?? 'info',
            autoLogging: environment !== 'test',
            genReqId: (req, res) => {
              const existing = req.headers['x-request-id'];
              const requestId =
                typeof existing === 'string' && UUID_PATTERN.test(existing)
                  ? existing
                  : randomUUID();
              res.setHeader('x-request-id', requestId);
              return requestId;
            },
            redact: {
              censor: '[REDACTED]',
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["proxy-authorization"]',
                'req.headers["x-api-key"]',
                'req.headers["x-auth-token"]',
                'req.headers["x-webhook-secret"]',
                'req.headers["x-webhook-signature"]',
                'req.headers["x-signature"]',
                'req.headers["x-paystack-signature"]',
                'req.headers["stripe-signature"]',
                'req.headers["x-hub-signature"]',
                'req.headers["x-hub-signature-256"]',
                'req.body.password',
                'req.body.passwordHash',
                'res.body.passwordHash',
              ],
            },
            ...(isDevelopment
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      singleLine: true,
                      colorize: true,
                      translateTime: 'SYS:standard',
                    },
                  },
                }
              : {}),
          },
        };
      },
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}

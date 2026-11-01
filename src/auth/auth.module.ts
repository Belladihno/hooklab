import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACCESS_TOKEN_VERIFIER } from '../common/access/access-token-verifier.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthAttemptService } from './auth-attempt.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthAttempt } from './entities/auth-attempt.entity.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { User } from './entities/user.entity.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthAttemptRepository } from './repositories/auth-attempt.repository.js';
import { AuthSessionRepository } from './repositories/auth-session.repository.js';
import { UserRepository } from './repositories/user.repository.js';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([User, AuthSession, AuthAttempt]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthAttemptService,
    UserRepository,
    AuthSessionRepository,
    AuthAttemptRepository,
    JwtAuthGuard,
    {
      provide: ACCESS_TOKEN_VERIFIER,
      useExisting: JwtAuthGuard,
    },
  ],
  exports: [
    UserRepository,
    AuthSessionRepository,
    JwtModule,
    JwtAuthGuard,
    ACCESS_TOKEN_VERIFIER,
  ],
})
export class AuthModule {}

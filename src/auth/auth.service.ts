import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { uuidV7 } from '../database/uuid-v7.js';
import { AuthAttemptService } from './auth-attempt.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UserResponseDto } from './dto/response/user.response.dto.js';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error.js';
import { toUserResponse } from './mappers/user.mapper.js';
import {
  createRefreshToken,
  parseRefreshToken,
  refreshTokenMatches,
} from './refresh-token.js';
import { AuthSessionRepository } from './repositories/auth-session.repository.js';
import { UserRepository } from './repositories/user.repository.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: UserResponseDto;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly bcryptCostRounds: number;
  private readonly accessTtlSeconds: number;
  private readonly refreshIdleTtlSeconds: number;
  private readonly refreshAbsoluteTtlSeconds: number;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly attempts: AuthAttemptService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.bcryptCostRounds = config.get<number>('BCRYPT_COST_ROUNDS') ?? 12;
    this.accessTtlSeconds = config.get<number>('JWT_ACCESS_TTL_SECONDS') ?? 900;
    this.refreshIdleTtlSeconds =
      config.get<number>('REFRESH_IDLE_TTL_SECONDS') ?? 604_800;
    this.refreshAbsoluteTtlSeconds =
      config.get<number>('REFRESH_ABSOLUTE_TTL_SECONDS') ?? 2_592_000;
  }

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptCostRounds);

    try {
      const user = await this.users.create({
        email: dto.email.trim().toLowerCase(),
        passwordHash,
      });

      return toUserResponse(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  async login(dto: LoginDto, ip: string): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const emailHash = this.attempts.hashEmail(email);
    const now = new Date();

    await this.attempts.assertLoginAllowed(emailHash, ip, now);

    const user = await this.users.findByEmailForAuth(email);

    if (!user) {
      // Burn the same bcrypt work as a real check so response timing does not
      // reveal whether the email exists.
      await bcrypt.hash(dto.password, this.bcryptCostRounds);
      await this.attempts.recordLogin(emailHash, ip, 'failure', new Date());
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.attempts.recordLogin(emailHash, ip, 'failure', new Date());
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionId = uuidV7();
    const refresh = createRefreshToken(sessionId);

    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: refresh.hash,
      expiresAt: this.after(now, this.refreshAbsoluteTtlSeconds),
      idleExpiresAt: this.after(now, this.refreshIdleTtlSeconds),
      lastUsedAt: now,
    });
    await this.attempts.recordLogin(emailHash, ip, 'success', now);

    return {
      user: toUserResponse(user),
      tokens: {
        accessToken: await this.signAccess(user.id, sessionId),
        refreshToken: refresh.token,
      },
    };
  }

  async refresh(rawToken: unknown): Promise<AuthResult> {
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const parsed = parseRefreshToken(rawToken);

    if (!parsed) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.sessions.findById(parsed.sessionId);
    const now = new Date();

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.idleExpiresAt <= now
    ) {
      if (session.revokedAt === null) {
        await this.sessions.revoke(session.id, now);
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!refreshTokenMatches(rawToken, session.refreshTokenHash)) {
      await this.sessions.revoke(session.id, now);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findById(session.userId);

    if (!user) {
      await this.sessions.revoke(session.id, now);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const next = createRefreshToken(session.id);
    const rotated = await this.sessions.rotate(
      session.id,
      session.refreshTokenHash,
      next.hash,
      this.after(now, this.refreshIdleTtlSeconds),
      user.id,
      now,
    );

    if (!rotated) {
      await this.sessions.revoke(session.id, now);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return {
      user: toUserResponse(user),
      tokens: {
        accessToken: await this.signAccess(user.id, session.id),
        refreshToken: next.token,
      },
    };
  }

  async logout(rawToken: unknown): Promise<void> {
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      return;
    }

    const parsed = parseRefreshToken(rawToken);

    if (!parsed) {
      return;
    }

    const session = await this.sessions.findById(parsed.sessionId);

    if (!session || !refreshTokenMatches(rawToken, session.refreshTokenHash)) {
      return;
    }

    await this.sessions.revoke(session.id, new Date());
  }

  private signAccess(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      { expiresIn: this.accessTtlSeconds },
    );
  }

  private after(now: Date, seconds: number): Date {
    return new Date(now.getTime() + seconds * 1000);
  }
}

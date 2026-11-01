import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { AuthAttemptRepository } from './repositories/auth-attempt.repository.js';

const LOGIN_ACTION = 'login';

@Injectable()
export class AuthAttemptService {
  private readonly hashSecret: string;
  private readonly windowSeconds: number;
  private readonly emailFailureLimit: number;
  private readonly ipAttemptLimit: number;

  constructor(
    private readonly attempts: AuthAttemptRepository,
    config: ConfigService,
  ) {
    this.hashSecret = config.getOrThrow<string>('JWT_SECRET');
    this.windowSeconds =
      config.get<number>('AUTH_RATE_LIMIT_WINDOW_SECONDS') ?? 900;
    this.emailFailureLimit =
      config.get<number>('AUTH_EMAIL_FAILURE_LIMIT') ?? 5;
    this.ipAttemptLimit = config.get<number>('AUTH_IP_ATTEMPT_LIMIT') ?? 30;
  }

  hashEmail(email: string): string {
    return createHmac('sha256', this.hashSecret).update(email).digest('hex');
  }

  async assertLoginAllowed(
    emailHash: string,
    ip: string,
    now: Date,
  ): Promise<void> {
    const since = new Date(now.getTime() - this.windowSeconds * 1000);
    const [emailFailures, ipAttempts] = await Promise.all([
      this.attempts.countEmailFailures(emailHash, LOGIN_ACTION, since),
      this.attempts.countIpAttempts(ip, since),
    ]);

    if (
      emailFailures >= this.emailFailureLimit ||
      ipAttempts >= this.ipAttemptLimit
    ) {
      throw new HttpException(
        'Too many authentication attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordLogin(
    emailHash: string,
    ip: string,
    outcome: 'failure' | 'success',
    now: Date,
  ): Promise<void> {
    await this.attempts.record({
      emailHash,
      ip,
      action: LOGIN_ACTION,
      outcome,
      createdAt: now,
    });
  }
}

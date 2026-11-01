import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants.js';
import { AuthSessionRepository } from '../repositories/auth-session.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UserRepository,
    private readonly sessions: AuthSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub) ||
      !('sid' in payload) ||
      typeof payload.sid !== 'string' ||
      !isUUID(payload.sid)
    ) {
      throw new UnauthorizedException();
    }

    const session = await this.sessions.findById(payload.sid);
    const now = new Date();

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.idleExpiresAt <= now
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.users.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = { id: user.id, email: user.email };
    return true;
  }
}

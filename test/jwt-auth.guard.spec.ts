import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../src/auth/entities/auth-session.entity.js';
import { User } from '../src/auth/entities/user.entity.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { AuthSessionRepository } from '../src/auth/repositories/auth-session.repository.js';
import { UserRepository } from '../src/auth/repositories/user.repository.js';
import type { AuthenticatedRequest } from '../src/auth/types/authenticated-request.js';

const userId = '00000000-0000-4000-8000-000000000001';
const sessionId = '00000000-0000-4000-8000-000000000002';

const dbUser = {
  id: userId,
  email: 'db@example.com',
  passwordHash: 'hash',
  createdAt: new Date(),
} as User;

function activeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    id: sessionId,
    userId,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    idleExpiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  } as AuthSession;
}

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard() {
  const verifyAsync = vi.fn();
  const findUser = vi.fn().mockResolvedValue(dbUser);
  const findSession = vi.fn().mockResolvedValue(activeSession());

  return {
    guard: new JwtAuthGuard(
      { verifyAsync } as unknown as JwtService,
      { findById: findUser } as unknown as UserRepository,
      { findById: findSession } as unknown as AuthSessionRepository,
    ),
    verifyAsync,
    findUser,
    findSession,
  };
}

describe('JwtAuthGuard', () => {
  it('rejects a request without the access token cookie', async () => {
    const { guard, verifyAsync } = createGuard();

    await expect(
      guard.canActivate(contextFor({ cookies: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('ignores an Authorization header', async () => {
    const { guard, verifyAsync } = createGuard();
    const request = {
      cookies: {},
      headers: { authorization: 'Bearer token' },
    } as Partial<AuthenticatedRequest>;

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const { guard, verifyAsync, findSession } = createGuard();
    verifyAsync.mockRejectedValue(new Error('invalid token'));

    const request = { cookies: { access_token: 'bad' } };

    await expect(
      guard.canActivate(contextFor(request as Partial<AuthenticatedRequest>)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findSession).not.toHaveBeenCalled();
  });

  it('rejects a payload without a valid UUID sub', async () => {
    const { guard, verifyAsync, findSession } = createGuard();
    verifyAsync.mockResolvedValue({ sub: 'not-a-uuid', sid: sessionId });

    const request = { cookies: { access_token: 'token' } };

    await expect(
      guard.canActivate(contextFor(request as Partial<AuthenticatedRequest>)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findSession).not.toHaveBeenCalled();
  });

  it('rejects a payload without a valid session id', async () => {
    const { guard, verifyAsync, findSession } = createGuard();
    verifyAsync.mockResolvedValue({ sub: userId });

    const request = { cookies: { access_token: 'token' } };

    await expect(
      guard.canActivate(contextFor(request as Partial<AuthenticatedRequest>)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findSession).not.toHaveBeenCalled();
  });

  it('loads the user from the database and ignores token claims', async () => {
    const { guard, verifyAsync, findUser, findSession } = createGuard();
    verifyAsync.mockResolvedValue({
      sub: userId,
      sid: sessionId,
      email: 'spoofed@example.com',
    });

    const request = {
      cookies: { access_token: 'token' },
    } as Partial<AuthenticatedRequest>;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(findSession).toHaveBeenCalledWith(sessionId);
    expect(findUser).toHaveBeenCalledWith(userId);
    expect(request.user).toEqual({ id: userId, email: 'db@example.com' });
  });

  it('rejects a valid token whose session was revoked', async () => {
    const { guard, verifyAsync, findSession } = createGuard();
    verifyAsync.mockResolvedValue({ sub: userId, sid: sessionId });
    findSession.mockResolvedValue(activeSession({ revokedAt: new Date() }));

    const request = { cookies: { access_token: 'token' } };

    await expect(
      guard.canActivate(contextFor(request as Partial<AuthenticatedRequest>)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a valid token whose session expired', async () => {
    const { guard, verifyAsync, findSession } = createGuard();
    verifyAsync.mockResolvedValue({ sub: userId, sid: sessionId });
    findSession.mockResolvedValue(
      activeSession({ expiresAt: new Date(Date.now() - 1) }),
    );

    const request = { cookies: { access_token: 'token' } };

    await expect(
      guard.canActivate(contextFor(request as Partial<AuthenticatedRequest>)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const { guard, verifyAsync, findUser } = createGuard();
    verifyAsync.mockResolvedValue({ sub: userId, sid: sessionId });
    findUser.mockResolvedValue(null);

    const request = { cookies: { access_token: 'token' } };

    await expect(
      guard.canActivate(contextFor(request as Partial<AuthenticatedRequest>)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createRefreshToken,
  hashRefreshToken,
  parseRefreshToken,
  refreshTokenMatches,
} from '../src/auth/refresh-token.js';
import { uuidV7 } from '../src/database/uuid-v7.js';

describe('refresh tokens', () => {
  it('creates an 80-character session-id.secret token', () => {
    const sessionId = uuidV7();
    const { token } = createRefreshToken(sessionId);

    expect(token).toHaveLength(80);
    expect(token.startsWith(`${sessionId}.`)).toBe(true);
  });

  it('parses a valid token and hashes the whole token', () => {
    const sessionId = uuidV7();
    const { token } = createRefreshToken(sessionId);
    const parsed = parseRefreshToken(token);

    expect(parsed?.sessionId).toBe(sessionId);
    expect(parsed?.hash).toBe(hashRefreshToken(token));
  });

  it('rejects malformed tokens', () => {
    expect(parseRefreshToken('')).toBeNull();
    expect(parseRefreshToken('not-a-uuid.secret')).toBeNull();
    expect(parseRefreshToken(`${uuidV7()}.short`)).toBeNull();
    expect(parseRefreshToken(`${uuidV7()}.${'a'.repeat(42)}`)).toBeNull();
  });

  it('matches only the expected hash', () => {
    const { token, hash } = createRefreshToken(uuidV7());
    const other = createRefreshToken(uuidV7());

    expect(refreshTokenMatches(token, hash)).toBe(true);
    expect(refreshTokenMatches(other.token, hash)).toBe(false);
  });

  it('generates a new secret on every call', () => {
    const sessionId = uuidV7();
    const first = createRefreshToken(sessionId);
    const second = createRefreshToken(sessionId);

    expect(first.token).not.toBe(second.token);
    expect(first.hash).not.toBe(second.hash);
  });
});

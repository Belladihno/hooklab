import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isUUID } from 'class-validator';

const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface RefreshToken {
  token: string;
  hash: string;
}

export interface ParsedRefreshToken {
  sessionId: string;
  hash: string;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createRefreshToken(sessionId: string): RefreshToken {
  const secret = randomBytes(32).toString('base64url');
  const token = `${sessionId}.${secret}`;

  return { token, hash: hashRefreshToken(token) };
}

export function parseRefreshToken(token: string): ParsedRefreshToken | null {
  const separator = token.indexOf('.');

  if (separator <= 0) {
    return null;
  }

  const sessionId = token.slice(0, separator);
  const secret = token.slice(separator + 1);

  if (!isUUID(sessionId) || !SECRET_PATTERN.test(secret)) {
    return null;
  }

  return { sessionId, hash: hashRefreshToken(token) };
}

export function refreshTokenMatches(
  token: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashRefreshToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

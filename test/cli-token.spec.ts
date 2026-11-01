import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CLI_TOKEN_PREFIX,
  generateCliToken,
  hashCliToken,
} from '../src/auth/cli-token.js';

describe('CLI token', () => {
  it('generates a prefixed 32-byte base64url token', () => {
    const token = generateCliToken();

    expect(token.raw.startsWith(CLI_TOKEN_PREFIX)).toBe(true);

    const encoded = token.raw.slice(CLI_TOKEN_PREFIX.length);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(encoded, 'base64url')).toHaveLength(32);
  });

  it('hashes the full token with SHA-256', () => {
    const token = generateCliToken();

    expect(token.hash).toBe(
      createHash('sha256').update(token.raw, 'utf8').digest('hex'),
    );
    expect(hashCliToken(token.raw)).toBe(token.hash);
  });
});

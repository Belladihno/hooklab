import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateEndpointKey,
  hashEndpointKey,
} from '../src/projects/endpoint-key.js';

describe('endpoint keys', () => {
  it('generates a 43-character base64url key from 32 random bytes', () => {
    const { raw } = generateEndpointKey();

    expect(raw).toHaveLength(43);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('stores a lowercase SHA-256 hex hash', () => {
    const { raw, hash } = generateEndpointKey();

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(raw, 'utf8').digest('hex'));
  });

  it('hashes the same raw key deterministically', () => {
    const { raw } = generateEndpointKey();

    expect(hashEndpointKey(raw)).toBe(hashEndpointKey(raw));
  });

  it('generates a different key on every call', () => {
    const keys = new Set(
      Array.from({ length: 100 }, () => generateEndpointKey().raw),
    );

    expect(keys.size).toBe(100);
  });

  it('never returns the raw key as its hash', () => {
    const { raw, hash } = generateEndpointKey();

    expect(hash).not.toBe(raw);
  });
});

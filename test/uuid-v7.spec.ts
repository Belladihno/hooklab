import { describe, expect, it } from 'vitest';
import { uuidV7 } from '../src/database/uuid-v7.js';

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV7', () => {
  it('produces a valid version 7 UUID with the RFC variant', () => {
    expect(uuidV7()).toMatch(UUID_V7_PATTERN);
  });

  it('orders IDs by timestamp', () => {
    expect(uuidV7(1_000).localeCompare(uuidV7(2_000))).toBe(-1);
  });

  it('produces unique values', () => {
    const ids = new Set(Array.from({ length: 1_000 }, () => uuidV7()));

    expect(ids.size).toBe(1_000);
  });

  it('rejects timestamps outside the 48-bit range', () => {
    expect(() => uuidV7(-1)).toThrow(/timestamp/i);
    expect(() => uuidV7(2 ** 48)).toThrow(/timestamp/i);
  });
});

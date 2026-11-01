import { randomBytes } from 'node:crypto';

const MAX_TIMESTAMP = 2 ** 48 - 1;

export function uuidV7(timestamp: number = Date.now()): string {
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    timestamp > MAX_TIMESTAMP
  ) {
    throw new Error('UUIDv7 timestamp must be a 48-bit non-negative integer');
  }

  const bytes = randomBytes(16);
  bytes.writeUIntBE(timestamp, 0, 6);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);

  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

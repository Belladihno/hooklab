import { createHash, randomBytes } from 'node:crypto';

const ENDPOINT_KEY_BYTES = 32;

export interface EndpointKey {
  raw: string;
  hash: string;
}

export function hashEndpointKey(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateEndpointKey(): EndpointKey {
  const raw = randomBytes(ENDPOINT_KEY_BYTES).toString('base64url');

  return { raw, hash: hashEndpointKey(raw) };
}

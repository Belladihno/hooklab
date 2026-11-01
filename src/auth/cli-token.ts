import { createHash, randomBytes } from 'node:crypto';

export const CLI_TOKEN_PREFIX = 'hl_cli_';

const CLI_TOKEN_BYTES = 32;

export interface CliTokenSecret {
  raw: string;
  hash: string;
}

export function hashCliToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateCliToken(): CliTokenSecret {
  const raw = `${CLI_TOKEN_PREFIX}${randomBytes(CLI_TOKEN_BYTES).toString('base64url')}`;

  return { raw, hash: hashCliToken(raw) };
}

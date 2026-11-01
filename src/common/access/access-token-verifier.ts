import type { ExecutionContext } from '@nestjs/common';

export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');

export interface AccessTokenVerifier {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

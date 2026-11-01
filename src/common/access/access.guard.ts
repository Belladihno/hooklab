import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_TOKEN_VERIFIER } from './access-token-verifier.js';
import type { AccessTokenVerifier } from './access-token-verifier.js';
import { ACCESS_METADATA_KEY, AccessLevel } from './access.decorators.js';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly tokenVerifier: AccessTokenVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const access = this.reflector.getAllAndOverride<AccessLevel>(
      ACCESS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (access === undefined) {
      throw new ForbiddenException('Route access is not declared');
    }

    if (access === 'public') {
      return true;
    }

    return this.tokenVerifier.canActivate(context);
  }
}

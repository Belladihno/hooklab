import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(config: ConfigService) {
    this.allowedOrigins = new Set(
      (config.get<string>('CSRF_ALLOWED_ORIGINS') ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (
      !request.path.startsWith('/api/v1/') ||
      !UNSAFE_METHODS.has(request.method)
    ) {
      return true;
    }

    const originHeader = request.get('origin');
    const refererHeader = request.get('referer');

    if (!originHeader && !refererHeader) {
      return true;
    }

    const origin = originHeader ?? originOf(refererHeader ?? '');

    if (origin === null) {
      throw new ForbiddenException('Invalid request origin');
    }

    const host = request.get('host');
    const sameOrigin = host ? `${request.protocol}://${host}` : null;

    if (origin === sameOrigin || this.allowedOrigins.has(origin)) {
      return true;
    }

    throw new ForbiddenException('Invalid request origin');
  }
}

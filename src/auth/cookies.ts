import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from './auth.constants.js';
import type { AuthTokens } from './auth.service.js';

export interface CookieTtls {
  accessTtlSeconds: number;
  refreshAbsoluteTtlSeconds: number;
  isProduction: boolean;
}

function baseOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
  };
}

export function setAuthCookies(
  response: Response,
  tokens: AuthTokens,
  ttl: CookieTtls,
): void {
  const base = baseOptions(ttl.isProduction);

  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: ttl.accessTtlSeconds * 1000,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    path: REFRESH_COOKIE_PATH,
    maxAge: ttl.refreshAbsoluteTtlSeconds * 1000,
  });
}

export function clearAuthCookies(
  response: Response,
  isProduction: boolean,
): void {
  const base = baseOptions(isProduction);

  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base,
    path: REFRESH_COOKIE_PATH,
  });
}

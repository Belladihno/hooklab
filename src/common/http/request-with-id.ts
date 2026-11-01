import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

export type RequestWithId = Request;

export function requestIdOf(
  request: RequestWithId,
  response: Response,
): string {
  if (typeof request.id === 'string' && request.id.length > 0) {
    return request.id;
  }

  const header = response.getHeader('x-request-id');

  return typeof header === 'string' && header.length > 0
    ? header
    : randomUUID();
}

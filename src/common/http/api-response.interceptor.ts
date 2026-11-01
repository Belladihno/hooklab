import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { RequestWithId, requestIdOf } from './request-with-id.js';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (
          request.path.startsWith('/health') ||
          response.statusCode === 204 ||
          data === undefined
        ) {
          return data;
        }

        return {
          success: true,
          message: 'OK',
          data: data ?? null,
          error: null,
          meta: { requestId: requestIdOf(request, response) },
        };
      }),
    );
  }
}

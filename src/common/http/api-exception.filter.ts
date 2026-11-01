import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorCodeForStatus } from '../errors/error-codes.js';
import { RequestWithId, requestIdOf } from './request-with-id.js';

interface HttpErrorBody {
  message?: string | string[];
  error?: string;
}

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = requestIdOf(request, response);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (
      request.path.startsWith('/health') &&
      exception instanceof HttpException
    ) {
      response.status(status).json(exception.getResponse());
      return;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          requestId,
          status,
          errorName:
            exception instanceof Error ? exception.name : typeof exception,
          errorCode:
            typeof exception === 'object' &&
            exception !== null &&
            'code' in exception
              ? String(exception.code)
              : undefined,
        },
        'Unhandled request failure',
      );
    }

    const { message, details } = this.describe(exception, status);

    response.status(status).json({
      success: false,
      message,
      data: null,
      error: {
        code: errorCodeForStatus(status),
        message,
        ...(details === undefined ? {} : { details }),
      },
      meta: { requestId },
    });
  }

  private describe(
    exception: unknown,
    status: number,
  ): { message: string; details?: Record<string, unknown> } {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return { message: 'An unexpected error occurred' };
    }

    if (!(exception instanceof HttpException)) {
      return { message: 'An unexpected error occurred' };
    }

    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { message: body };
    }

    const errorBody = body as HttpErrorBody;

    if (Array.isArray(errorBody.message)) {
      return {
        message: 'Validation failed',
        details: { messages: errorBody.message },
      };
    }

    return {
      message: errorBody.message ?? exception.message,
    };
  }
}

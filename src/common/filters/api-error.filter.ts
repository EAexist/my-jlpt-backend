import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiError, API_ERROR_CODES } from '../api/api-constants';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: ApiError = {
      code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
      detail: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'code' in exceptionResponse &&
        'detail' in exceptionResponse
      ) {
        error = exceptionResponse as ApiError;
      } else {
        error = {
          code: 'HTTP_ERROR',
          detail: (exception as Error).message,
        };
      }
    } else if (exception instanceof Error) {
      error = {
        code: 'UNKNOWN_ERROR',
        detail: exception.message,
      };
    }

    response.status(status).json({
      error,
    });
  }
}

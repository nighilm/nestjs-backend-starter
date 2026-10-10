import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseRecord =
      typeof responseBody === 'object' && responseBody !== null
        ? (responseBody as Record<string, unknown>)
        : undefined;
    const rawMessage =
      typeof responseBody === 'string' ? responseBody : responseRecord?.message;
    const message =
      status >= 500
        ? 'Internal server error'
        : status === 400 && Array.isArray(rawMessage)
          ? 'Validation failed'
          : typeof rawMessage === 'string'
            ? rawMessage
            : 'Request failed';
    const error =
      responseRecord && typeof responseRecord.error === 'string'
        ? responseRecord.error
        : (HttpStatus[status] ?? 'Error').replaceAll('_', ' ');

    if (status >= 500) {
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

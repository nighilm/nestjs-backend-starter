import {
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
} from '@nestjs/common';

type ConsoleMethod = 'log' | 'error' | 'warn' | 'debug' | 'info';

@Injectable()
export class AppLogger implements NestLoggerService {
  private readonly logger = console;

  private mapLevel(level: LogLevel): ConsoleMethod {
    switch (level) {
      case 'log':
        return 'log';

      case 'error':
        return 'error';

      case 'warn':
        return 'warn';

      case 'debug':
        return 'debug';

      case 'verbose':
        return 'info';

      default:
        return 'log';
    }
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.logger.log(message, ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.logger.error(message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.logger.warn(message, ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug(message, ...optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.logger.info(message, ...optionalParams);
  }
}

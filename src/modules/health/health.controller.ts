import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service.js';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  @HealthCheck()
  async healthCheck() {
    return this.health.check([
      async () => {
        await this.prisma.$queryRaw`SELECT 1`;

        return {
          database: {
            status: 'up',
            message: 'Database connection is healthy',
          },
        };
      },
    ]);
  }
}

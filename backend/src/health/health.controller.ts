import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok' | 'error';
  db: 'ok' | 'fail';
  uptime: number;
  lastBackupAt?: string | null;
  version: string;
  timestamp: string;
}

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Tizim va ma’lumotlar bazasi salomatligini tekshirish (Health Check)' })
  @ApiResponse({ status: 200, description: 'Tizim va ma’lumotlar bazasi to‘liq ishlamoqda' })
  @ApiResponse({ status: 503, description: 'Ma’lumotlar bazasi bilan aloqa uzilgan' })
  async checkHealth(@Res() res: Response) {
    let dbStatus: 'ok' | 'fail' = 'ok';
    let lastBackupAt: string | null = null;

    try {
      // 1. Check database connectivity with simple lightweight query
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'fail';
    }

    if (dbStatus === 'ok') {
      try {
        // 2. Fetch last completed backup record timestamp
        const lastBackup = await this.prisma.backupRecord.findFirst({
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true, createdAt: true },
        });

        lastBackupAt =
          lastBackup?.completedAt?.toISOString() ||
          lastBackup?.createdAt?.toISOString() ||
          null;
      } catch {
        lastBackupAt = null;
      }
    }

    const isHealthy = dbStatus === 'ok';
    const responsePayload: HealthResponse = {
      status: isHealthy ? 'ok' : 'error',
      db: dbStatus,
      uptime: Math.round(process.uptime()),
      lastBackupAt,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    };

    return res
      .status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(responsePayload);
  }
}

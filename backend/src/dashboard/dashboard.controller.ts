import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('analytics')
  @ApiOperation({
    summary:
      'Universitet boshqaruv konsoli: moliyaviy balans, amortizatsiya, moliyalashtirish manbalari va ombor tahlili',
  })
  async getAnalytics() {
    return this.dashboardService.getAnalytics();
  }
}

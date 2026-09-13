import { Controller, Get, Post, Query, Body, UseGuards, Request, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';
import { HemisSyncDto, UzAsboExportQueryDto } from './integrations.dto';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('hemis/status')
  @Roles('SUPER_ADMIN', 'HEAD_WAREHOUSE')
  @ApiOperation({ summary: 'HEMIS integratsiyasi holati va statistikasi' })
  async getHemisStatus() {
    return this.integrationsService.getHemisStatus();
  }

  @Post('hemis/sync')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'HEMIS tizimi bilan kafedra va xonalarni sinxronlashtirish' })
  async syncHemis(@Request() req: any, @Body() dto: HemisSyncDto) {
    return this.integrationsService.syncHemis(dto, req.user.id);
  }

  @Get('uzasbo/export')
  @Roles('SUPER_ADMIN', 'HEAD_WAREHOUSE', 'AUDITOR')
  @ApiOperation({ summary: '1C / UzASBO buxgalteriya formati bo‘yicha eksport qilish' })
  async exportUzAsbo(@Request() req: any, @Query() query: UzAsboExportQueryDto) {
    return this.integrationsService.exportUzAsbo(query, req.user.id);
  }
}

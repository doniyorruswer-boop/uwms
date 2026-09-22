import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemAuditService } from './system-audit.service';
import { QuerySystemAuditDto } from './system-audit.dto';
import { RoleType } from '@prisma/client';

@ApiTags('system-audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/system-audit')
export class SystemAuditController {
  constructor(private readonly systemAuditService: SystemAuditService) {}

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.AUDITOR,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.HEAD_WAREHOUSE,
  )
  @ApiOperation({ summary: 'Tizim xavfsizlik audit jurnali' })
  async getLogs(@Query() query: QuerySystemAuditDto) {
    return this.systemAuditService.findAll(query);
  }
}

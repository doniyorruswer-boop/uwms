import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuotasService } from './quotas.service';
import { SetQuotaDto, UpdateQuotaDto, QueryQuotaDto, CheckQuotaDto } from './quota.dto';

@ApiTags('quotas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/quotas')
export class QuotasController {
  constructor(private readonly quotasService: QuotasService) {}

  @Get()
  @ApiOperation({ summary: 'Kafedralar oylik kvotalari ro‘yxati' })
  async getQuotas(@Query() query: QueryQuotaDto) {
    return this.quotasService.findAll(query);
  }

  @Get('check')
  @ApiOperation({ summary: 'Talabnoma uchun kafedra kvotasini tekshirish' })
  async checkQuota(@Query() query: CheckQuotaDto) {
    return this.quotasService.checkQuota(query);
  }

  @Post()
  @Roles('VICE_RECTOR_FINANCE')
  @ApiOperation({ summary: 'Kafedra uchun oylik kvota belgilash yoki yangilash' })
  async setQuota(@Request() req: any, @Body() dto: SetQuotaDto) {
    return this.quotasService.setQuota(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('VICE_RECTOR_FINANCE')
  @ApiOperation({ summary: 'Kvota limitini tahrirlash' })
  async updateQuota(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuotaDto,
  ) {
    return this.quotasService.updateQuota(id, dto, req.user.id);
  }
}

import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { ReplenishStockDto } from './dto/warehouse.dto';

@ApiTags('Warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/warehouse')
export class WarehouseController {
  constructor(private warehouseService: WarehouseService) {}

  @Get('stocks')
  @ApiOperation({ summary: 'Ombordagi barcha sarf tovarlari qoldiqlari (qidiruv va sahifalash bilan)' })
  async getStocks(@Query() query: { search?: string; categoryId?: string; page?: string; limit?: string }) {
    return this.warehouseService.getStocks(query);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Barcha ombor harakatlari va tranzaksiyalar jurnali (qidiruv va sahifalash bilan)' })
  async getMovements(@Query() query: { search?: string; type?: string; page?: string; limit?: string }) {
    return this.warehouseService.getMovements(query);
  }

  @Post('stocks/:id/replenish')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Omborga kirim qilish (faqat Bosh Omborchi va Admin)' })
  async replenishStock(
    @Param('id') id: string,
    @Body() dto: ReplenishStockDto,
    @CurrentUser() user: any,
  ) {
    return this.warehouseService.replenishStock(id, dto.amount, user?.id);
  }

  @Post('ingest')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ta’minotchi va faktura orqali omborga to‘liq kirim qilish (OS-1 shakli bilan)' })
  async ingestStock(@Body() dto: any, @CurrentUser() user: any) {
    return this.warehouseService.ingestStock({ ...dto, executedById: user?.id });
  }

  @Post('transfer')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Omborlararo mahsulot ko‘chirish (Inter-Warehouse Transfer)' })
  async transferStock(
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.warehouseService.transferBetweenWarehouses(dto, user?.id);
  }
}


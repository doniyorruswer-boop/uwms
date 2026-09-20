import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { ReplenishStockDto, IngestStockDto, InterWarehouseTransferDto } from './dto/warehouse.dto';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse-crud.dto';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';

@ApiTags('Warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(IdempotencyInterceptor)
@Controller('api/warehouse')
export class WarehouseController {
  constructor(private warehouseService: WarehouseService) {}

  @Get('stocks')
  @ApiOperation({ summary: 'Ombordagi barcha sarf tovarlari qoldiqlari (qidiruv va sahifalash bilan)' })
  async getStocks(@Query() query: { search?: string; categoryId?: string; fundingSource?: string; page?: string; limit?: string }) {
    return this.warehouseService.getStocks(query);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Minimal qoldiqdan past sarf tovarlari ro‘yxati' })
  async getLowStock() {
    return this.warehouseService.getLowStockItems();
  }

  @Get('movements')
  @ApiOperation({ summary: 'Barcha ombor harakatlari va tranzaksiyalar jurnali (qidiruv va sahifalash bilan)' })
  async getMovements(@Query() query: { search?: string; type?: string; fundingSource?: string; page?: string; limit?: string }) {
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
    return this.warehouseService.replenishStock(id, dto.amount, user?.id, dto.fundingSource);
  }

  @Post('ingest')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ta’minotchi va faktura orqali omborga to‘liq kirim qilish (OS-1 shakli bilan)' })
  async ingestStock(@Body() dto: IngestStockDto, @CurrentUser() user: any) {
    return this.warehouseService.ingestStock({ ...dto, executedById: user?.id });
  }

  @Post('transfer')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Omborlararo mahsulot ko‘chirish (Inter-Warehouse Transfer)' })
  async transferStock(
    @Body() dto: InterWarehouseTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.warehouseService.transferBetweenWarehouses(dto, user?.id);
  }

  // ==================== WAREHOUSE CRUD ====================

  @Get('list')
  @ApiOperation({ summary: 'Barcha omborxonalar va ularning binolari ro‘yxati' })
  async getAllWarehouses(@Query('showDeleted') showDeleted?: string) {
    return this.warehouseService.getAllWarehouses(showDeleted === 'true');
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Yangi omborxona yaratish (Super Admin va Bosh omborchi)' })
  async createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: any,
  ) {
    return this.warehouseService.createWarehouse(dto, user?.id);
  }

  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Omborxona ma’lumotlarini tahrirlash' })
  async updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: any,
  ) {
    return this.warehouseService.updateWarehouse(id, dto, user?.id);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Omborxonani o‘chirish (Faqat Super Admin)' })
  async deleteWarehouse(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.warehouseService.deleteWarehouse(id, user?.id);
  }

  @Post(':id/restore')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'O‘chirilgan omborni qayta tiklash (Faqat Super Admin)' })
  async restoreWarehouse(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.warehouseService.restoreWarehouse(id, user?.id);
  }
}

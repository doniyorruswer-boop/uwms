import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.CHIEF_ACCOUNTANT, RoleType.AUDITOR)
@Controller('api/suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha ta’minotchilar (kontragentlar) ro‘yxati' })
  async getAllSuppliers(@Query() query: QuerySuppliersDto) {
    return this.suppliersService.getAllSuppliers(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Ta’minotchilar va shartnomalar bo‘yicha umumiy KPI statistika' })
  async getSupplierStats() {
    return this.suppliersService.getSupplierStats();
  }

  @Get('next-codes')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Navbatdagi unikal INN, shartnoma va faktura kodlarini olish' })
  async getNextCodes() {
    return this.suppliersService.getNextCodes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ta’minotchi batafsil ma’lumoti va unga tegishli fakturalar' })
  async getSupplierById(@Param('id') id: string) {
    return this.suppliersService.getSupplierById(id);
  }

  @Post()
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Yangi ta’minotchi qo‘shish' })
  async createSupplier(@Body() dto: CreateSupplierDto, @Request() req: any) {
    return this.suppliersService.createSupplier(dto, req.user?.id);
  }

  @Put(':id')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Ta’minotchi ma’lumotlarini tahrirlash' })
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @Request() req: any,
  ) {
    return this.suppliersService.updateSupplier(id, dto, req.user?.id);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Ta’minotchini xavfsiz o‘chirish (Soft delete)' })
  async deleteSupplier(@Param('id') id: string, @Request() req: any) {
    return this.suppliersService.deleteSupplier(id, req.user?.id);
  }

  @Post(':id/restore')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'O‘chirilgan ta’minotchini qayta tiklash (Restore)' })
  async restoreSupplier(@Param('id') id: string, @Request() req: any) {
    return this.suppliersService.restoreSupplier(id, req.user?.id);
  }

  @Get(':id/invoices')
  @ApiOperation({ summary: 'Ta’minotchining barcha hisob-fakturalari' })
  async getSupplierInvoices(@Param('id') id: string) {
    return this.suppliersService.getSupplierInvoices(id);
  }

  @Post(':id/invoices')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Shartnoma doirasida yangi hisob-faktura kiritish' })
  async createInvoice(
    @Param('id') id: string,
    @Body() dto: CreateInvoiceDto,
    @Request() req: any,
  ) {
    return this.suppliersService.createInvoice(id, dto, req.user?.id);
  }
}

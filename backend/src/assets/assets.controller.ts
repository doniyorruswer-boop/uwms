import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import {
  CreateAssetDto,
  TransferAssetDto,
  BatchTransferAssetDto,
  WriteOffAssetDto,
  RespondTransferDto,
  ImportExcelAssetsDto,
  ReturnAssetDto,
  MassMolHandoffDto,
  ReprintQrDto,
} from './dto/asset.dto';

@ApiTags('Assets')

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Get('transfers')
  @ApiOperation({ summary: 'Asosiy vositalar ko‘chirish va topshirish arizalari ro‘yxati' })
  async getTransfers(
    @Query() query: { status?: string; receiverId?: string; assetId?: string },
    @CurrentUser() user: any,
  ) {
    // If user is MOL, they can default to viewing transfers where they are receiver or sender
    return this.assetsService.getTransfers(query);
  }

  @Patch('transfers/:id/respond')
  @Roles(RoleType.MOL, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Topshirish-qabul qilish dalolatnomasini tasdiqlash yoki rad etish (OS-1)' })
  async respondTransfer(
    @Param('id') id: string,
    @Body() dto: RespondTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.respondTransfer(id, {
      ...dto,
      responderId: user?.id,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Asosiy vositalar ro‘yxati (qidiruv, filtr bilan)' })
  async getAllAssets(@Query() query: { search?: string; status?: string; roomId?: string; page?: string; limit?: string }) {
    return this.assetsService.getAllAssets(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta vositaning to‘liq pasporti va harakatlar tarixi' })
  async getAssetById(@Param('id') id: string) {
    return this.assetsService.getAssetById(id);
  }

  @Post()
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Yangi asosiy vosita kirim qilish (faqat Bosh Omborchi va Admin)' })
  async createAsset(@Body() dto: CreateAssetDto, @CurrentUser() user: any) {
    return this.assetsService.createAsset({
      ...dto,
      executedById: user?.id,
    });
  }

  @Patch(':id/transfer')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.MOL, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Uskunani boshqa xonaga ko‘chirish' })
  async transferAsset(
    @Param('id') id: string,
    @Body() dto: TransferAssetDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.transferAsset(id, {
      ...dto,
      executedById: user?.id,
    });
  }

  @Post('batch-transfer')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bir nechta uskunani bir vaqtda ko‘chirish (Ommaviy)' })
  async transferBatch(
    @Body() dto: BatchTransferAssetDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.transferBatch({
      ...dto,
      executedById: user?.id,
    });
  }

  @Post('import-excel')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mavjud asosiy vositalarni Excel orqali ommaviy yuklash' })
  async importExcel(
    @Body() dto: ImportExcelAssetsDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.importExcelAssets(dto, user?.id);
  }

  @Patch(':id/write-off')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Uskunani hisobdan chiqarish (Spisanie)' })
  async writeOffAsset(
    @Param('id') id: string,
    @Body() dto: WriteOffAssetDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.writeOffAsset(id, {
      ...dto,
      executedById: user?.id,
    });
  }

  @Post('return')
  @Roles(RoleType.MOL, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Asosiy vositani kafedradan markaziy omborga qaytarish arizasi' })
  async returnAsset(
    @Body() dto: ReturnAssetDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.returnAsset(dto, user?.id);
  }

  @Post('mass-mol-handoff')
  @Roles(RoleType.MOL, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'MOL (Moddiy javobgar shaxs) yalpi almashinuvi dalolatnomasi' })
  async massMolHandoff(
    @Body() dto: MassMolHandoffDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.massMolHandoff(dto, user?.id);
  }

  @Post(':id/reprint-qr')
  @Roles(RoleType.MOL, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.AUDITOR)
  @ApiOperation({ summary: 'QR-stikerni qayta chop etish sababini audit jurnaliga yozish' })
  async reprintQr(
    @Param('id') id: string,
    @Body() dto: ReprintQrDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.reprintQr(id, dto.reason, user?.id);
  }
}


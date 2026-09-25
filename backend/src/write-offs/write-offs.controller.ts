import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WriteOffsService } from './write-offs.service';
import { CreateWriteOffDto, VoteWriteOffDto } from './dto/write-off.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType, WriteOffStatus } from '@prisma/client';

@ApiTags('Write-offs (Spisanie)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/write-offs')
export class WriteOffsController {
  constructor(private readonly writeOffsService: WriteOffsService) {}

  @Get()
  @ApiOperation({ summary: 'Hisobdan chiqarish (Spisanie) arizalari va komissiya ovozlari ro‘yxati' })
  async getWriteOffs(@Query() query: { status?: WriteOffStatus; assetId?: string }) {
    return this.writeOffsService.getWriteOffs(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta hisobdan chiqarish hujjati va barcha komissiya a’zolari ovozlari' })
  async getWriteOffById(@Param('id') id: string) {
    return this.writeOffsService.getWriteOffById(id);
  }

  @Post()
  @Roles(RoleType.MOL, RoleType.HEAD_WAREHOUSE, RoleType.COMMENDANT, RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Yangi hisobdan chiqarish jarayonini boshlash va komissiya tuzish (OS-4)' })
  async createWriteOff(@Body() dto: CreateWriteOffDto, @CurrentUser() user: any) {
    return this.writeOffsService.createWriteOff(dto, user?.id);
  }

  @Post(':id/vote')
  @Roles(
    RoleType.MOL,
    RoleType.HEAD_WAREHOUSE,
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.COMMENDANT,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.AUDITOR,
  )
  @ApiOperation({ summary: 'Komissiya a’zosi sifatida elektron ovoz berish (Tasdiqlash / Rad etish)' })
  async voteWriteOff(
    @Param('id') id: string,
    @Body() dto: VoteWriteOffDto,
    @CurrentUser() user: any,
  ) {
    return this.writeOffsService.voteWriteOff(id, user?.id, dto);
  }
}

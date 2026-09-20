import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { DocumentArchivesService } from './document-archives.service';
import {
  GenerateArchiveDto,
  CancelArchiveDto,
  QueryArchiveDto,
} from './document-archives.dto';

@ApiTags('document-archives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/document-archives')
export class DocumentArchivesController {
  constructor(private readonly documentArchivesService: DocumentArchivesService) {}

  @Post('generate')
  @Roles(RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE, RoleType.MOL, RoleType.AUDITOR)
  @ApiOperation({ summary: 'Rasmiy hujjatni versiyalash va elektron arxivlash' })
  async generateArchive(
    @Body() dto: GenerateArchiveDto,
    @CurrentUser() user: any,
  ) {
    return this.documentArchivesService.generateAndArchive(dto, user?.userId || user?.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.AUDITOR,
    RoleType.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Hujjat arxivlari va versiyalari tarixini olish' })
  async getHistory(@Query() query: QueryArchiveDto) {
    return this.documentArchivesService.getHistory(query);
  }

  @Get('handover/:handoverId')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.AUDITOR,
    RoleType.EMPLOYEE,
    RoleType.COMMENDANT,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.VICE_RECTOR_FINANCE,
  )
  @ApiOperation({ summary: 'Moddiy javobgarlik topshirish dalolatnomasi (OS-1) rasmiy hujjatini olish' })
  async getHandoverAct(@Param('handoverId') handoverId: string, @CurrentUser() user: any) {
    return this.documentArchivesService.getHandoverDocument(handoverId, user?.userId || user?.id);
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.AUDITOR,
    RoleType.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Bitta arxiv yozuvi tafsilotini olish' })
  async getArchiveById(@Param('id') id: string) {
    return this.documentArchivesService.getArchiveById(id);
  }

  @Get(':id/download')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.AUDITOR,
    RoleType.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Arxivlangan hujjat nusxasini yuklab olish' })
  async downloadArchive(@Param('id') id: string, @Res() res: Response) {
    const fileInfo = await this.documentArchivesService.downloadArchive(id);
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
    );
    return res.sendFile(fileInfo.filePath);
  }

  @Post(':id/cancel')
  @Roles(RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE, RoleType.AUDITOR)
  @ApiOperation({ summary: 'Arxivlangan hujjatni bekor qilish (sababi bilan)' })
  async cancelArchive(
    @Param('id') id: string,
    @Body() dto: CancelArchiveDto,
    @CurrentUser() user: any,
  ) {
    return this.documentArchivesService.cancel(id, dto.reason, user?.userId || user?.id);
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
import { DocumentStampsService } from './document-stamps.service';
import { CreateDocumentStampDto, RevokeDocumentStampDto } from './document-stamp.dto';

@ApiTags('document-stamps')
@Controller('api')
export class DocumentStampsController {
  constructor(private readonly documentStampsService: DocumentStampsService) {}

  // PUBLIC ENDPOINT - No JWT guard required
  @Get('public/verify-doc/:docNumber')
  @ApiOperation({ summary: 'Rasmiy hujjatni ommaviy tekshirish (Public Verification API)' })
  async verifyPublic(@Param('docNumber') docNumber: string) {
    return this.documentStampsService.verifyPublic(docNumber);
  }

  // PUBLIC ENDPOINT - Download official certified document representation
  @Get('public/verify-doc/:docNumber/download')
  @ApiOperation({ summary: 'Rasmiy tasdiqlangan hujjat nusxasini (PDF/HTML) yuklab olish' })
  async downloadVerifiedDoc(@Param('docNumber') docNumber: string, @Res() res: Response) {
    const fileInfo = await this.documentStampsService.getPublicDocumentHtml(docNumber);
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
    );
    return res.send(fileInfo.content);
  }

  @Post('document-stamps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HEAD_WAREHOUSE, RoleType.MOL, RoleType.AUDITOR)
  @ApiOperation({ summary: 'Hujjatga raqamli muhr qo‘yish (Stamp document)' })
  async stampDocument(@Body() dto: CreateDocumentStampDto) {
    return this.documentStampsService.stampDocument(dto);
  }

  @Post('document-stamps/revoke')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HEAD_WAREHOUSE, RoleType.AUDITOR)
  @ApiOperation({ summary: 'Muhrlangan hujjatni bekor qilish (Revoke Document Stamp)' })
  async revokeStamp(
    @Body() dto: RevokeDocumentStampDto,
    @CurrentUser() user: any,
  ) {
    return this.documentStampsService.revokeStamp(dto, user?.userId || user?.id);
  }

  @Get('document-stamps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.AUDITOR,
    RoleType.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Barcha tasdiqlangan hujjatlar reestri' })
  async getAllStamps() {
    return this.documentStampsService.findAll();
  }
}


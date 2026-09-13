import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentStampsService } from './document-stamps.service';
import { CreateDocumentStampDto } from './document-stamp.dto';

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

  @Post('document-stamps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hujjatga raqamli muhr qo‘yish (Stamp document)' })
  async stampDocument(@Body() dto: CreateDocumentStampDto) {
    return this.documentStampsService.stampDocument(dto);
  }

  @Get('document-stamps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Barcha tasdiqlangan hujjatlar reestri' })
  async getAllStamps() {
    return this.documentStampsService.findAll();
  }
}

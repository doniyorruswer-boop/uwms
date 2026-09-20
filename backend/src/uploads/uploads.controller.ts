import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Res,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Uploads')
@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fayl yuklash (Asosiy vosita surati, shartnoma yoki akt skani)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Yuklanayotgan fayl (Rasm yoki PDF/Word/Excel hujjat, maks: 15MB)',
        },
        isPublic: {
          type: 'boolean',
          description: 'Fayl ommaviy (public) yoki himoyalangan (protected) ekanligi (standart: false)',
          default: false,
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024, // 15MB limit before parsing into memory
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: any,
    @Body('isPublic') isPublic?: string | boolean,
  ) {
    if (!file) {
      throw new BadRequestException('Fayl yuborilmadi!');
    }
    const publicFlag = isPublic === true || isPublic === 'true';
    return this.uploadsService.saveFile(file, publicFlag);
  }

  @Get('public/:filename')
  @ApiOperation({ summary: 'Ochiq (public) faylni ko‘rish yoki yuklab olish (Autentifikatsiya talab qilinmaydi)' })
  async getPublicFile(@Param('filename') filename: string, @Res() res: Response) {
    const { filePath, mimeType } = this.uploadsService.getFilePath(filename, true);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  }

  @Get(':filename')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Himoyalangan faylni ko‘rish yoki yuklab olish (JWT token talab qilinadi)' })
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    const { filePath, mimeType } = this.uploadsService.getFilePath(filename, false);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  }
}

import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Res,
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
          description: 'Yuklanayotgan fayl (Rasm yoki PDF/Word hujjat, maks: 15MB)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Fayl yuborilmadi!');
    }
    return this.uploadsService.saveFile(file);
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Yuklangan faylni ko‘rish yoki yuklab olish' })
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    const { filePath, mimeType } = this.uploadsService.getFilePath(filename);
    res.setHeader('Content-Type', mimeType);
    return res.sendFile(filePath);
  }
}

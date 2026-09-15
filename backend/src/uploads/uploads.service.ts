import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UploadedFileInfo {
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): Promise<UploadedFileInfo> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Fayl yuklanmadi yoki bo‘sh!');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Ruxsat etilmagan fayl formati (${file.mimetype}). Faqat rasm (JPG, PNG, WebP) yoki hujjat (PDF, DOC, DOCX, XLS, XLSX) yuklash mumkin!`,
      );
    }

    const maxSizeBytes = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('Fayl hajmi 15MB dan oshmasligi kerak!');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    const filename = `${Date.now()}_${uniqueId}_${safeBaseName}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      originalName: file.originalname,
      filename,
      mimeType: file.mimetype,
      size: file.size,
      url: `/api/uploads/${filename}`,
    };
  }

  getFilePath(filename: string): { filePath: string; mimeType: string } {
    // Path traversal himoyasi
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.uploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fayl topilmadi!');
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return {
      filePath,
      mimeType: mimeMap[ext] || 'application/octet-stream',
    };
  }
}

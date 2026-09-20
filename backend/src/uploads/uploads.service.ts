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
  isPublic: boolean;
}

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads');
  private readonly publicDir = path.resolve(process.cwd(), 'uploads', 'public');
  private readonly protectedDir = path.resolve(process.cwd(), 'uploads', 'protected');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.publicDir)) {
      fs.mkdirSync(this.publicDir, { recursive: true });
    }
    if (!fs.existsSync(this.protectedDir)) {
      fs.mkdirSync(this.protectedDir, { recursive: true });
    }
  }

  async saveFile(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    isPublic: boolean = false,
  ): Promise<UploadedFileInfo> {
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
        `Ruxsat etilmagan fayl formati (${file.mimetype}). Faqat xavfsiz rasm (JPG, PNG, WebP, GIF) yoki hujjat (PDF, DOC, DOCX, XLS, XLSX) yuklash mumkin!`,
      );
    }

    // Magic bytes tekshiruvi (Soxta MIME type va bufer xavfsizligi)
    const buf = file.buffer;
    const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isGif = buf.length > 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    const isPdf = buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
    const isWebp = buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    const isZipDoc = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    const isOleDoc = buf.length > 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;

    if (!isJpeg && !isPng && !isGif && !isPdf && !isWebp && !isZipDoc && !isOleDoc) {
      throw new BadRequestException('Fayl haqiqiy format tekshiruvidan (magic bytes) o‘tmadi!');
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

    const targetDir = isPublic ? this.publicDir : this.protectedDir;
    const filePath = path.join(targetDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      originalName: file.originalname,
      filename,
      mimeType: file.mimetype,
      size: file.size,
      url: isPublic ? `/api/uploads/public/${filename}` : `/api/uploads/${filename}`,
      isPublic,
    };
  }

  getFilePath(filename: string, isPublic: boolean = false): { filePath: string; mimeType: string } {
    // Path traversal himoyasi: faqat fayl nomining o'zi olinadi
    const safeFilename = path.basename(filename);
    const targetDir = isPublic ? this.publicDir : this.protectedDir;
    const filePath = path.join(targetDir, safeFilename);

    // Xavfsizlik: path targetDir ichida ekanligini qat'iy tekshirish
    if (!filePath.startsWith(targetDir)) {
      throw new BadRequestException('Noto‘g‘ri fayl yo‘li!');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return {
        filePath,
        mimeType: this.getMimeType(safeFilename),
      };
    }

    // Himoyalangan fayllar uchun: agar protected/ ichida topilmasa, legacy uploads/ root papkasidan tekshirish
    if (!isPublic) {
      const legacyPath = path.join(this.uploadDir, safeFilename);
      if (legacyPath.startsWith(this.uploadDir) && fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile()) {
        return {
          filePath: legacyPath,
          mimeType: this.getMimeType(safeFilename),
        };
      }
    }

    throw new NotFoundException(isPublic ? 'Ommaviy fayl topilmadi!' : 'Fayl topilmadi!');
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return mimeMap[ext] || 'application/octet-stream';
  }
}

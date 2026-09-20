import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

describe('UploadsService (Unit Tests)', () => {
  let service: UploadsService;

  beforeEach(() => {
    service = new UploadsService();
  });

  describe('saveFile security & magic bytes verification', () => {
    it('should reject SVG file format to prevent stored XSS', async () => {
      const svgFile = {
        originalname: 'icon.svg',
        mimetype: 'image/svg+xml',
        size: 100,
        buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
      };

      await expect(service.saveFile(svgFile, true)).rejects.toThrow(BadRequestException);
    });

    it('should reject file with spoofed MIME type and invalid magic bytes', async () => {
      const fakeImage = {
        originalname: 'malware.jpg',
        mimetype: 'image/jpeg',
        size: 50,
        buffer: Buffer.from('NOT_A_REAL_JPEG_IMAGE_CONTENT'),
      };

      await expect(service.saveFile(fakeImage, false)).rejects.toThrow(BadRequestException);
    });

    it('should accept valid PNG with real magic bytes', async () => {
      // PNG header: 89 50 4E 47 0D 0A 1A 0A
      const validPngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);

      const validFile = {
        originalname: 'real-image.png',
        mimetype: 'image/png',
        size: validPngBuffer.length,
        buffer: validPngBuffer,
      };

      const result = await service.saveFile(validFile, false);
      expect(result).toBeDefined();
      expect(result.mimeType).toBe('image/png');
      expect(result.filename).toContain('real-image.png');
    });

    it('should accept valid PDF with real magic bytes', async () => {
      // PDF header: %PDF
      const validPdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

      const validFile = {
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        buffer: validPdfBuffer,
      };

      const result = await service.saveFile(validFile, false);
      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/pdf');
    });
  });
});

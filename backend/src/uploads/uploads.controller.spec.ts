import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { BadRequestException } from '@nestjs/common';

describe('UploadsController (Security & Unit Tests)', () => {
  let controller: UploadsController;
  let service: any;

  beforeEach(async () => {
    service = {
      saveFile: jest.fn(),
      getFilePath: jest.fn().mockImplementation((filename: string, isPublic: boolean) => {
        const mime = filename.endsWith('.png') ? 'image/png' : 'application/pdf';
        return {
          filePath: `/mock/path/${filename}`,
          mimeType: mime,
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        {
          provide: UploadsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  describe('Filename validation and Path Traversal protection', () => {
    it('should reject path traversal in getPublicFile', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
      };

      await expect(
        controller.getPublicFile('../../secret.txt', mockRes),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getPublicFile('file%2F..%2Fetc.txt', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject path traversal in getFile', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
      };

      await expect(
        controller.getFile('../config.json', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set Content-Disposition inline for images', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
      };

      await controller.getPublicFile('avatar.png', mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="avatar.png"',
      );
      expect(mockRes.sendFile).toHaveBeenCalledWith('/mock/path/avatar.png');
    });

    it('should set Content-Disposition attachment for documents (PDF, Excel, etc.)', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
      };

      await controller.getFile('contract.pdf', mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="contract.pdf"',
      );
      expect(mockRes.sendFile).toHaveBeenCalledWith('/mock/path/contract.pdf');
    });
  });
});

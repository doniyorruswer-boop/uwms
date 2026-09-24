import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface RemoteUploadResult {
  bucket: string;
  key: string;
  checksum: string;
  encrypted: boolean;
  size: number;
  etag?: string;
  storageLocation: 'REMOTE_SERVER';
  serverPath?: string;
}

export type S3UploadResult = RemoteUploadResult;

/**
 * Universitet Zaxira Serveri Xizmati (University Backup Storage Service)
 *
 * Tashqi ommaviy AWS S3 ga bog'liq bo'lmagan, universitetning o'z serveriga
 * (tarmoq diski, alohida server katalogi yoki ichki MinIO) AES-256 shifrlash
 * orqali zaxira nusxalarini xavfsiz saqlash va Disaster Recovery imkoniyatini ta'minlaydi.
 */
@Injectable()
export class S3StorageService {
  private readonly logger = new Logger('UniversityBackupStorageService');
  private s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly isEnabled: boolean;
  private readonly encryptionKey: Buffer;
  private readonly univBackupServerPath: string;

  constructor() {
    // 1. Universitet fayl serveri / alohida zaxira diski yo'li:
    const customUnivPath = process.env.UNIVERSITY_BACKUP_SERVER_PATH;
    this.univBackupServerPath = customUnivPath
      ? path.resolve(customUnivPath)
      : path.resolve(process.cwd(), 'backups', 'university_server');

    this.bucket = process.env.UNIVERSITY_MINIO_BUCKET || process.env.S3_BUCKET || 'university-backups';

    // Shifrlash kalitini tayyorlash (AES-256 uchun 32 bayt):
    const rawKey =
      process.env.BACKUP_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'uwms_university_secure_backup_master_key_2026';
    this.encryptionKey = crypto.createHash('sha256').update(rawKey).digest();

    // 2. Universitetning ichki MinIO serveri (agar o'rnatilgan bo'lsa):
    const minioEndpoint = process.env.UNIVERSITY_MINIO_ENDPOINT || process.env.S3_ENDPOINT;
    const accessKeyId = process.env.UNIVERSITY_MINIO_ACCESS_KEY || process.env.S3_ACCESS_KEY || '';
    const secretAccessKey = process.env.UNIVERSITY_MINIO_SECRET_KEY || process.env.S3_SECRET_KEY || '';

    if (minioEndpoint && accessKeyId && secretAccessKey) {
      try {
        this.s3Client = new S3Client({
          endpoint: minioEndpoint,
          region: process.env.S3_REGION || 'us-east-1',
          credentials: { accessKeyId, secretAccessKey },
          forcePathStyle: true,
        });
        this.logger.log(`Universitet ichki MinIO serveri ulandi: ${minioEndpoint}`);
      } catch (err: any) {
        this.logger.warn(`MinIO ulanishida ogohlantirish: ${err.message}`);
      }
    }

    this.isEnabled = true; // Universitet serveriga nusxalash doimo tayyor

    if (!fs.existsSync(this.univBackupServerPath)) {
      try {
        fs.mkdirSync(this.univBackupServerPath, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`Universitet zaxira katalogini yaratishda xato: ${err.message}`);
      }
    }

    this.logger.log(
      `Universitet Zaxira Serveri faol: ${this.univBackupServerPath} (AES-256 shifrlash yoqilgan)`,
    );
  }

  /**
   * Zaxira saqlash xizmati holati
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  getBucketName(): string {
    return this.bucket;
  }

  getUnivServerPath(): string {
    return this.univBackupServerPath;
  }

  /**
   * AES-256-GCM yordamida zaxira buferini shifrlash
   */
  encryptBuffer(buffer: Buffer): Buffer {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const magic = Buffer.from('UENC'); // UWMS Encrypted
    return Buffer.concat([magic, iv, authTag, encrypted]);
  }

  /**
   * AES-256-GCM shifrlangan faylni de-shifrlash
   */
  decryptBuffer(encryptedBuffer: Buffer): Buffer {
    if (encryptedBuffer.length < 32) {
      return encryptedBuffer;
    }

    const magic = encryptedBuffer.subarray(0, 4).toString();
    if (magic !== 'UENC') {
      return encryptedBuffer;
    }

    const iv = encryptedBuffer.subarray(4, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const ciphertext = encryptedBuffer.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Zaxira nusxasini AES-256 shifrlangan holda Universitet Serveriga yozish
   */
  async uploadBackup(
    filename: string,
    fileBuffer: Buffer,
    metadata?: Record<string, string>,
  ): Promise<RemoteUploadResult> {
    const originalChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const storageKey = `backups/${filename}.enc`;

    // 1. Zaxira faylini AES-256-GCM bilan shifrlash
    const encryptedPayload = this.encryptBuffer(fileBuffer);
    const encryptedChecksum = crypto.createHash('sha256').update(encryptedPayload).digest('hex');

    // 2. Universitet Fayl Serveriga (alohida zaxira katalogi) yozish
    const targetFilePath = path.join(this.univBackupServerPath, `${filename}.enc`);
    fs.writeFileSync(targetFilePath, encryptedPayload);

    const metaInfo = {
      ...metadata,
      originalFilename: filename,
      originalChecksum,
      encryptedChecksum,
      algorithm: 'AES-256-GCM',
      storageType: 'UNIVERSITY_SERVER',
      serverPath: targetFilePath,
      uploadedAt: new Date().toISOString(),
    };
    fs.writeFileSync(`${targetFilePath}.meta.json`, JSON.stringify(metaInfo, null, 2));

    this.logger.log(`Zaxira nusxasi Universitet Serveriga muvaffaqiyatli yozildi: ${targetFilePath}`);

    // 3. Universitet ichki MinIO serveri mavjud bo'lsa, unga ham replikatsiya qilish
    let etag = `"${encryptedChecksum.substring(0, 16)}"`;
    if (this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: encryptedPayload,
          ContentType: 'application/octet-stream',
          Metadata: metaInfo as any,
        });
        const res = await this.s3Client.send(command);
        if (res.ETag) etag = res.ETag;
        this.logger.log(`Zaxira nusxasi Universitet MinIO xotirasiga ham saqlandi: ${storageKey}`);
      } catch (err: any) {
        this.logger.warn(`MinIO ga nusxalashda ogohlantirish: ${err.message}`);
      }
    }

    return {
      bucket: 'universitet_serveri',
      key: storageKey,
      checksum: originalChecksum,
      encrypted: true,
      size: encryptedPayload.length,
      etag,
      storageLocation: 'REMOTE_SERVER',
      serverPath: targetFilePath,
    };
  }

  /**
   * Universitet Serveridan zaxira nusxasini o'qish va de-shifrlash (Disaster Recovery)
   */
  async downloadBackup(key: string): Promise<Buffer> {
    const filename = path.basename(key);
    const localTarget = path.join(this.univBackupServerPath, filename);

    if (fs.existsSync(localTarget)) {
      this.logger.log(`Zaxira fayli Universitet Serveridan tiklanmoqda: ${localTarget}`);
      const encryptedBuffer = fs.readFileSync(localTarget);
      return this.decryptBuffer(encryptedBuffer);
    }

    // MinIO fallback
    if (this.s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        const res = await this.s3Client.send(command);
        const byteArray = await res.Body?.transformToByteArray();
        if (byteArray) {
          const encryptedBuffer = Buffer.from(byteArray);
          return this.decryptBuffer(encryptedBuffer);
        }
      } catch (err: any) {
        this.logger.warn(`MinIO dan olishda ogohlantirish: ${err.message}`);
      }
    }

    throw new Error(`Zaxira nusxasi Universitet Serverida topilmadi: ${key}`);
  }

  /**
   * Universitet Serveridagi zaxira nusxasini tozalash / o'chirish
   */
  async deleteBackup(key: string): Promise<void> {
    const filename = path.basename(key);
    const localTarget = path.join(this.univBackupServerPath, filename);

    if (fs.existsSync(localTarget)) {
      try {
        fs.unlinkSync(localTarget);
        this.logger.log(`Universitet Serveridagi zaxira fayli o‘chirildi: ${localTarget}`);
      } catch {
        // ignore
      }
    }

    const metaTarget = `${localTarget}.meta.json`;
    if (fs.existsSync(metaTarget)) {
      try {
        fs.unlinkSync(metaTarget);
      } catch {
        // ignore
      }
    }

    if (this.s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        await this.s3Client.send(command);
        this.logger.log(`Universitet MinIO dagi nusxa o‘chirildi: ${key}`);
      } catch {
        // ignore
      }
    }
  }
}

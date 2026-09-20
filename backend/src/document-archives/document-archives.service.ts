import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentArchiveStatus } from '@prisma/client';
import { GenerateArchiveDto, QueryArchiveDto } from './document-archives.dto';
import { DOCUMENT_VERIFICATION } from '../common/constants';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class DocumentArchivesService {
  private readonly logger = new Logger(DocumentArchivesService.name);
  private readonly documentsBaseDir = path.resolve(process.cwd(), 'uploads', 'documents');

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(this.documentsBaseDir)) {
      fs.mkdirSync(this.documentsBaseDir, { recursive: true });
    }
  }

  /**
   * Generates a cryptographic verification hash for document integrity.
   */
  private generateStampHash(docNumber: string, docType: string, date: Date): string {
    const raw = `${docNumber}|${docType}|${date.toISOString()}|UWMS_OFFICIAL_ARCHIVE`;
    return crypto
      .createHmac('sha256', DOCUMENT_VERIFICATION.SECRET_SALT)
      .update(raw)
      .digest('hex');
  }

  /**
   * Builds an official, standard OTM document HTML template for archiving and printing.
   */
  private buildDocumentHtml(dto: GenerateArchiveDto, version: number, verificationHash: string): string {
    if (dto.htmlContent && dto.htmlContent.trim().length > 50) {
      return dto.htmlContent;
    }

    const meta = dto.metadata || {};
    const items: Array<{
      inventoryNumber?: string;
      name?: string;
      model?: string;
      serialNumber?: string;
      unit?: string;
      quantity?: number;
      price?: number;
    }> = Array.isArray(meta.items) ? meta.items : [];

    const itemsRows = items.length > 0
      ? items.map((item, idx) => `
        <tr>
          <td style="border:1px solid #000;padding:6px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000;padding:6px;font-weight:bold;">${item.inventoryNumber || '—'}</td>
          <td style="border:1px solid #000;padding:6px;">${item.name || '—'} ${item.model ? `(${item.model})` : ''}</td>
          <td style="border:1px solid #000;padding:6px;">${item.serialNumber || '—'}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center;">${item.unit || 'dona'}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center;">${item.quantity ?? 1}</td>
          <td style="border:1px solid #000;padding:6px;text-align:right;">${item.price ? Number(item.price).toLocaleString('uz-UZ') : '—'}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="7" style="border:1px solid #000;padding:12px;text-align:center;color:#666;">Moddiy aktivlar ro‘yxati mavjud emas</td></tr>`;

    const publicVerifyUrl = `${DOCUMENT_VERIFICATION.PUBLIC_BASE_URL}/verify-doc/${encodeURIComponent(dto.docNumber)}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(publicVerifyUrl)}`;

    return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <title>${dto.title} - ${dto.docNumber} (v${version})</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 13px;
      line-height: 1.5;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 24px;
    }
    .header { text-align: center; margin-bottom: 20px; }
    .header .ministry { font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .header .org { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 4px; }
    .divider { border-bottom: 2px solid #000; margin: 10px auto; width: 90%; }
    .doc-title { text-align: center; margin: 16px 0; }
    .doc-title h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
    .doc-title .meta { margin-top: 4px; font-weight: bold; }
    .parties { margin-bottom: 16px; font-size: 13px; }
    .parties p { margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th { border: 1px solid #000; padding: 6px; background: #f0f0f0; }
    .signatures { margin-top: 36px; display: flex; justify-content: space-between; }
    .sig-box { width: 30%; }
    .stamp-badge {
      margin-top: 36px;
      padding: 12px 16px;
      border: 2px dashed #4E5969;
      background-color: #FAFAFA;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="ministry">O‘ZBEKISTON RESPUBLIKASI OLIY TA’LIM, FAN VA INNOVATSIYALAR VAZIRLIGI</div>
    <div class="org">UNIVERSITET MODDIY-TEXNIK BAZASI VA RESURSLARNI BOSHQARISH TIZIMI (UWMS)</div>
    <div class="divider"></div>
  </div>

  <div class="doc-title">
    <h2>${dto.title}</h2>
    <div class="meta">Hujjat №: ${dto.docNumber} | Versiya: v${version}</div>
    <div style="font-size: 11px; color: #444; margin-top: 4px;">Sana: ${new Date().toLocaleDateString('uz-UZ')}</div>
  </div>

  <div class="parties">
    <p><b>Hujjat turi:</b> ${dto.docType}</p>
    ${meta.sourceLocation ? `<p><b>Jo‘natuvchi / Chiqim joylashuvi:</b> ${meta.sourceLocation}</p>` : ''}
    ${meta.targetLocation ? `<p><b>Qabul qiluvchi / Manzil:</b> ${meta.targetLocation}</p>` : ''}
    ${meta.reason ? `<p><b>Asos:</b> ${meta.reason}</p>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">№</th>
        <th>Inventar №</th>
        <th>Moddiy aktiv nomi va modeli</th>
        <th>Seriya №</th>
        <th>Birligi</th>
        <th>Soni</th>
        <th>Balans qiymati (so‘m)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <p><b>Topshirdi:</b></p>
      <p style="margin-top: 24px; border-bottom: 1px solid #000;"></p>
      <p style="font-size: 10px; color: #666;">(imzo, F.I.Sh.)</p>
    </div>
    <div class="sig-box">
      <p><b>Qabul qildi:</b></p>
      <p style="margin-top: 24px; border-bottom: 1px solid #000;"></p>
      <p style="font-size: 10px; color: #666;">(imzo, F.I.Sh.)</p>
    </div>
    <div class="sig-box">
      <p><b>Tasdiqladi:</b></p>
      <p style="margin-top: 24px; border-bottom: 1px solid #000;"></p>
      <p style="font-size: 10px; color: #666;">(imzo, muhr o‘rni)</p>
    </div>
  </div>

  <div class="stamp-badge">
    <div>
      <div style="font-size: 11px; font-weight: bold; text-transform: uppercase;">
        O‘zbekiston Respublikasi OTM Davlat Elektron Hujjat Reyestri
      </div>
      <div style="font-size: 12px; font-weight: bold; color: #00B42A; margin: 3px 0;">
        ✔ ELEKTRON RAQAMLI RO‘YXATDAN O‘TGAN VA ARXIVLANGAN (SIGNED & ARCHIVED)
      </div>
      <div style="font-size: 10px; color: #4E5969;">
        Kriptografik SHA-256 xesh: <code>${verificationHash}</code>
      </div>
      <div style="font-size: 10px; color: #4E5969; margin-top: 2px;">
        Tekshirish havolasi: <u>${publicVerifyUrl}</u>
      </div>
    </div>
    <div>
      <img src="${qrApiUrl}" alt="QR Verification" style="width: 80px; height: 80px; border: 1px solid #ccc; padding: 2px; background: #fff;" />
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generates document snapshot file, increments version, stamps and archives in an atomic transaction.
   */
  async generateAndArchive(dto: GenerateArchiveDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Determine next version
      const lastArchive = await tx.documentArchive.findFirst({
        where: {
          entityId: dto.entityId,
          docType: dto.docType,
        },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (lastArchive?.version || 0) + 1;

      // 2. Setup directory
      const sanitizedDocType = dto.docType.replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedDocNumber = dto.docNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      const typeDir = path.join(this.documentsBaseDir, sanitizedDocType);
      if (!fs.existsSync(typeDir)) {
        fs.mkdirSync(typeDir, { recursive: true });
      }

      // 3. Cryptographic Stamp (Write-Once: create if new, preserve if existing)
      const stampHash = this.generateStampHash(dto.docNumber, dto.docType, new Date());
      let stamp = await tx.documentStamp.findUnique({
        where: { docNumber: dto.docNumber },
      });

      if (!stamp) {
        stamp = await tx.documentStamp.create({
          data: {
            docType: dto.docType,
            docNumber: dto.docNumber,
            title: dto.title,
            signerName: 'Tizim foydalanuvchisi',
            signerRole: 'Mas’ul xodim',
            verificationHash: stampHash,
            isValid: true,
            metadataJson: JSON.stringify(dto.metadata || {}),
          },
        });
      }

      // 4. Generate snapshot HTML content & calculate checksum
      const htmlContent = this.buildDocumentHtml(dto, nextVersion, stampHash);
      const buffer = Buffer.from(htmlContent, 'utf-8');
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      const fileName = `${sanitizedDocNumber}_v${nextVersion}.html`;
      const absoluteFilePath = path.join(typeDir, fileName);
      fs.writeFileSync(absoluteFilePath, buffer);

      const relativePdfPath = path.join('uploads', 'documents', sanitizedDocType, fileName).replace(/\\/g, '/');

      // 5. Create DocumentArchive record (respect explicit status, or determine by signatures / default to SIGNED)
      const explicitStatus = (dto.metadata as any)?.status as DocumentArchiveStatus | undefined;
      const signatures = (dto.metadata as any)?.signatures;
      let archiveStatus: DocumentArchiveStatus = DocumentArchiveStatus.SIGNED;

      if (explicitStatus) {
        archiveStatus = explicitStatus;
      } else if (Array.isArray(signatures) && signatures.length > 0) {
        const isFullySigned = signatures.every((s: any) => Boolean(s.isSigned));
        archiveStatus = isFullySigned ? DocumentArchiveStatus.SIGNED : DocumentArchiveStatus.ARCHIVED;
      }

      const archive = await tx.documentArchive.create({
        data: {
          docType: dto.docType,
          entityId: dto.entityId,
          docNumber: dto.docNumber,
          title: dto.title,
          version: nextVersion,
          status: archiveStatus,
          pdfPath: relativePdfPath,
          fileSize: buffer.length,
          checksum,
          metadata: dto.metadata || {},
          stampId: stamp.id,
          signedById: userId || null,
          signedAt: new Date(),
        },
        include: {
          signedBy: {
            select: { id: true, fullName: true, role: true, position: true },
          },
          stamp: true,
        },
      });

      // 6. Record SystemAuditLog
      await tx.systemAuditLog.create({
        data: {
          userId: userId || null,
          action: 'DOCUMENT_ARCHIVED',
          entity: 'DocumentArchive',
          entityId: archive.id,
          details: JSON.stringify({
            docType: dto.docType,
            docNumber: dto.docNumber,
            version: nextVersion,
            entityId: dto.entityId,
            fileSize: buffer.length,
            checksum,
            filePath: relativePdfPath,
          }),
        },
      });

      this.logger.log(`Document archived successfully: ${dto.docNumber} v${nextVersion} (id: ${archive.id})`);
      return archive;
    });
  }

  /**
   * Retrieves archive version history for a given entity or document number.
   */
  async getHistory(query: QueryArchiveDto) {
    const where: any = {};
    if (query.entityId) where.entityId = query.entityId;
    if (query.docType) where.docType = query.docType;
    if (query.docNumber) where.docNumber = query.docNumber;

    return this.prisma.documentArchive.findMany({
      where,
      include: {
        signedBy: {
          select: { id: true, fullName: true, role: true, position: true },
        },
        cancelledBy: {
          select: { id: true, fullName: true, role: true, position: true },
        },
        stamp: true,
      },
      orderBy: [
        { version: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Retrieves a single archive by ID.
   */
  async getArchiveById(id: string) {
    const archive = await this.prisma.documentArchive.findUnique({
      where: { id },
      include: {
        signedBy: {
          select: { id: true, fullName: true, role: true, position: true },
        },
        cancelledBy: {
          select: { id: true, fullName: true, role: true, position: true },
        },
        stamp: true,
      },
    });

    if (!archive) {
      throw new NotFoundException(`Arxivlangan hujjat topilmadi (ID: ${id})`);
    }

    return archive;
  }

  /**
   * Resolves the file for download.
   */
  async downloadArchive(id: string) {
    const archive = await this.getArchiveById(id);

    if (!archive.pdfPath) {
      throw new NotFoundException('Ushbu arxiv yozuvida fayl yo‘li mavjud emas.');
    }

    const absolutePath = path.resolve(process.cwd(), archive.pdfPath);

    // If file doesn't exist physically, regenerate it on the fly
    if (!fs.existsSync(absolutePath)) {
      const typeDir = path.dirname(absolutePath);
      if (!fs.existsSync(typeDir)) {
        fs.mkdirSync(typeDir, { recursive: true });
      }
      const htmlContent = this.buildDocumentHtml(
        {
          docType: archive.docType,
          entityId: archive.entityId,
          docNumber: archive.docNumber,
          title: archive.title,
          metadata: archive.metadata as Record<string, any>,
        },
        archive.version,
        archive.checksum || 'UWMS_VERIFIED',
      );
      fs.writeFileSync(absolutePath, Buffer.from(htmlContent, 'utf-8'));
    }

    const filename = `${archive.docType}_${archive.docNumber}_v${archive.version}.html`;
    return {
      filePath: absolutePath,
      filename,
      mimeType: 'text/html; charset=utf-8',
    };
  }

  /**
   * Cancels an archived document with a mandatory reason, updating stamp and audit log.
   */
  async cancel(id: string, reason: string, userId?: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Hujjatni bekor qilish uchun asosli sabab kiritilishi shart!');
    }

    return this.prisma.$transaction(async (tx) => {
      const archive = await tx.documentArchive.findUnique({
        where: { id },
      });

      if (!archive) {
        throw new NotFoundException(`Arxivlangan hujjat topilmadi (ID: ${id})`);
      }

      if (archive.status === 'CANCELLED') {
        throw new BadRequestException('Ushbu hujjat allaqachon bekor qilingan!');
      }

      // Update Archive
      const updated = await tx.documentArchive.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: reason.trim(),
          cancelledById: userId || null,
          cancelledAt: new Date(),
        },
        include: {
          signedBy: {
            select: { id: true, fullName: true, role: true, position: true },
          },
          cancelledBy: {
            select: { id: true, fullName: true, role: true, position: true },
          },
          stamp: true,
        },
      });

      // Invalidate linked stamp if present (Write-Once Revocation)
      if (archive.stampId) {
        await tx.documentStamp.update({
          where: { id: archive.stampId },
          data: {
            isValid: false,
            revokedAt: new Date(),
            revokedReason: reason.trim(),
            revokedById: userId || null,
          },
        });
      }

      // Record SystemAuditLog
      await tx.systemAuditLog.create({
        data: {
          userId: userId || null,
          action: 'DOCUMENT_CANCELLED',
          entity: 'DocumentArchive',
          entityId: id,
          details: JSON.stringify({
            docNumber: archive.docNumber,
            docType: archive.docType,
            version: archive.version,
            reason: reason.trim(),
          }),
        },
      });

      this.logger.warn(`Document cancelled: ${archive.docNumber} v${archive.version} (Reason: ${reason})`);
      return updated;
    });
  }

  /**
   * Builds an official OTM OS-1 Act HTML template for handover.
   */
  private buildHandoverActHtml(
    handover: any,
    version: number,
    verificationHash: string,
    signatureStatuses?: {
      isDepartingSigned?: boolean;
      isTargetSigned?: boolean;
      isCommandantSigned?: boolean;
      isAccountantSigned?: boolean;
    },
  ): string {
    const isSigned = handover.status === 'COMPLETED';
    const isDepartingSigned = signatureStatuses?.isDepartingSigned ?? true;
    const isTargetSigned = isSigned || (signatureStatuses?.isTargetSigned ?? false);
    const isCommandantSigned = isSigned || !handover.commandantUserId || (signatureStatuses?.isCommandantSigned ?? false);
    const isAccountantSigned = isSigned || !handover.accountantUserId || (signatureStatuses?.isAccountantSigned ?? false);

    const publicVerifyUrl = `${DOCUMENT_VERIFICATION.PUBLIC_BASE_URL}/verify-doc/${encodeURIComponent(handover.handoverNumber)}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(publicVerifyUrl)}`;

    const actionLabels: Record<string, string> = {
      TRANSFER_TO_MOL: 'Yangi MOLga o‘tkazish',
      RETURN_TO_WAREHOUSE: 'Omborga qaytarish',
      SEND_TO_REPAIR: 'Ta’mirga yuborish',
      WRITE_OFF: 'Hisobdan chiqarish (Spisanie)',
      SHORTAGE: 'Kamomad (Tekshiruvga)',
    };

    const typeLabels: Record<string, string> = {
      FULL_TRANSFER: 'To‘liq moddiy javobgarlikni topshirish (Xona va barcha jihozlar)',
      PARTIAL_TRANSFER: 'Tanlangan alohida ashyolarni topshirish',
      ROOM_TRANSFER: 'Auditoriya / Xonani jihozlari bilan topshirish',
      RETURN_TO_WAREHOUSE: 'Jihozlarni omborga qaytarish',
      FINAL_CLEARANCE: 'Yakuniy aylanma varaqa (Ishdan bo‘shash / MOL almashinuvi)',
    };

    const items = handover.items || [];
    const itemsRows = items.length > 0
      ? items.map((actItem: any, idx: number) => {
          const itemInst = actItem.itemInstance;
          const itemName = itemInst?.item?.name || 'Noma’lum jihoz';
          const invNum = itemInst?.inventoryNumber || '—';
          const serial = itemInst?.serialNumber || '—';
          const cost = itemInst?.initialCost ? Number(itemInst.initialCost).toLocaleString('uz-UZ') + ' so‘m' : '0 so‘m';
          const cond = itemInst?.status || 'FAOL';
          const actionText = actionLabels[actItem.actionType] || actItem.actionType;
          const destination = actItem.targetUser?.fullName || actItem.targetWarehouse?.name || (actItem.targetRoom?.number ? `${actItem.targetRoom?.number}-xona` : 'Universitet');

          return `
            <tr>
              <td style="border:1px solid #000;padding:6px;text-align:center;">${idx + 1}</td>
              <td style="border:1px solid #000;padding:6px;font-family:monospace;font-weight:bold;">${invNum}</td>
              <td style="border:1px solid #000;padding:6px;"><b>${itemName}</b></td>
              <td style="border:1px solid #000;padding:6px;font-family:monospace;">${serial}</td>
              <td style="border:1px solid #000;padding:6px;text-align:right;">${cost}</td>
              <td style="border:1px solid #000;padding:6px;text-align:center;">${cond}</td>
              <td style="border:1px solid #000;padding:6px;"><b>${actionText}</b> (${destination})</td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="7" style="border:1px solid #000;padding:12px;text-align:center;color:#666;">Topshirilayotgan aktivlar ro‘yxati mavjud emas</td></tr>`;

    return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <title>Dalolatnoma OS-1 - ${handover.handoverNumber} (v${version})</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 16px;
    }
    .header { text-align: center; margin-bottom: 14px; }
    .header .ministry { font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .header .org { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 3px; color: #1e3a8a; }
    .divider { border-bottom: 2px solid #000; margin: 8px auto; width: 95%; }
    .doc-title { text-align: center; margin: 12px 0; }
    .doc-title h2 { margin: 0; font-size: 14px; text-transform: uppercase; }
    .doc-title .meta { margin-top: 4px; font-weight: bold; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 12px;
      background: #fdfdfd;
      border: 1px solid #ddd;
      padding: 8px 12px;
    }
    .info-grid p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
    th { border: 1px solid #000; padding: 6px; background: #f0f0f0; text-align: center; }
    .signatures-title { margin-top: 20px; font-weight: bold; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 4px; }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 12px;
    }
    .sig-card {
      border: 1px solid #999;
      padding: 8px 12px;
      border-radius: 4px;
      background: #fafafa;
    }
    .sig-role { font-weight: bold; font-size: 11px; color: #111; text-transform: uppercase; }
    .sig-name { margin-top: 4px; font-size: 12px; }
    .sig-status {
      margin-top: 6px;
      padding: 4px 6px;
      font-size: 10px;
      font-weight: bold;
      border-radius: 2px;
      display: inline-block;
    }
    .sig-status.signed { background: #E8FFEA; color: #00B42A; border: 1px solid #B7EB8F; }
    .sig-status.pending { background: #FFF7E8; color: #FF7D00; border: 1px solid #FFE7BA; }
    .stamp-badge {
      margin-top: 24px;
      padding: 10px 14px;
      border: 2px dashed #4E5969;
      background-color: #FAFAFA;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="ministry">O‘ZBEKISTON RESPUBLIKASI OLIY TA’LIM, FAN VA INNOVATSIYALAR VAZIRLIGI</div>
    <div class="org">NAMANGAN DAVLAT TEXNIKA UNIVERSITETI — UWMS AXBOROT TIZIMI</div>
    <div class="divider"></div>
  </div>

  <div class="doc-title">
    <h2>MODDIY JAVOBGARLIKNI TOPSHIRISH-QABUL QILISH DALOLATNOMASI (OS-1)</h2>
    <div class="meta">Hujjat №: ${handover.handoverNumber} | Versiya: v${version} | Sana: ${new Date(handover.createdAt).toLocaleDateString('uz-UZ')}</div>
  </div>

  <div class="info-grid">
    <div>
      <p><b>Topshirish Turi:</b> ${typeLabels[handover.type] || handover.type}</p>
      <p><b>Bino:</b> ${handover.building?.name || 'OTM hududi'}</p>
      <p><b>Xona / Auditoriya:</b> ${handover.room ? `${handover.room.number}-xona (${handover.room.name})` : 'Umumiy'}</p>
    </div>
    <div>
      <p><b>Topshiruvchi mas’ul (Eski MOL):</b> ${handover.departingUser?.fullName} (${handover.departingUser?.position || 'MOL'})</p>
      <p><b>Qabul qiluvchi mas’ul:</b> ${handover.targetUser?.fullName || handover.targetWarehouse?.name || 'Taqsimot bo‘yicha'}</p>
      <p><b>Holati:</b> <b>${handover.status === 'COMPLETED' ? 'YAKUNLANGAN (TASDIQLANGAN)' : 'JARAYONDA (IMZOLANMOQDA)'}</b></p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px;">№</th>
        <th style="width: 90px;">Inventar №</th>
        <th>Moddiy aktiv nomi va modeli</th>
        <th style="width: 80px;">Seriya №</th>
        <th style="width: 95px;">Balans qiymati</th>
        <th style="width: 80px;">Texnik holati</th>
        <th style="width: 140px;">Belgilangan taqdir</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="signatures-title">4 Tomonlama Rasmiy Tasdiq va Imzolar:</div>

  <div class="signatures-grid">
    <div class="sig-card">
      <div class="sig-role">1. Topshiruvchi Shaxs (Eski MOL):</div>
      <div class="sig-name">${handover.departingUser?.fullName || '—'}</div>
      <div class="sig-status ${isDepartingSigned ? 'signed' : 'pending'}">${isDepartingSigned ? '✔ RASMIY TOPSHIRILDI VA IMZOLANDI' : '⏳ IMZOLASH KUTILMOQDA'}</div>
    </div>

    <div class="sig-card">
      <div class="sig-role">2. Qabul Qiluvchi Shaxs (Yangi MOL / Omborchi):</div>
      <div class="sig-name">${handover.targetUser?.fullName || handover.targetWarehouse?.name || 'Taqsimot bo‘yicha mas’ullar'}</div>
      <div class="sig-status ${isTargetSigned ? 'signed' : 'pending'}">${isTargetSigned ? '✔ QABUL QILINDI VA IMZOLANDI' : '⏳ IMZOLASH KUTILMOQDA'}</div>
    </div>

    <div class="sig-card">
      <div class="sig-role">3. Bino Nazoratchisi (Komendant):</div>
      <div class="sig-name">${handover.commandantUser?.fullName || 'Biriktirilgan komendant'}</div>
      <div class="sig-status ${isCommandantSigned ? 'signed' : 'pending'}">${isCommandantSigned ? '✔ XONA VA BUTUNLIK TASDIQLANDI' : '⏳ TEKSHIRUV KUTILMOQDA'}</div>
    </div>

    <div class="sig-card">
      <div class="sig-role">4. Buxgalteriya Vakili (Moddiy Hisobchi):</div>
      <div class="sig-name">${handover.accountantUser?.fullName || 'Bosh / Moddiy buxgalter'}</div>
      <div class="sig-status ${isAccountantSigned ? 'signed' : 'pending'}">${isAccountantSigned ? '✔ BALANSGA O‘TKAZISH TASDIQLANDI' : '⏳ TASDIQ KUTILMOQDA'}</div>
    </div>
  </div>

  <div style="margin-top: 14px; border: 1px solid #999; padding: 8px 12px; background: #fff;">
    <div class="sig-role">Tasdiqladi (OTM Rahbariyati):</div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
      <div>${handover.approvedByUser?.fullName || 'Moliya-iqtisodiyot ishlari bo‘yicha prorektor'}</div>
      <div class="sig-status ${isSigned ? 'signed' : 'pending'}">${isSigned ? '✔ TASDIQLANDI VA KUCHGA KIRDI' : '⏳ PROREKTOR TASDIQI KUTILMOQDA'}</div>
    </div>
  </div>

  <div class="stamp-badge">
    <div>
      <div style="font-size: 11px; font-weight: bold; text-transform: uppercase;">
        O‘zbekiston Respublikasi OTM Davlat Elektron Hujjat Reyestri
      </div>
      <div style="font-size: 12px; font-weight: bold; color: ${isSigned ? '#00B42A' : '#FF7D00'}; margin: 3px 0;">
        ${isSigned ? '✔ ELEKTRON RAQAMLI RO‘YXATDAN O‘TGAN VA ARXIVLANGAN' : '⏳ RASMIYLASHTIRISH VA IMZOLASH JARAYONIDA'}
      </div>
      <div style="font-size: 10px; color: #4E5969;">
        Kriptografik SHA-256 xesh: <code>${verificationHash}</code>
      </div>
      <div style="font-size: 10px; color: #4E5969; margin-top: 2px;">
        Tekshirish havolasi: <u>${publicVerifyUrl}</u>
      </div>
    </div>
    <div>
      <img src="${qrApiUrl}" alt="QR Verification" style="width: 80px; height: 80px; border: 1px solid #ccc; padding: 2px; background: #fff;" />
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generates and archives an official OS-1 Handover Act for a ResponsibilityHandover.
   */
  async generateHandoverAct(handoverId: string, userId?: string) {
    const handover = await this.prisma.responsibilityHandover.findFirst({
      where: { OR: [{ id: handoverId }, { handoverNumber: handoverId }] },
      include: {
        departingUser: { select: { id: true, fullName: true, role: true, position: true } },
        targetUser: { select: { id: true, fullName: true, role: true, position: true } },
        commandantUser: { select: { id: true, fullName: true, role: true, position: true } },
        accountantUser: { select: { id: true, fullName: true, role: true, position: true } },
        approvedByUser: { select: { id: true, fullName: true, role: true, position: true } },
        building: true,
        room: true,
        targetWarehouse: true,
        docArchive: true,
        items: {
          include: {
            itemInstance: {
              include: {
                item: { include: { category: true } },
                room: true,
              },
            },
          },
        },
      },
    });

    if (!handover) {
      throw new NotFoundException(`Topshirish dalolatnomasi (ID: ${handoverId}) topilmadi!`);
    }

    const lastArchive = await this.prisma.documentArchive.findFirst({
      where: {
        entityId: handover.id,
        docType: 'OS_1',
      },
      orderBy: { version: 'desc' },
    });
    const nextVersion = lastArchive ? lastArchive.version + 1 : 1;
    const now = new Date();
    const verificationHash = this.generateStampHash(handover.handoverNumber, 'OS_1', now);

    // Compute signature states from SigningSession
    const signingSessions = this.prisma.signingSession
      ? await this.prisma.signingSession.findMany({
          where: {
            docNumber: handover.handoverNumber,
            status: 'SIGNED',
          },
          orderBy: { signedAt: 'desc' },
        })
      : [];

    const isSignedRole = (role: string, roleUserId?: string | null) => {
      if (handover.status === 'COMPLETED') return true;
      return signingSessions.some(
        (s) =>
          s.metadataJson?.includes(`"signatoryRole":"${role}"`) ||
          (roleUserId && s.signedById === roleUserId)
      );
    };

    const isDepartingSigned = isSignedRole('DEPARTING', handover.departingUserId);
    const isTargetSigned = isSignedRole('TARGET', handover.targetUserId);
    const isCommandantSigned = !handover.commandantUserId || isSignedRole('COMMANDANT', handover.commandantUserId);
    const isAccountantSigned = !handover.accountantUserId || isSignedRole('ACCOUNTANT', handover.accountantUserId);

    const signatories = [
      {
        role: 'DEPARTING',
        label: 'Topshiruvchi (Eski MOL)',
        userId: handover.departingUserId,
        fullName: handover.departingUser?.fullName || 'Eski MOL',
        signed: isDepartingSigned,
        signedAt: signingSessions.find((s) => s.metadataJson?.includes('"signatoryRole":"DEPARTING"'))?.signedAt?.toISOString() || (handover.status === 'COMPLETED' ? handover.completedAt?.toISOString() : null),
        signatureType: 'QR_BIOMETRIC',
      },
      {
        role: 'TARGET',
        label: 'Qabul Qiluvchi (Yangi MOL / Omborchi)',
        userId: handover.targetUserId || '',
        fullName: handover.targetUser?.fullName || handover.targetWarehouse?.name || 'Taqsimot bo‘yicha',
        signed: isTargetSigned,
        signedAt: signingSessions.find((s) => s.metadataJson?.includes('"signatoryRole":"TARGET"'))?.signedAt?.toISOString() || (handover.status === 'COMPLETED' ? handover.completedAt?.toISOString() : null),
        signatureType: 'QR_BIOMETRIC',
      },
      {
        role: 'COMMANDANT',
        label: 'Bino Komendanti',
        userId: handover.commandantUserId || '',
        fullName: handover.commandantUser?.fullName || 'Bino Komendanti',
        signed: isCommandantSigned,
        signedAt: signingSessions.find((s) => s.metadataJson?.includes('"signatoryRole":"COMMANDANT"'))?.signedAt?.toISOString() || (handover.status === 'COMPLETED' ? handover.completedAt?.toISOString() : null),
        signatureType: 'QR_BIOMETRIC',
      },
      {
        role: 'ACCOUNTANT',
        label: 'Moddiy Hisobchi',
        userId: handover.accountantUserId || '',
        fullName: handover.accountantUser?.fullName || 'Moddiy Hisobchi',
        signed: isAccountantSigned,
        signedAt: signingSessions.find((s) => s.metadataJson?.includes('"signatoryRole":"ACCOUNTANT"'))?.signedAt?.toISOString() || (handover.status === 'COMPLETED' ? handover.completedAt?.toISOString() : null),
        signatureType: 'QR_BIOMETRIC',
      },
    ];

    const isFullySigned =
      handover.status === 'COMPLETED' ||
      signatories.every((s) => !s.userId || s.signed);

    const htmlContent = this.buildHandoverActHtml(handover, nextVersion, verificationHash, {
      isDepartingSigned,
      isTargetSigned,
      isCommandantSigned,
      isAccountantSigned,
    });

    const typeDir = path.resolve(this.documentsBaseDir, 'OS_1');
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    const relativePdfPath = path.join('uploads', 'documents', 'OS_1', `${handover.handoverNumber}_v${nextVersion}.html`);
    const absolutePath = path.resolve(process.cwd(), relativePdfPath);
    fs.writeFileSync(absolutePath, Buffer.from(htmlContent, 'utf-8'));

    return await this.prisma.$transaction(async (tx) => {
      let stamp = await tx.documentStamp.findUnique({
        where: { docNumber: handover.handoverNumber },
      });

      if (!stamp) {
        stamp = await tx.documentStamp.create({
          data: {
            docType: 'OS_1',
            docNumber: handover.handoverNumber,
            title: `Moddiy Javobgarlikni Topshirish-Qabul Qilish Dalolatnomasi (OS-1) — ${handover.handoverNumber}`,
            signerName: handover.targetUser?.fullName || handover.departingUser.fullName,
            signerRole: handover.targetUser?.position || 'MOL',
            verificationHash,
            metadataJson: JSON.stringify({
              handoverId: handover.id,
              handoverNumber: handover.handoverNumber,
              type: handover.type,
              departingUser: handover.departingUser.fullName,
              targetUser: handover.targetUser?.fullName,
              itemsCount: handover.items.length,
            }),
            isValid: true,
          },
        });
      }

      const archive = await tx.documentArchive.create({
        data: {
          docType: 'OS_1',
          entityId: handover.id,
          docNumber: handover.handoverNumber,
          title: `Moddiy Javobgarlikni Topshirish-Qabul Qilish Dalolatnomasi (OS-1) — ${handover.handoverNumber}`,
          version: nextVersion,
          pdfPath: relativePdfPath,
          checksum: verificationHash,
          metadata: {
            handoverId: handover.id,
            handoverNumber: handover.handoverNumber,
            type: handover.type,
            status: handover.status,
            departingUser: handover.departingUser.fullName,
            targetUser: handover.targetUser?.fullName,
            building: handover.building?.name,
            room: handover.room?.number,
            itemsCount: handover.items.length,
          },
          status: 'SIGNED',
          signedById: userId || null,
          signedAt: now,
          stampId: stamp.id,
        },
        include: {
          stamp: true,
          signedBy: { select: { id: true, fullName: true, role: true, position: true } },
        },
      });

      await tx.responsibilityHandover.update({
        where: { id: handover.id },
        data: { docArchiveId: archive.id },
      });

      return {
        archive,
        htmlContent,
        contentHtml: htmlContent,
        filePath: absolutePath,
        verificationHash,
        handoverId: handover.id,
        handoverNumber: handover.handoverNumber,
        documentHash: verificationHash,
        qrPayloadUrl: `${DOCUMENT_VERIFICATION.PUBLIC_BASE_URL}/verify/${verificationHash}`,
        pdfUrl: relativePdfPath,
        isFullySigned,
        signatories,
      };
    });
  }

  /**
   * Retrieves or generates the official OS-1 Document for a Handover.
   */
  async getHandoverDocument(handoverId: string, userId?: string) {
    const handover = await this.prisma.responsibilityHandover.findFirst({
      where: { OR: [{ id: handoverId }, { handoverNumber: handoverId }] },
    });

    if (!handover) {
      throw new NotFoundException(`Topshirish dalolatnomasi (ID: ${handoverId}) topilmadi!`);
    }

    // Always generate and return fresh document containing real-time signatures
    return this.generateHandoverAct(handover.id, userId);
  }

  /**
   * Deletion is explicitly forbidden under the Write-Once policy.
   */
  async deleteArchive() {
    throw new BadRequestException(
      "Arxivlangan rasmiy hujjatlar Write-Once rejimida ishlaydi. Ularni o'chirish qat'iyan taqiqlanadi!",
    );
  }
}

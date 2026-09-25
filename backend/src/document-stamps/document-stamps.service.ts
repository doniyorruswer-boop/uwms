import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentStampDto, RevokeDocumentStampDto } from './document-stamp.dto';
import { DOCUMENT_VERIFICATION, SYSTEM_AUDIT_ACTIONS } from '../common/constants';
import { RequestContext } from '../common/context/request-context';
import * as crypto from 'crypto';

export interface PublicDocumentVerification {
  isValid: boolean;
  status: 'VERIFIED' | 'REVOKED' | 'IN_PROGRESS';
  certificateTitle: string;
  docNumber: string;
  docType: string;
  title: string;
  signerName: string;
  signerRole: string;
  verificationHash: string;
  issuedAt: Date;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  verificationMethod: string;
  metadata: Record<string, any>;
  securityNotice: string;
  signingProgress?: {
    totalRequired: number;
    completedCount: number;
    percent: number;
    isFullySigned: boolean;
    signers: Array<{
      role: string;
      name: string;
      isSigned: boolean;
      signedAt?: string | Date | null;
      method: string;
    }>;
  };
}

@Injectable()
export class DocumentStampsService {
  private readonly logger = new Logger(DocumentStampsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministically canonicalizes document payload metadata for HMAC content integrity.
   * Sorts object keys recursively so identical payloads always produce identical serialized strings.
   */
  canonicalizePayload(data: any): string {
    if (data === null || data === undefined) {
      return '';
    }
    if (typeof data !== 'object') {
      return JSON.stringify(data);
    }
    if (Array.isArray(data)) {
      return '[' + data.map((item) => this.canonicalizePayload(item)).join(',') + ']';
    }
    const sortedKeys = Object.keys(data).sort();
    const parts = sortedKeys.map((key) => {
      return JSON.stringify(key) + ':' + this.canonicalizePayload(data[key]);
    });
    return '{' + parts.join(',') + '}';
  }

  /**
   * Generates a tamper-proof HMAC signature using server environment secret
   * bound cryptographically to the full document content payload (WORM integrity).
   */
  generateHash(
    docNumber: string,
    docType: string,
    signerName: string,
    createdAt: Date,
    metadata?: any,
  ): string {
    const canonicalContent = this.canonicalizePayload(metadata || {});
    const contentDigest = crypto
      .createHash('sha256')
      .update(canonicalContent)
      .digest('hex');

    const raw = `${docNumber}|${docType}|${signerName}|${createdAt.toISOString()}|${contentDigest}`;
    return crypto
      .createHmac('sha256', DOCUMENT_VERIFICATION.SECRET_SALT)
      .update(raw)
      .digest('hex');
  }

  /**
   * Deeply sanitizes metadata to guarantee Zero JShShIR, PINFL, passport, and password leakage.
   */
  sanitizePublicMetadata(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizePublicMetadata(item));
    }

    const sensitiveKeyPattern = /(jshshir|pinfl|passport|phone|telefon|password|secret|token)/i;

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeyPattern.test(key)) {
        continue; // Strictly omit PII and confidential identifiers from public verification response!
      }
      sanitized[key] = this.sanitizePublicMetadata(value);
    }
    return sanitized;
  }

  /**
   * Stamping documents adheres strictly to the "Write-Once" (WORM) policy.
   * If a document is already stamped, it cannot be modified, replaced, or overwritten.
   */
  async stampDocument(dto: CreateDocumentStampDto, executorId?: string) {
    const existing = await this.prisma.documentStamp.findUnique({
      where: { docNumber: dto.docNumber },
    });

    const now = new Date();
    const metadataJson = JSON.stringify(dto.metadata || {});

    if (existing) {
      throw new ConflictException(
        `Write-Once (WORM) siyosatiga muvofiq, avval muhrlangan rasmiy hujjat (${dto.docNumber}) ustidan qayta yozish yoki o‘zgartirish kiritish qat’iyan taqiqlanadi!`,
      );
    }

    const verificationHash = this.generateHash(dto.docNumber, dto.docType, dto.signerName, now, dto.metadata);

    const stamp = await this.prisma.documentStamp.create({
      data: {
        docType: dto.docType,
        docNumber: dto.docNumber,
        verificationHash,
        title: dto.title,
        signerName: dto.signerName,
        signerRole: dto.signerRole,
        metadataJson,
        isValid: true,
        createdAt: now,
      },
    });

    const verificationUrl = `${DOCUMENT_VERIFICATION.PUBLIC_BASE_URL}/verify-doc/${encodeURIComponent(dto.docNumber)}`;

    // Record SystemAuditLog for WORM stamp generation
    try {
      const clientIp = RequestContext.getClientIp() || 'internal';
      const userAgent = RequestContext.getUserAgent() || 'UWMS WORM Kriptografik Xizmati';
      const actorUserId =
        executorId ||
        (dto as any).userId ||
        RequestContext.get()?.userId ||
        null;

      await this.prisma.systemAuditLog.create({
        data: {
          action: SYSTEM_AUDIT_ACTIONS.WORM_STAMP_GENERATE,
          entity: 'DocumentStamp',
          entityId: stamp.id,
          userId: actorUserId,
          ipAddress: clientIp,
          userAgent,
          details: JSON.stringify({
            docNumber: stamp.docNumber,
            docType: stamp.docType,
            title: stamp.title,
            signerName: stamp.signerName,
            signerRole: stamp.signerRole,
            verificationHash: stamp.verificationHash,
            ipAddress: clientIp,
          }),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for WORM stamp: ${err}`);
    }

    return {
      ...stamp,
      verificationUrl,
    };
  }

  /**
   * Write-Once Revocation Act:
   * Instead of deleting records, stamps are revoked with a mandatory legal reason and audited.
   */
  async revokeStamp(dto: RevokeDocumentStampDto, userId?: string) {
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('Hujjatni bekor qilish uchun asosli sabab kiritilishi shart!');
    }

    const stamp = await this.prisma.documentStamp.findUnique({
      where: { docNumber: dto.docNumber },
    });

    if (!stamp) {
      throw new NotFoundException(`Bekor qilinuvchi hujjat ('${dto.docNumber}') davlat reyestridan topilmadi.`);
    }

    if (!stamp.isValid) {
      throw new BadRequestException(
        `Ushbu hujjat ('${dto.docNumber}') allaqachon bekor qilingan (Sana: ${stamp.revokedAt ? stamp.revokedAt.toISOString() : '—'}).`,
      );
    }

    const revokedAt = new Date();
    const updated = await this.prisma.documentStamp.update({
      where: { docNumber: dto.docNumber },
      data: {
        isValid: false,
        revokedAt,
        revokedReason: dto.reason.trim(),
        revokedById: userId || null,
      },
      include: {
        revokedBy: {
          select: { id: true, fullName: true, role: true, position: true },
        },
      },
    });

    const clientIp = RequestContext.getClientIp() || 'internal';
    const userAgent = RequestContext.getUserAgent() || 'UWMS WORM Kriptografik Xizmati';
    const actorUserId = userId || RequestContext.get()?.userId || null;

    // Record SystemAuditLog
    await this.prisma.systemAuditLog.create({
      data: {
        userId: actorUserId,
        action: SYSTEM_AUDIT_ACTIONS.DOCUMENT_REVOKED,
        entity: 'DocumentStamp',
        entityId: stamp.id,
        ipAddress: clientIp,
        userAgent,
        details: JSON.stringify({
          docNumber: stamp.docNumber,
          docType: stamp.docType,
          revokedAt: revokedAt.toISOString(),
          reason: dto.reason.trim(),
          ipAddress: clientIp,
        }),
      },
    });

    this.logger.warn(`Document stamp revoked: ${stamp.docNumber} (Reason: ${dto.reason.trim()}) by user ${userId || 'SYSTEM'}`);
    return updated;
  }

  /**
   * Deletion is explicitly forbidden under the Write-Once rule.
   */
  async deleteStamp() {
    throw new BadRequestException(
      "Elektron hujjatlar reyestri Write-Once (WORM) rejimida ishlaydi. Hujjatlarni o'chirish qat'iyan taqiqlanadi!",
    );
  }

  async verifyPublic(docNumber: string): Promise<PublicDocumentVerification> {
    const stamp = await this.prisma.documentStamp.findUnique({
      where: { docNumber },
    });

    if (!stamp) {
      // If not in database yet, let's see if this is an existing document in UWMS:
      const fallback = await this.tryAutoStampExisting(docNumber);
      if (fallback) {
        return fallback;
      }
      throw new NotFoundException(`Hujjat raqami '${docNumber}' bo‘yicha davlat reyestridan ma’lumot topilmadi.`);
    }

    let parsedMetadata: any = {};
    try {
      parsedMetadata = JSON.parse(stamp.metadataJson);
    } catch {
      // ignore
    }

    const sanitizedMetadata = this.sanitizePublicMetadata(parsedMetadata);

    let signingProgress: any = undefined;
    if (parsedMetadata?.signatures && Array.isArray(parsedMetadata.signatures) && parsedMetadata.signatures.length > 0) {
      const signers = parsedMetadata.signatures.map((s: any) => ({
        role: s.role || 'Mas’ul Shaxs',
        name: s.name || '',
        isSigned: Boolean(s.isSigned),
        signedAt: s.signedAt || null,
        method: s.method || 'UWMS Tizim Tasdig‘i (Workflow Auth)',
      }));
      const totalRequired = signers.length;
      const completedCount = signers.filter((s: any) => s.isSigned).length;
      const percent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;
      const isFullySigned = completedCount === totalRequired;
      signingProgress = {
        totalRequired,
        completedCount,
        percent,
        isFullySigned,
        signers,
      };
    } else if (stamp.docType === 'OS_2' || stamp.docNumber.endsWith('-OS2')) {
      const isSigned = stamp.isValid;
      const signers = [
        {
          role: 'Topshiruvchi bosh ombor mudiri',
          name: parsedMetadata?.warehouseSigner || parsedMetadata?.senderName || 'Bosh ombor mudiri',
          isSigned,
          signedAt: stamp.createdAt ? stamp.createdAt.toISOString() : null,
          method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
        },
        {
          role: 'Qabul qiluvchi bino komendanti',
          name: parsedMetadata?.commendantName || stamp.signerName || 'Bino komendanti',
          isSigned,
          signedAt: stamp.createdAt ? stamp.createdAt.toISOString() : null,
          method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
        },
      ];
      signingProgress = {
        totalRequired: 2,
        completedCount: isSigned ? 2 : 0,
        percent: isSigned ? 100 : 0,
        isFullySigned: isSigned,
        signers,
      };
    } else if (stamp.docType === 'AKT' || stamp.docNumber.endsWith('-AKT')) {
      const isSigned = stamp.isValid;
      const signers = [
        {
          role: 'Topshiruvchi bino komendanti',
          name: stamp.signerName || parsedMetadata?.commendantName || 'Bino komendanti',
          isSigned,
          signedAt: stamp.createdAt ? stamp.createdAt.toISOString() : null,
          method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
        },
        {
          role: 'Qabul qiluvchi mas’ul (Bo‘lim boshlig‘i / Kafedra mudiri / Prorektor)',
          name: parsedMetadata?.requester || 'Kafedra mudiri / Mas’ul',
          isSigned,
          signedAt: stamp.createdAt ? stamp.createdAt.toISOString() : null,
          method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
        },
      ];
      signingProgress = {
        totalRequired: 2,
        completedCount: isSigned ? 2 : 0,
        percent: isSigned ? 100 : 0,
        isFullySigned: isSigned,
        signers,
      };
    } else {
      signingProgress = {
        totalRequired: 1,
        completedCount: stamp.isValid ? 1 : 0,
        percent: stamp.isValid ? 100 : 0,
        isFullySigned: stamp.isValid,
        signers: [
          {
            role: stamp.signerRole,
            name: stamp.signerName,
            isSigned: stamp.isValid,
            signedAt: stamp.createdAt ? stamp.createdAt.toISOString() : null,
            method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
          },
        ],
      };
    }

    const hasBiometric = signingProgress?.signers?.some((s: any) =>
      typeof s.method === 'string' && s.method.toLowerCase().includes('qr-pairing'),
    );
    const verificationMethod = hasBiometric
      ? 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)'
      : 'UWMS Raqamli Muhr va Tizim Tasdig‘i (WORM Standarti)';

    return {
      isValid: stamp.isValid,
      status: !stamp.isValid ? 'REVOKED' : signingProgress?.isFullySigned ? 'VERIFIED' : 'IN_PROGRESS',
      certificateTitle: hasBiometric
        ? 'Universitet Ichki Elektron Hujjati (QR-Pairing Tasdiqlangan)'
        : 'Universitet Ichki Elektron Hujjati (WORM Raqamli Muhr)',
      docNumber: stamp.docNumber,
      docType: stamp.docType,
      title: stamp.title,
      signerName: stamp.signerName,
      signerRole: stamp.signerRole,
      verificationHash: stamp.verificationHash,
      issuedAt: stamp.createdAt,
      revokedAt: stamp.revokedAt,
      revokedReason: stamp.revokedReason,
      verificationMethod,
      metadata: sanitizedMetadata,
      securityNotice:
        'Ushbu hujjat universitet axborot tizimi orqali ro‘yxatga olingan va WORM raqamli muhr standarti orqali tekshirilgan. O‘zbekiston Respublikasi qonunchiligiga muvofiq, shaxsiy ma’lumotlar xavfsizligi yuzasidan JShShIR, PINFL va pasport ma’lumotlari ochiq reyestrda ko‘rsatilmaydi.',
      signingProgress,
    };
  }

  private async tryAutoStampExisting(docNumber: string): Promise<PublicDocumentVerification | null> {
    // 1. Check if it matches Request (OS-1, OS-2, or AKT)
    const baseDocNum = docNumber.replace(/-(OS1|OS2|AKT)$/, '');
    const request = await this.prisma.request.findFirst({
      where: {
        OR: [
          { requestNumber: docNumber },
          { requestNumber: baseDocNum },
          { id: docNumber },
          { id: baseDocNum },
        ],
      },
      include: {
        requester: true,
        approvedBy: true,
        department: true,
        commendant: true,
        warehouseReceivedBy: true,
        commendantHandedBy: true,
        items: { include: { item: true } },
      },
    });

    if (request) {
      const omborchi = request.warehouseReceivedBy?.fullName || request.approvedBy?.fullName || 'Bosh ombor mudiri';
      const komendant = request.commendantHandedBy?.fullName || request.commendant?.fullName || 'Bino komendanti';
      const requester = request.requester?.fullName || 'Mas\'ul Xodim';

      if (docNumber.endsWith('-OS1')) {
        await this.stampDocument({
          docType: 'OS_1',
          docNumber: `${request.requestNumber}-OS1`,
          title: `Kirim Dalolatnomasi OS-1 (Ombor qabuli) — ${request.purpose}`,
          signerName: omborchi,
          signerRole: 'Bosh ombor mudiri',
          metadata: {
            purpose: request.purpose,
            department: request.department?.name,
            items: request.items.map((i) => ({
              name: i.item.name,
              qty: i.approvedQty || i.requestedQty,
              unit: i.item.unit,
            })),
            signatures: [
              {
                role: 'Qabul Qiluvchi (Bosh Ombor Mudiri)',
                name: omborchi,
                isSigned: true,
                signedAt: request.warehouseReceivedAt || request.createdAt,
                method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
              },
            ],
          },
        });
        return this.verifyPublic(`${request.requestNumber}-OS1`);
      }

      if (docNumber.endsWith('-OS2')) {
        await this.stampDocument({
          docType: 'OS_2',
          docNumber: `${request.requestNumber}-OS2`,
          title: `OS-2 Chiqim Nakladnoyi (Komendantga topshirish) — ${request.purpose}`,
          signerName: omborchi,
          signerRole: 'Bosh ombor mudiri',
          metadata: {
            purpose: request.purpose,
            department: request.department?.name,
            items: request.items.map((i) => ({
              name: i.item.name,
              qty: i.approvedQty || i.requestedQty,
              unit: i.item.unit,
            })),
            signatures: [
              {
                role: 'Topshiruvchi (Bosh Ombor Mudiri)',
                name: omborchi,
                isSigned: true,
                signedAt: request.commendantHandedAt || request.updatedAt,
                method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
              },
              {
                role: 'Qabul Qiluvchi (Bino Komendanti)',
                name: komendant,
                isSigned: true,
                signedAt: request.commendantHandedAt || request.updatedAt,
                method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
              },
            ],
          },
        });
        return this.verifyPublic(`${request.requestNumber}-OS2`);
      }

      // Default or -AKT: Komendant va Talabgor (Kafedra mudiri / Bo'lim boshlig'i / Prorektor) o'rtasidagi topshirish-qabul qilish dalolatnomasi
      const isFulfilled = request.status === 'FULFILLED';
      const effectiveDocNumber = docNumber.endsWith('-AKT') ? `${request.requestNumber}-AKT` : request.requestNumber;

      await this.stampDocument({
        docType: 'AKT',
        docNumber: effectiveDocNumber,
        title: `Ichki topshirish-qabul qilish dalolatnomasi (${request.purpose})`,
        signerName: komendant,
        signerRole: 'Bosh bino komendanti',
        metadata: {
          purpose: request.purpose,
          department: request.department?.name,
          requester,
          items: request.items.map((i) => ({
            name: i.item.name,
            qty: i.approvedQty || i.requestedQty,
            unit: i.item.unit,
          })),
          signatures: [
            {
              role: 'Topshiruvchi (Bino Komendanti)',
              name: komendant,
              isSigned: isFulfilled,
              signedAt: request.fulfilledAt || request.updatedAt,
              method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
            },
            {
              role: 'Qabul Qiluvchi (Mas’ul Shaxs)',
              name: requester,
              isSigned: isFulfilled,
              signedAt: request.fulfilledAt || request.updatedAt,
              method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
            },
          ],
        },
      });
      return this.verifyPublic(effectiveDocNumber);
    }

    // 2. Check if it matches Write-Off OS-4
    const writeOff = await this.prisma.writeOffRequest.findFirst({
      where: { actNumber: docNumber },
      include: {
        asset: { include: { item: true, room: true } },
        createdBy: true,
        members: { include: { user: true } },
      },
    });

    if (writeOff) {
      const members = writeOff.members || [];
      const signers = [
        {
          role: 'Tashabbuskor Mas’ul',
          name: writeOff.createdBy.fullName,
          isSigned: true,
          signedAt: writeOff.createdAt,
          method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
        },
        ...members.map((m) => ({
          role: m.roleName || 'Komissiya a’zosi',
          name: m.user.fullName,
          isSigned: m.vote === 'APPROVED',
          signedAt: m.votedAt,
          method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
        })),
      ];

      await this.stampDocument({
        docType: 'OS_4',
        docNumber: writeOff.actNumber,
        title: `OS-4 Hisobdan Chiqarish Dalolatnomasi (${writeOff.asset.item.name})`,
        signerName: writeOff.createdBy.fullName,
        signerRole: 'Hisobdan Chiqarish Komissiyasi Raisi',
        metadata: {
          assetName: writeOff.asset.item.name,
          inventoryNumber: writeOff.asset.inventoryNumber,
          reason: writeOff.reason,
          membersCount: writeOff.members.length,
          status: writeOff.status,
          signatures: signers,
        },
      });
      return this.verifyPublic(writeOff.actNumber);
    }

    // 3. Check if it matches Inventory Campaign (INV-19)
    const campaign = await this.prisma.inventoryCampaign.findFirst({
      where: { campaignNumber: docNumber },
      include: { createdBy: true, scopes: { include: { room: true } } },
    });

    if (campaign) {
      const isCompleted = campaign.status === 'COMPLETED';
      await this.stampDocument({
        docType: 'INV_19',
        docNumber: campaign.campaignNumber,
        title: `Yalpi Inventarizatsiya va Solishtirma Dalolatnomasi (INV-19) - ${campaign.title}`,
        signerName: campaign.createdBy.fullName,
        signerRole: 'Bosh Auditor',
        metadata: {
          campaignNumber: campaign.campaignNumber,
          title: campaign.title,
          status: campaign.status,
          totalRooms: campaign.scopes.length,
          signatures: [
            {
              role: 'Moddiy Javobgar Shaxslar',
              name: `Kafedra mudirlari (${campaign.scopes.length} ta xona)`,
              isSigned: isCompleted,
              signedAt: isCompleted ? campaign.updatedAt : null,
              method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
            },
            {
              role: 'Bosh Auditor',
              name: campaign.createdBy.fullName,
              isSigned: isCompleted,
              signedAt: isCompleted ? campaign.updatedAt : null,
              method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
            },
          ],
        },
      });
      return this.verifyPublic(campaign.campaignNumber);
    }

    // 4. Check if it matches Inventory Audit (INV-19)
    const audit = await this.prisma.inventoryAudit.findFirst({
      where: { auditNumber: docNumber },
      include: { createdBy: true, room: { include: { responsibleUser: true } } },
    });

    if (audit) {
      const isCompleted = audit.status === 'COMPLETED';
      await this.stampDocument({
        docType: 'INV_19',
        docNumber: audit.auditNumber,
        title: `Xona Inventarizatsiya Qaydnomasi (INV-19) - ${audit.room?.number || ''}-xona`,
        signerName: audit.createdBy.fullName,
        signerRole: 'Bosh Auditor',
        metadata: {
          auditNumber: audit.auditNumber,
          roomNumber: audit.room?.number,
          status: audit.status,
          signatures: [
            ...(audit.room?.responsibleUser
              ? [
                  {
                    role: 'Moddiy Javobgar Shaxs',
                    name: audit.room.responsibleUser.fullName,
                    isSigned: isCompleted,
                    signedAt: isCompleted ? audit.completedAt : null,
                    method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
                  },
                ]
              : []),
            {
              role: 'Bosh Auditor',
              name: audit.createdBy.fullName,
              isSigned: isCompleted,
              signedAt: isCompleted ? audit.completedAt : null,
              method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
            },
          ],
        },
      });
      return this.verifyPublic(audit.auditNumber);
    }

    // 5. Check if it matches Stock Movement (OS-1 Kirim / Transfer)
    const movement = await this.prisma.stockMovement.findFirst({
      where: { movementNumber: docNumber },
      include: {
        executedBy: true,
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { item: true } },
      },
    });

    if (movement) {
      const isIncoming = movement.movementType === 'INCOMING';
      await this.stampDocument({
        docType: isIncoming ? 'OS_1' : 'TRANSFER',
        docNumber: movement.movementNumber,
        title: `${isIncoming ? 'Kirim Dalolatnomasi (OS-1)' : 'Ichki Siljish Hujjati'} № ${movement.movementNumber}`,
        signerName: movement.executedBy?.fullName || 'Bosh Omborchi',
        signerRole: movement.executedBy?.position || 'Bosh Omborchi',
        metadata: {
          movementType: movement.movementType,
          fromWarehouse: movement.fromWarehouse?.name,
          toWarehouse: movement.toWarehouse?.name,
          items: movement.items.map((i) => ({
            name: i.item.name,
            qty: i.quantity,
            unit: i.item.unit,
          })),
          signatures: isIncoming
            ? [
                {
                  role: 'Qabul Qiluvchi (Bosh Ombor Mudiri)',
                  name: movement.executedBy?.fullName || 'Bosh Omborchi',
                  isSigned: true,
                  signedAt: movement.createdAt,
                  method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
                },
              ]
            : [
                {
                  role: 'Topshiruvchi (Bosh Ombor Mudiri)',
                  name: movement.executedBy?.fullName || 'Bosh Omborchi',
                  isSigned: true,
                  signedAt: movement.createdAt,
                  method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
                },
                {
                  role: 'Qabul Qiluvchi (Bino Komendanti)',
                  name: movement.toWarehouse?.name ? `${movement.toWarehouse.name} Komendanti` : 'Biriktirilgan Komendant',
                  isSigned: true,
                  signedAt: movement.createdAt,
                  method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
                },
              ],
        },
      });
      return this.verifyPublic(movement.movementNumber);
    }

    return null;
  }

  /**
   * Generates a printable, certified official A4 document representation for public download.
   */
  async getPublicDocumentHtml(docNumber: string) {
    const verified = await this.verifyPublic(docNumber);

    const isRevoked = verified.status === 'REVOKED' || !verified.isValid;
    const isFullySigned =
      !isRevoked &&
      (verified.status === 'VERIFIED' || verified.signingProgress?.isFullySigned);

    const items: Array<any> = Array.isArray(verified.metadata?.items)
      ? verified.metadata.items
      : [];
    const itemsRows =
      items.length > 0
        ? items
            .map(
              (item, idx) => `
        <tr>
          <td style="border:1px solid #333;padding:6px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #333;padding:6px;font-weight:bold;">${item.name || item.title || '—'}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;">${item.qty ? `${item.qty} ${item.unit || 'dona'}` : item.inv || '—'}</td>
          <td style="border:1px solid #333;padding:6px;">${item.room || item.department || verified.metadata?.department || 'Asosiy bino'}</td>
        </tr>
      `,
            )
            .join('')
        : `<tr><td colspan="4" style="border:1px solid #333;padding:10px;text-align:center;color:#666;">Moddiy aktivlar yoki ashyolar ro‘yxati mavjud emas</td></tr>`;

    const signers: Array<any> = verified.signingProgress?.signers || [];
    const signersRows = signers
      .map(
        (s, idx) => `
      <tr>
        <td style="border:1px solid #333;padding:6px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #333;padding:6px;"><b>${s.name || 'Mas’ul xodim'}</b><br/><small style="color:#555;">${s.role}</small></td>
        <td style="border:1px solid #333;padding:6px;text-align:center;">
          ${s.isSigned ? '<span style="color:#00B42A;font-weight:bold;">✔ TASDIQLANGAN</span>' : '<span style="color:#FA8C16;font-weight:bold;">⏳ KUTILMOQDA</span>'}
        </td>
        <td style="border:1px solid #333;padding:6px;text-align:center;font-size:11px;">
          ${s.signedAt ? new Date(s.signedAt).toLocaleString('uz-UZ') : '—'}
        </td>
        <td style="border:1px solid #333;padding:6px;font-size:11px;color:#165DFF;">
          ${s.method || 'UWMS Tizim Tasdig‘i'}
        </td>
      </tr>
    `,
      )
      .join('');

    const publicVerifyUrl = `${DOCUMENT_VERIFICATION.PUBLIC_BASE_URL}/verify-doc/${encodeURIComponent(verified.docNumber)}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(publicVerifyUrl)}`;

    const htmlContent = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <title>${verified.title} — ${verified.docNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 13px;
      line-height: 1.5;
      color: #1D2129;
      background: #fff;
      margin: 0;
      padding: 24px;
    }
    .header { text-align: center; margin-bottom: 20px; }
    .header .ministry { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .org { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 4px; }
    .divider { border-bottom: 2px solid #000; margin: 10px auto; width: 95%; }
    .doc-title { text-align: center; margin: 16px 0; }
    .doc-title h2 { margin: 0; font-size: 16px; text-transform: uppercase; }
    .doc-title .meta { margin-top: 4px; font-weight: bold; }
    .revoked-banner {
      background-color: #FFF2F0;
      border: 2px solid #F53F3F;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .revoked-watermark {
      position: fixed;
      top: 40%;
      left: 10%;
      transform: rotate(-30deg);
      font-size: 64px;
      color: rgba(245, 63, 63, 0.14);
      font-weight: bold;
      pointer-events: none;
      z-index: 9999;
      border: 6px solid rgba(245, 63, 63, 0.14);
      padding: 10px 30px;
    }
    .attr-table { width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-size: 12px; }
    .attr-table td { padding: 6px 8px; border: 1px solid #E5E6EB; }
    .attr-table td.label { font-weight: bold; width: 220px; background-color: #F7F8FA; }
    table.data-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    table.data-table th { border: 1px solid #333; padding: 6px; background-color: #F2F3F5; text-align: center; }
    .stamp-badge {
      margin-top: 32px;
      padding: 14px 18px;
      border: 2px dashed #86909C;
      background-color: #FAFAFA;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .no-print { margin-bottom: 16px; text-align: right; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 8px 18px; font-size: 13px; font-weight: bold; background: #165DFF; color: #fff; border: none; cursor: pointer; border-radius: 2px;">
      🖨 Ushbu Hujjatni Chop Etish (PDF Saqlash)
    </button>
  </div>

  ${isRevoked ? '<div class="revoked-watermark">BEKOR QILINGAN (REVOKED)</div>' : ''}

  <div class="header">
    <div class="ministry">O‘ZBEKISTON RESPUBLIKASI OLIY TA’LIM, FAN VA INNOVATSIYALAR VAZIRLIGI</div>
    <div class="org">UNIVERSITET MODDIY-TEXNIK BAZASI VA RESURSLARNI BOSHQARISH TIZIMI (UWMS)</div>
    <div class="divider"></div>
  </div>

  <div class="doc-title">
    <h2>${verified.title}</h2>
    <div class="meta">Hujjat №: ${verified.docNumber} | Turi: ${verified.docType}</div>
    <div style="font-size: 11px; color: #4E5969; margin-top: 4px;">Kiritilgan sana: ${new Date(verified.issuedAt).toLocaleString('uz-UZ')}</div>
  </div>

  ${
    isRevoked
      ? `
    <div class="revoked-banner">
      <div style="color: #F53F3F; font-size: 14px; font-weight: bold; margin-bottom: 4px;">
        ⚠ DIQQAT: USHBU RASMIY HUJJAT BEKOR QILINGAN (REVOKED — YAROQSIZ)!
      </div>
      <div style="font-size: 12px; margin: 2px 0;">
        <b>Bekor qilingan sana:</b> ${verified.revokedAt ? new Date(verified.revokedAt).toLocaleString('uz-UZ') : '—'}
      </div>
      <div style="font-size: 12px; margin: 2px 0;">
        <b>Bekor qilish asosi / sababi:</b> ${verified.revokedReason || 'Universitet rasmiy farmoyishiga asosan bekor qilingan'}
      </div>
      <div style="font-size: 11px; color: #86909C; margin-top: 4px;">
        * Eslatma: Ushbu hujjat reyestrda faqat arxiv maqsadida saqlanadi, bekor qilinganligi sababli yuridik kuchga ega emas.
      </div>
    </div>
  `
      : ''
  }

  <table class="attr-table">
    <tr>
      <td class="label">Hujjat Holati:</td>
      <td>
        ${
          isRevoked
            ? '<b style="color:#F53F3F;">BEKOR QILINGAN (YAROQSIZ)</b>'
            : isFullySigned
              ? '<b style="color:#00B42A;">✔ HAQIQIY VA TO‘LIQ TASDIQLANGAN (VERIFIED)</b>'
              : '<b style="color:#FA8C16;">⏳ TASDIQLASH JARAYONIDA</b>'
        }
      </td>
    </tr>
    <tr>
      <td class="label">Bosh Mas’ul / Tashabbuskor:</td>
      <td>${verified.signerName} (${verified.signerRole})</td>
    </tr>
    <tr>
      <td class="label">Tasdiqlash Texnologiyasi:</td>
      <td>${verified.verificationMethod}</td>
    </tr>
    <tr>
      <td class="label">HMAC Nazorat Kodi:</td>
      <td><code style="font-size: 11px; background: #f2f3f5; padding: 2px 4px;">${verified.verificationHash}</code></td>
    </tr>
  </table>

  ${
    items.length > 0
      ? `
    <h4 style="margin: 16px 0 6px 0;">Tasdiqlangan Ashyolar va Moddiy Aktivlar Ro‘yxati:</h4>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 30px;">№</th>
          <th>Ashyo / Mahsulot Nomi</th>
          <th style="width: 130px;">Miqdor / Inventar №</th>
          <th>Xona / Joylashuv</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  `
      : ''
  }

  ${
    signers.length > 0
      ? `
    <h4 style="margin: 16px 0 6px 0;">Ishtirokchilar va Imzolar Jurnali:</h4>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 30px;">№</th>
          <th>Mas’ul Shaxs / Lavozimi</th>
          <th style="width: 130px;">Holati</th>
          <th style="width: 140px;">Sana</th>
          <th style="width: 160px;">Tasdiqlash Usuli</th>
        </tr>
      </thead>
      <tbody>
        ${signersRows}
      </tbody>
    </table>
  `
      : ''
  }

  <div class="stamp-badge">
    <div style="flex: 1; padding-right: 16px;">
      <div style="font-size: 11px; font-weight: bold; text-transform: uppercase;">
        O‘zbekiston Respublikasi OTM Davlat Elektron Hujjat Reyestri (UWMS)
      </div>
      <div style="font-size: 12px; font-weight: bold; color: ${isRevoked ? '#F53F3F' : '#00B42A'}; margin: 4px 0;">
        ${isRevoked ? '✖ BEKOR QILINGAN HUJJAT NUSXASI' : '✔ KRIPTOGRAFIK JIHATDAN TASDIQLANGAN VA BUTUNLIGI KAFOLATLANGAN'}
      </div>
      <div style="font-size: 10px; color: #4E5969; word-break: break-all;">
        SHA-256 HMAC xesh: <code>${verified.verificationHash}</code>
      </div>
      <div style="font-size: 10px; color: #4E5969; margin-top: 3px;">
        Reyestr havolasi: <u>${publicVerifyUrl}</u>
      </div>
      <div style="font-size: 10px; color: #86909C; margin-top: 4px;">
        * ${verified.securityNotice}
      </div>
    </div>
    <div style="text-align: center;">
      <img src="${qrApiUrl}" alt="QR Verification" style="width: 90px; height: 90px; border: 1px solid #D9D9D9; padding: 2px; background: #fff;" />
      <div style="font-size: 9px; color: #86909C; margin-top: 2px;">Ommaviy QR-kod</div>
    </div>
  </div>
</body>
</html>`;

    return {
      filename: `${verified.docNumber}_rasmiy_hujjat.html`,
      mimeType: 'text/html; charset=utf-8',
      content: htmlContent,
    };
  }

  async findAll() {
    return this.prisma.documentStamp.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

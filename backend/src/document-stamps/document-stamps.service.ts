import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentStampDto } from './document-stamp.dto';
import { DOCUMENT_VERIFICATION } from '../common/constants';
import * as crypto from 'crypto';

@Injectable()
export class DocumentStampsService {
  constructor(private readonly prisma: PrismaService) {}

  generateHash(docNumber: string, docType: string, signerName: string, createdAt: Date): string {
    const raw = `${docNumber}|${docType}|${signerName}|${createdAt.toISOString()}`;
    return crypto
      .createHmac('sha256', DOCUMENT_VERIFICATION.SECRET_SALT)
      .update(raw)
      .digest('hex');
  }

  async stampDocument(dto: CreateDocumentStampDto) {
    const now = new Date();
    const verificationHash = this.generateHash(dto.docNumber, dto.docType, dto.signerName, now);
    const metadataJson = JSON.stringify(dto.metadata || {});

    const stamp = await this.prisma.documentStamp.upsert({
      where: { docNumber: dto.docNumber },
      update: {
        title: dto.title,
        signerName: dto.signerName,
        signerRole: dto.signerRole,
        metadataJson,
        verificationHash,
        isValid: true,
      },
      create: {
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

    return {
      ...stamp,
      verificationUrl,
    };
  }

  async verifyPublic(docNumber: string) {
    const stamp = await this.prisma.documentStamp.findUnique({
      where: { docNumber },
    });

    if (!stamp) {
      // If not in database yet, let's see if this is an existing document in UWMS:
      // Check Request (OS-2), TransferAcceptance (OS-1), WriteOffRequest (OS-4), InventoryAudit (INV-19)
      const fallback = await this.tryAutoStampExisting(docNumber);
      if (fallback) {
        return fallback;
      }
      throw new NotFoundException(`Hujjat raqami '${docNumber}' bo‘yicha davlat reyestridan ma’lumot topilmadi.`);
    }

    let parsedMetadata = {};
    try {
      parsedMetadata = JSON.parse(stamp.metadataJson);
    } catch {
      // ignore
    }

    return {
      isValid: stamp.isValid,
      status: stamp.isValid ? 'VERIFIED' : 'REVOKED',
      certificateTitle: "O'zbekiston Respublikasi OTM Davlat Standarti Bo'yicha Tasdiqlangan Hujjat",
      docNumber: stamp.docNumber,
      docType: stamp.docType,
      title: stamp.title,
      signerName: stamp.signerName,
      signerRole: stamp.signerRole,
      verificationHash: stamp.verificationHash,
      issuedAt: stamp.createdAt,
      metadata: parsedMetadata,
    };
  }

  private async tryAutoStampExisting(docNumber: string) {
    // Check if it matches OS-2 (Requests with referenceDoc or OS-2 format)
    const request = await this.prisma.request.findFirst({
      where: {
        OR: [
          { requestNumber: docNumber },
          { id: docNumber },
        ],
        status: 'FULFILLED',
      },
      include: {
        requester: true,
        approvedBy: true,
        department: true,
        items: { include: { item: true } },
      },
    });

    if (request) {
      const signer = request.approvedBy?.fullName || 'Bosh omborchi';
      return this.stampDocument({
        docType: 'OS_2',
        docNumber: request.requestNumber,
        title: `OS-2 Chiqim Nakladnoyi (${request.purpose})`,
        signerName: signer,
        signerRole: request.approvedBy?.position || 'Bosh omborchi',
        metadata: {
          purpose: request.purpose,
          department: request.department?.name,
          items: request.items.map((i) => ({
            name: i.item.name,
            qty: i.approvedQty || i.requestedQty,
            unit: i.item.unit,
          })),
        },
      });
    }

    // Check if it matches Write-Off OS-4
    const writeOff = await this.prisma.writeOffRequest.findFirst({
      where: { actNumber: docNumber },
      include: {
        asset: { include: { item: true, room: true } },
        createdBy: true,
        members: { include: { user: true } },
      },
    });

    if (writeOff) {
      return this.stampDocument({
        docType: 'OS_4',
        docNumber: writeOff.actNumber,
        title: `OS-4 Hisobdan Chiqarish Dalolatnomasi (${writeOff.asset.item.name})`,
        signerName: writeOff.createdBy.fullName,
        signerRole: 'Komissiya Raisi',
        metadata: {
          assetName: writeOff.asset.item.name,
          inventoryNumber: writeOff.asset.inventoryNumber,
          reason: writeOff.reason,
          membersCount: writeOff.members.length,
          status: writeOff.status,
        },
      });
    }

    return null;
  }

  async findAll() {
    return this.prisma.documentStamp.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

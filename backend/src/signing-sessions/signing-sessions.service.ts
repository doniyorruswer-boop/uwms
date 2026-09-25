import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { EventsGateway } from '../events/events.gateway';
import { InitSigningSessionDto, ConfirmBiometricSignDto, InitHandoverSigningSessionDto } from './signing-session.dto';
import { DOCUMENT_VERIFICATION, SYSTEM_AUDIT_ACTIONS } from '../common/constants';
import { RequestContext } from '../common/context/request-context';
import * as crypto from 'crypto';

@Injectable()
export class SigningSessionsService {
  private readonly logger = new Logger(SigningSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentStampsService: DocumentStampsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Initializes a 60-second dynamic signing session for Desktop QR-pairing.
   */
  async initSession(dto: InitSigningSessionDto, userId: string) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds life

    let signerName: string | null = dto.targetSignerName || null;
    let signerRole: string | null = dto.targetSignerRole || null;
    let signedById: string | null = dto.targetUserId || null;

    if (userId && this.prisma.user) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        if (user.role === RoleType.SUPER_ADMIN && (!dto.targetUserId || dto.targetUserId === userId)) {
          throw new ForbiddenException(
            'SUPER_ADMIN tizim administratori hisoblanadi va moddiy-moliyaviy hujjatlarga imzo qo‘yish huquqiga ega emas!',
          );
        }
        if (!signerName) {
          signerName = user.fullName;
          signerRole = user.role;
          signedById = user.id;
        }
      }
    }

    const session = await this.prisma.signingSession.create({
      data: {
        sessionToken,
        docNumber: dto.docNumber,
        docType: dto.docType,
        title: dto.title,
        departmentName: dto.departmentName || null,
        roomName: dto.roomName || null,
        itemSummary: dto.itemSummary,
        metadataJson: dto.metadata ? JSON.stringify(dto.metadata) : null,
        status: 'PENDING',
        expiresAt,
        createdById: userId,
        signerName,
        signerRole,
        signedById,
      },
    });

    const qrUrl = `${DOCUMENT_VERIFICATION.PUBLIC_BASE_URL}/mobile/sign/${sessionToken}`;

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      qrUrl,
      docNumber: session.docNumber,
      docType: session.docType,
      title: session.title,
      itemSummary: session.itemSummary,
      expiresAt: session.expiresAt,
      remainingSeconds: 60,
      expectedSignerName: session.signerName,
      expectedSignerRole: session.signerRole,
    };
  }

  /**
   * Initializes a multi-party signing session specifically tailored for a Handover Act.
   */
  async initHandoverSession(
    dto: InitHandoverSigningSessionDto,
    initiatorId: string,
  ) {
    const handover = await this.prisma.responsibilityHandover.findFirst({
      where: { OR: [{ id: dto.handoverId }, { handoverNumber: dto.handoverId }] },
      include: {
        departingUser: { include: { department: true } },
        targetUser: { include: { department: true } },
        commandantUser: true,
        accountantUser: true,
        targetWarehouse: { include: { manager: true } },
        building: true,
        room: true,
        items: {
          include: {
            itemInstance: { include: { item: true } },
          },
        },
      },
    });

    if (!handover) {
      throw new NotFoundException('Topshirish dalolatnomasi topilmadi!');
    }

    if (handover.status === 'COMPLETED') {
      throw new BadRequestException('Ushbu dalolatnoma allaqachon to‘liq imzolangan va yakunlangan!');
    }

    let targetUser: any = null;
    let expectedRole = 'Mas’ul Shaxs';

    if (dto.signatoryRole === 'DEPARTING') {
      targetUser = handover.departingUser;
      expectedRole = handover.departingUser?.position || 'Topshiruvchi MOL';
    } else if (dto.signatoryRole === 'TARGET') {
      targetUser = handover.targetUser || handover.targetWarehouse?.manager;
      expectedRole = handover.targetUser?.position || 'Qabul qiluvchi MOL / Omborchi';
    } else if (dto.signatoryRole === 'COMMANDANT') {
      targetUser = handover.commandantUser;
      expectedRole = handover.commandantUser?.position || 'Bino Komendanti';
    } else if (dto.signatoryRole === 'ACCOUNTANT') {
      targetUser = handover.accountantUser;
      expectedRole = handover.accountantUser?.position || 'Moddiy Hisobchi / Buxgalter';
    }

    if (!targetUser) {
      throw new BadRequestException(`Tanlangan '${dto.signatoryRole}' roli bo‘yicha mas’ul shaxs biriktirilmagan!`);
    }

    const itemsSummary = handover.items.slice(0, 15).map((it) => ({
      inventoryNumber: it.itemInstance.inventoryNumber,
      name: it.itemInstance.item.name,
      actionType: it.actionType,
      conditionNote: it.conditionNote,
    }));

    return this.initSession(
      {
        docNumber: handover.handoverNumber,
        docType: 'HANDOVER_ACT',
        title: `Moddiy Javobgarlikni Topshirish Dalolatnomasi (${handover.handoverNumber})`,
        departmentName: handover.departingUser?.department?.name || 'Universitet',
        roomName: handover.room ? `${handover.room.number}-xona` : (handover.building?.name || 'Universitet binosi'),
        itemSummary: `${handover.items.length} ta aktiv: ${handover.items.slice(0, 3).map((i) => i.itemInstance.item.name).join(', ')}${handover.items.length > 3 ? '...' : ''}`,
        targetSignerName: targetUser.fullName,
        targetSignerRole: expectedRole,
        targetUserId: targetUser.id,
        metadata: {
          handoverId: handover.id,
          handoverNumber: handover.handoverNumber,
          signatoryRole: dto.signatoryRole,
          isHandover: true,
          type: handover.type,
          departingUser: handover.departingUser.fullName,
          targetUser: handover.targetUser?.fullName || handover.targetWarehouse?.name,
          building: handover.building?.name,
          room: handover.room ? `${handover.room.number}-xona (${handover.room.name})` : undefined,
          itemsCount: handover.items.length,
          items: itemsSummary,
        },
      },
      initiatorId,
    );
  }

  /**
   * Public endpoint accessed by mobile phone upon QR code scanning.
   * Advances PENDING -> SCANNED so the desktop knows the device is connected.
   */
  async getSessionPublic(sessionToken: string) {
    const session = await this.prisma.signingSession.findUnique({
      where: { sessionToken },
      include: {
        stamp: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Bir martalik imzolash sessiyasi topilmadi.');
    }

    const now = new Date();

    // Check expiration
    if (now > session.expiresAt && session.status !== 'SIGNED') {
      if (session.status !== 'EXPIRED') {
        await this.prisma.signingSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });
      }
      return {
        sessionId: session.id,
        sessionToken: session.sessionToken,
        docNumber: session.docNumber,
        docType: session.docType,
        title: session.title,
        itemSummary: session.itemSummary,
        status: 'EXPIRED',
        expiresAt: session.expiresAt,
        remainingSeconds: 0,
        message: '60 soniyalik imzolash muddati tugagan.',
        expectedSignerName: session.signerName,
        expectedSignerRole: session.signerRole,
      };
    }

    // Advance PENDING -> SCANNED if currently active
    let currentStatus = session.status;
    if (session.status === 'PENDING') {
      await this.prisma.signingSession.update({
        where: { id: session.id },
        data: { status: 'SCANNED' },
      });
      currentStatus = 'SCANNED';

      // Real-Time Desktop QR Handshake: Telefon ulandi!
      const deviceConnectedPayload = {
        sessionId: session.id,
        sessionToken: session.sessionToken,
        status: 'SCANNED',
        docNumber: session.docNumber,
        docType: session.docType,
        title: session.title,
        expectedSignerName: session.signerName,
        expectedSignerRole: session.signerRole,
        time: new Date().toISOString(),
      };
      this.eventsGateway.emitToRoom(`session:${session.id}`, 'qr:device_connected', deviceConnectedPayload);
      this.eventsGateway.emitToRoom(`session:${session.sessionToken}`, 'qr:device_connected', deviceConnectedPayload);
    }

    let parsedMetadata = {};
    if (session.metadataJson) {
      try {
        parsedMetadata = JSON.parse(session.metadataJson);
      } catch {
        // ignore
      }
    }

    const sanitizedMetadata = this.documentStampsService.sanitizePublicMetadata(parsedMetadata);
    const remainingSeconds = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      docNumber: session.docNumber,
      docType: session.docType,
      title: session.title,
      departmentName: session.departmentName,
      roomName: session.roomName,
      itemSummary: session.itemSummary,
      metadata: sanitizedMetadata,
      status: currentStatus,
      expiresAt: session.expiresAt,
      remainingSeconds,
      stamp: session.stamp,
      expectedSignerName: session.signerName,
      expectedSignerRole: session.signerRole,
    };
  }

  /**
   * Confirms mobile biometric signing (TouchID/FaceID), stamps the document permanently,
   * and transitions the session to SIGNED.
   */
  async confirmBiometricSign(sessionToken: string, dto: ConfirmBiometricSignDto, ipAddress?: string) {
    const session = await this.prisma.signingSession.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      throw new NotFoundException('Imzolash sessiyasi topilmadi.');
    }

    if (session.status === 'SIGNED') {
      throw new BadRequestException('Ushbu hujjat allaqachon imzolangan! (Single-use nonce)');
    }

    if (session.status === 'CANCELLED') {
      throw new BadRequestException('Ushbu imzolash sessiyasi bekor qilingan!');
    }

    const now = new Date();
    if (now > session.expiresAt) {
      await this.prisma.signingSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('60 soniyalik imzolash muddati tugagan! Kompyuterda QR-kodni yangilang.');
    }

    // 1. Biometrik (Passkey / WebAuthn) va GPS geolokatsiya mavjudligini tekshirish
    if (!dto.credentialId || !dto.credentialId.trim()) {
      throw new BadRequestException(
        'Biometrik (TouchID/FaceID) tasdiq ma’lumotlari topilmadi! Hujjat imzolanmadi.',
      );
    }

    if (
      !dto.location ||
      typeof dto.location.latitude !== 'number' ||
      typeof dto.location.longitude !== 'number'
    ) {
      throw new BadRequestException(
        'GPS geolokatsiya koordinatalari topilmadi! Hujjatni imzolash uchun brauzerda geolokatsiyaga ruxsat berish shart.',
      );
    }

    // Determine final signer name and role with authentic binding check
    let finalSignerName = (dto.signerName || '').trim();
    let finalSignerRole = (dto.signerRole || '').trim();

    if (finalSignerRole === 'SUPER_ADMIN' || finalSignerRole === RoleType.SUPER_ADMIN) {
      throw new ForbiddenException(
        'SUPER_ADMIN moddiy-moliyaviy hujjatlarni imzolash huquqiga ega emas! Faqat tayinlangan mas’ul shaxslar imzolashi mumkin.',
      );
    }

    if (session.signerName) {
      if (finalSignerName && finalSignerName.toLowerCase() !== session.signerName.toLowerCase()) {
        throw new BadRequestException(
          `Imzolash huquqi faqat biriktirilgan mas’ul shaxsga (${session.signerName}) tegishli! Begona shaxs nomidan imzo qo‘yish qat’iyan man etiladi.`,
        );
      }
      finalSignerName = session.signerName;
      finalSignerRole = session.signerRole || finalSignerRole || 'Mas’ul Shaxs';
    } else {
      if (!finalSignerName) {
        throw new BadRequestException('Imzolovchi shaxsning F.I.Sh. kiritilishi shart!');
      }
      if (!finalSignerRole) {
        finalSignerRole = 'Mas’ul Shaxs';
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create or link permanent cryptographic Write-Once stamp
      let stamp = await tx.documentStamp.findUnique({
        where: { docNumber: session.docNumber },
      });

      let parsedMetadata: any = {};
      if (session.metadataJson) {
        try {
          parsedMetadata = JSON.parse(session.metadataJson);
        } catch {
          parsedMetadata = {};
        }
      }

      const resolvedIp =
        (ipAddress && ipAddress !== '::1' ? ipAddress : null) ||
        RequestContext.getClientIp() ||
        (ipAddress || null);

      const resolvedUserAgent =
        dto.deviceInfo ||
        RequestContext.getUserAgent() ||
        'Mobile Device';

      const dynamicSignature = {
        role: finalSignerRole,
        name: finalSignerName,
        isSigned: true,
        signedAt: now.toISOString(),
        method: 'Dinamik QR-Pairing (Biometrik Tasdiq)',
        biometricType: dto.biometricType || 'TOUCH_ID',
        deviceInfo: resolvedUserAgent,
        ipAddress: resolvedIp,
        location: dto.location || null,
        credentialId: dto.credentialId || null,
      };

      if (!parsedMetadata.signatures || !Array.isArray(parsedMetadata.signatures)) {
        parsedMetadata.signatures = [dynamicSignature];
      } else {
        const existingIdx = parsedMetadata.signatures.findIndex(
          (s: any) => s.name?.toLowerCase() === finalSignerName.toLowerCase() || s.role === finalSignerRole,
        );
        if (existingIdx >= 0) {
          parsedMetadata.signatures[existingIdx] = {
            ...parsedMetadata.signatures[existingIdx],
            ...dynamicSignature,
          };
        } else {
          parsedMetadata.signatures.push(dynamicSignature);
        }
      }

      if (!stamp) {
        const verificationHash = this.documentStampsService.generateHash(
          session.docNumber,
          session.docType,
          finalSignerName,
          now,
          parsedMetadata,
        );

        stamp = await tx.documentStamp.create({
          data: {
            docType: session.docType,
            docNumber: session.docNumber,
            title: session.title,
            signerName: finalSignerName,
            signerRole: finalSignerRole,
            verificationHash,
            metadataJson: JSON.stringify(parsedMetadata),
            isValid: true,
            createdAt: now,
          },
        });
      }

      // 2. Update SigningSession to SIGNED
      const updatedSession = await tx.signingSession.update({
        where: { id: session.id },
        data: {
          status: 'SIGNED',
          signedAt: now,
          signerName: finalSignerName,
          signerRole: finalSignerRole,
          biometricType: dto.biometricType || 'TOUCH_ID',
          deviceInfo: resolvedUserAgent,
          ipAddress: resolvedIp,
          stampId: stamp.id,
          metadataJson: JSON.stringify(parsedMetadata),
        },
        include: {
          stamp: true,
        },
      });

      // 3. Record Audit Log with full IP, location and cryptographic credential
      await tx.systemAuditLog.create({
        data: {
          userId: session.signedById || session.createdById,
          action: SYSTEM_AUDIT_ACTIONS.BIOMETRIC_SIGNED,
          entity: 'SigningSession',
          entityId: session.id,
          ipAddress: resolvedIp,
          userAgent: resolvedUserAgent,
          details: JSON.stringify({
            docNumber: session.docNumber,
            docType: session.docType,
            signerName: finalSignerName,
            signerRole: finalSignerRole,
            biometricType: dto.biometricType || 'TOUCH_ID',
            deviceInfo: resolvedUserAgent,
            ipAddress: resolvedIp,
            location: dto.location || null,
            credentialId: dto.credentialId || null,
            stampHash: stamp.verificationHash,
          }),
        },
      });

      // 4. If this session belongs to a ResponsibilityHandover, update its signature trail and log audit
      if (parsedMetadata?.handoverId) {
        const handover = await tx.responsibilityHandover.findUnique({
          where: { id: parsedMetadata.handoverId },
        });
        if (handover && handover.status !== 'COMPLETED') {
          const signBadge = `[✔ ${parsedMetadata.signatoryRole || 'Ishtirokchi'} imzoladi: ${finalSignerName} (${finalSignerRole}) - ${now.toISOString()}]`;
          const currentNote = handover.note || '';
          const updatedNote = currentNote ? `${currentNote}\n${signBadge}` : signBadge;

          await tx.responsibilityHandover.update({
            where: { id: handover.id },
            data: { note: updatedNote },
          });

          await tx.systemAuditLog.create({
            data: {
              userId: session.signedById || session.createdById,
              action: 'HANDOVER_PARTY_SIGNED',
              entity: 'ResponsibilityHandover',
              entityId: handover.id,
              ipAddress: resolvedIp,
              userAgent: resolvedUserAgent,
              details: JSON.stringify({
                handoverNumber: handover.handoverNumber,
                partyRole: parsedMetadata.signatoryRole,
                signerName: finalSignerName,
                signerRole: finalSignerRole,
                signedAt: now.toISOString(),
                biometricType: dto.biometricType || 'TOUCH_ID',
                ipAddress: resolvedIp,
              }),
            },
          });
        }
      }

      this.logger.log(`Document ${session.docNumber} successfully signed via ${dto.biometricType || 'TOUCH_ID'} by ${finalSignerName} (IP: ${resolvedIp || 'unknown'})`);

      const signResult = {
        success: true,
        sessionId: updatedSession.id,
        status: updatedSession.status,
        docNumber: updatedSession.docNumber,
        signedAt: updatedSession.signedAt,
        signerName: updatedSession.signerName,
        signerRole: updatedSession.signerRole,
        biometricType: updatedSession.biometricType,
        ipAddress: updatedSession.ipAddress,
        location: dto.location || null,
        stamp: updatedSession.stamp,
      };

      // Real-Time Desktop QR Handshake: Imzolandi va muhrlandi!
      this.eventsGateway.emitToRoom(`session:${session.id}`, 'qr:signature_completed', signResult);
      this.eventsGateway.emitToRoom(`session:${session.sessionToken}`, 'qr:signature_completed', signResult);

      return signResult;
    });
  }

  /**
   * Status polling for the desktop browser modal (every 1-1.5s).
   */
  async getSessionStatus(sessionId: string) {
    const session = await this.prisma.signingSession.findUnique({
      where: { id: sessionId },
      include: {
        stamp: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Sessiya topilmadi.');
    }

    const now = new Date();
    let currentStatus = session.status;

    if (now > session.expiresAt && session.status !== 'SIGNED') {
      if (session.status !== 'EXPIRED') {
        await this.prisma.signingSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });
      }
      currentStatus = 'EXPIRED';
    }

    const remainingSeconds = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      sessionId: session.id,
      status: currentStatus,
      remainingSeconds,
      docNumber: session.docNumber,
      title: session.title,
      signerName: session.signerName,
      signerRole: session.signerRole,
      signedAt: session.signedAt,
      biometricType: session.biometricType,
      stamp: session.stamp,
    };
  }

  /**
   * Cancels session when desktop user closes the modal.
   */
  async cancelSession(sessionId: string) {
    const session = await this.prisma.signingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Sessiya topilmadi.');
    }

    if (session.status === 'SIGNED') {
      return session;
    }

    const updated = await this.prisma.signingSession.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED' },
    });

    this.eventsGateway.emitToRoom(`session:${sessionId}`, 'qr:session_cancelled', { sessionId, sessionToken: session.sessionToken });
    this.eventsGateway.emitToRoom(`session:${session.sessionToken}`, 'qr:session_cancelled', { sessionId, sessionToken: session.sessionToken });
    return updated;
  }
}

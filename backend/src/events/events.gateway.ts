import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * UWMS Markazlashtirilgan Real-Time Voqealar Shlyuzi (EventsGateway).
 * 
 * Barcha real-time modullar (QR-imzolash, audit skanerlash, 7-bosqichli zayavka,
 * ombor qoldiqlari va rolli bildirishnomalar) ushbu shlyuz orqali ishlaydi.
 * 
 * Xavfsizlik:
 * - Har bir soket ulanishi paytida JWT Bearer token orqali tekshiriladi;
 * - Yaroqsiz yoki muddati o‘tgan tokenlar darhol uziladi;
 * - Har bir foydalanuvchi avtomatik tarzda `user:${id}` va `role:${role}` xonalariga biriktiriladi.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('UWMS Socket.IO Real-Time Gateway muvaffaqiyatli ishga tushdi (/realtime namespace)');
  }

  /**
   * Klient ulanishi paytida xavfsiz JWT Handshake tekshiruvi (WsJwtGuard mantig‘i)
   */
  async handleConnection(client: Socket) {
    try {
      // 1. Tokenni auth payload yoki headers dan ajratib olish
      const authHeader = client.handshake.headers?.authorization;
      const authToken =
        client.handshake.auth?.token ||
        (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader);

      if (!authToken) {
        this.logger.warn(`[WsAuth] Ulanish rad etildi: Token taqdim etilmadi (Client: ${client.id})`);
        client.emit('error', { message: 'Avtorizatsiya tokeni talab qilinadi!' });
        client.disconnect(true);
        return;
      }

      // 2. JWT tokenni maxfiy kalit bilan tekshirish
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(authToken, { secret });

      if (!payload || !payload.sub) {
        this.logger.warn(`[WsAuth] Yaroqsiz JWT token (Client: ${client.id})`);
        client.disconnect(true);
        return;
      }

      // 3. Foydalanuvchining bazada faolligini tekshirish
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          fullName: true,
          username: true,
          role: true,
          isActive: true,
          departmentId: true,
        },
      });

      if (!user || !user.isActive) {
        this.logger.warn(`[WsAuth] Foydalanuvchi faol emas yoki topilmadi (User ID: ${payload.sub})`);
        client.disconnect(true);
        return;
      }

      // 4. Client metama’lumotlariga foydalanuvchini biriktirish
      client.data.user = user;

      // 5. Xonalarga avtomatik a’zo qilish
      const userRoom = `user:${user.id}`;
      const roleRoom = `role:${user.role}`;

      await client.join(userRoom);
      await client.join(roleRoom);

      this.logger.log(
        `[WsConnect] Ulandi: ${user.fullName} (${user.role}) | Socket: ${client.id} | Xonalar: [${userRoom}, ${roleRoom}]`,
      );

      // Klientga muvaffaqiyatli ulanish signali va vaqt tamg‘asini yuborish
      client.emit('connection:established', {
        socketId: client.id,
        userId: user.id,
        fullName: user.fullName,
        role: user.role,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.error(`[WsAuth Error] Handshake xatoligi (Client: ${client.id}): ${err?.message}`);
      client.emit('error', { message: 'Token tasdiqlanmadi yoki muddati o‘tgan!' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) {
      this.logger.log(`[WsDisconnect] Aloqa uzildi: ${user.fullName} (${client.id})`);
    } else {
      this.logger.log(`[WsDisconnect] Aloqa uzildi (Anonim): ${client.id}`);
    }
  }

  // ==========================================
  // XONALAR VA HODISALARNI BOSHQARISH (MESSAGING)
  // ==========================================

  /**
   * Aloqani tekshiruvchi Heartbeat (Ping -> Pong)
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  /**
   * Maxsus xonaga qo‘shilish (Masalan: `session:SES-1234` yoki `campaign:CAMP-01`)
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { room?: string; roomName?: string },
  ) {
    const roomName = typeof payload === 'string' ? payload : (payload?.room || payload?.roomName);
    if (!roomName || typeof roomName !== 'string') {
      return { status: 'error', message: 'Xona nomi xato' };
    }
    await client.join(roomName);
    this.logger.debug(`Client ${client.id} xonaga qo‘shildi: ${roomName}`);
    return { status: 'ok', room: roomName };
  }

  /**
   * Xonadan chiqish
   */
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { room?: string; roomName?: string },
  ) {
    const roomName = typeof payload === 'string' ? payload : (payload?.room || payload?.roomName);
    if (!roomName || typeof roomName !== 'string') {
      return { status: 'error', message: 'Xona nomi xato' };
    }
    await client.leave(roomName);
    this.logger.debug(`Client ${client.id} xonani tark etdi: ${roomName}`);
    return { status: 'ok', room: roomName };
  }

  /**
   * FAZA 1: Mobil telefon QR-kodni skanerlaganda (Instant Handshake)
   * Desktop ekranga darhol "Mobil qurilma ulandi" signali yuboriladi.
   */
  @SubscribeMessage('qr:device_connected')
  async handleDeviceConnected(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string; sessionToken?: string; deviceInfo?: string; signerName?: string; signerRole?: string },
  ) {
    const sessionKey = payload?.sessionId || payload?.sessionToken;
    if (!sessionKey) return { status: 'error', message: 'Sessiya identifikatori kiritilmadi' };
    const room = `session:${sessionKey}`;
    this.logger.log(`[QR-Pairing] Mobil qurilma ulandi: ${client.id} -> ${room}`);

    const eventData = {
      ...payload,
      status: 'SCANNED',
      connectedAt: new Date().toISOString(),
      clientSocketId: client.id,
    };

    // Sessiya xonasidagi barcha tinglovchilarga (desktop brauzerga) uzatish
    this.server.to(room).emit('qr:device_connected', eventData);
    if (payload?.sessionId && payload?.sessionToken) {
      this.server.to(`session:${payload.sessionId}`).emit('qr:device_connected', eventData);
      this.server.to(`session:${payload.sessionToken}`).emit('qr:device_connected', eventData);
    }
    return { status: 'ok', room };
  }

  /**
   * FAZA 1: Mobil qurilmada biometrik imzo (FaceID/TouchID) muvaffaqiyatli yakunlanganda
   */
  @SubscribeMessage('qr:signature_completed')
  async handleSignatureCompleted(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const sessionKey = payload?.sessionId || payload?.sessionToken;
    if (!sessionKey) return { status: 'error', message: 'Sessiya identifikatori kiritilmadi' };
    const room = `session:${sessionKey}`;
    this.logger.log(`[QR-Pairing] Mobil biometrik imzo yakunlandi: ${client.id} -> ${room}`);

    const eventData = {
      ...payload,
      status: 'SIGNED',
      signedAt: payload?.signedAt || new Date().toISOString(),
    };

    this.server.to(room).emit('qr:signature_completed', eventData);
    if (payload?.sessionId && payload?.sessionToken) {
      this.server.to(`session:${payload.sessionId}`).emit('qr:signature_completed', eventData);
      this.server.to(`session:${payload.sessionToken}`).emit('qr:signature_completed', eventData);
    }
    return { status: 'ok', room };
  }

  /**
   * Imzolash sessiyasi bekor qilinganda
   */
  @SubscribeMessage('qr:session_cancelled')
  async handleSessionCancelled(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string; sessionToken?: string; reason?: string },
  ) {
    const sessionKey = payload?.sessionId || payload?.sessionToken;
    if (!sessionKey) return { status: 'error', message: 'Sessiya identifikatori kiritilmadi' };
    const room = `session:${sessionKey}`;
    this.logger.log(`[QR-Pairing] Imzolash sessiyasi bekor qilindi: ${client.id} -> ${room}`);

    const eventData = {
      ...payload,
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
    };

    this.server.to(room).emit('qr:session_cancelled', eventData);
    return { status: 'ok', room };
  }

  /**
   * FAZA 2: Ko‘p foydalanuvchili real-time audit skanerlash (Multi-Auditor Sync)
   */
  @SubscribeMessage('audit:scan_asset')
  async handleAuditScan(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const campaignId = payload?.campaignId;
    const roomId = payload?.roomId;

    this.logger.debug(`[Multi-Auditor] Skanerlandi: ${payload?.asset?.inventoryNumber || 'Ashyo'} (Client: ${client.id})`);

    if (campaignId) {
      this.server.to(`campaign:${campaignId}`).emit('audit:asset_scanned', payload);
    }
    if (roomId) {
      this.server.to(`room:${roomId}`).emit('audit:asset_scanned', payload);
    }
    return { status: 'ok' };
  }

  // ==========================================
  // SERVER TOMONIDAN CHAQIRILUVCHI EMITTERLAR
  // ==========================================

  /**
   * Aniq bir foydalanuvchiga shaxsiy xabar yuborish
   */
  emitToUser(userId: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      _emittedAt: new Date().toISOString(),
    });
  }

  /**
   * Biror roldagi barcha faol foydalanuvchilarga xabar tarqatish (Masalan: `HEAD_WAREHOUSE`, `RECTOR`)
   */
  emitToRole(role: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`role:${role}`).emit(event, {
      ...data,
      _emittedAt: new Date().toISOString(),
    });
  }

  /**
   * Aniq bir xonadagi barcha tinglovchilarga xabar tarqatish (Masalan: QR sessiyasi yoki Audit kampaniyasi)
   */
  emitToRoom(roomName: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(roomName).emit(event, {
      ...data,
      _emittedAt: new Date().toISOString(),
    });
  }

  /**
   * Tizimdagi barcha faol ulangan foydalanuvchilarga xabar tarqatish
   */
  broadcast(event: string, data: any) {
    if (!this.server) return;
    this.server.emit(event, {
      ...data,
      _emittedAt: new Date().toISOString(),
    });
  }
}

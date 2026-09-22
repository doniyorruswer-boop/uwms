import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'offline';

export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private isConnecting: boolean = false;
  private activeRooms: Set<string> = new Set();
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[Socket.IO] Error in status listener:', e);
        }
      });
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public subscribeStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Socket.IO server manzilini API_BASE_URL dan aniqlash
   */
  private getSocketUrl(): string {
    const rawUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    // Agar nisbiy bo'lsa (productionda), joriy origin olinadi
    if (!rawUrl || rawUrl === '' || rawUrl.startsWith('/')) {
      return typeof window !== 'undefined' ? `${window.location.origin}/realtime` : '/realtime';
    }
    return `${rawUrl}/realtime`;
  }

  /**
   * JWT Access Token orqali WebSocket aloqasini o‘rnatish (Handshake)
   */
  public connect(token: string): Socket {
    if (this.socket?.connected) {
      this.setStatus('connected');
      return this.socket;
    }

    if (this.isConnecting && this.socket) {
      return this.socket;
    }

    this.isConnecting = true;
    this.setStatus('connecting');
    const socketUrl = this.getSocketUrl();

    this.socket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // Cheksiz qayta urinish (Universitet kompyuterlari uchun)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5, // Thundering herd himoyasi (Jitter)
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      this.setStatus('connected');
      console.log(`[Socket.IO] Ulandi: ID=${this.socket?.id} | Url=${socketUrl}`);

      // Aloqa o‘rnatilganda yoki qayta tiklanganda (reconnect) barcha faol xonalarga avtomatik a’zo bo‘lish
      this.activeRooms.forEach((room) => {
        this.socket?.emit('join_room', room);
        console.log(`[Socket.IO] Xonaga qayta a’zo bo‘lindi: ${room}`);
      });
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.setStatus('reconnecting');
    });

    this.socket.on('connect_error', (err) => {
      this.isConnecting = false;
      this.setStatus('disconnected');
      console.warn('[Socket.IO] Ulanishda xatolik:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnecting = false;
      this.setStatus('disconnected');
      console.log('[Socket.IO] Aloqa uzildi:', reason);
    });

    return this.socket;
  }

  /**
   * Aloqani toza uzish (Logout paytida)
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      this.activeRooms.clear();
      console.log('[Socket.IO] Soket butunlay to‘xtatildi.');
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  /**
   * Maxsus xonaga a’zo bo‘lish (Masalan: `session:SES-123` yoki `session:TOKEN`)
   * Internet uzilib qayta ulanganda ham avtomatik saqlanib qoladi.
   */
  public joinRoom(roomName: string): void {
    if (!roomName) return;
    this.activeRooms.add(roomName);
    if (this.socket?.connected) {
      this.socket.emit('join_room', roomName);
    }
  }

  /**
   * Xonani tark etish
   */
  public leaveRoom(roomName: string): void {
    if (!roomName) return;
    this.activeRooms.delete(roomName);
    if (this.socket?.connected) {
      this.socket.emit('leave_room', roomName);
    }
  }

  /**
   * FAZA 1: Mobil telefon ulandi hodisasini xonaga uzatish
   */
  public emitDeviceConnected(payload: {
    sessionId?: string;
    sessionToken?: string;
    deviceInfo?: string;
    signerName?: string;
    signerRole?: string;
  }): void {
    if (this.socket?.connected) {
      this.socket.emit('qr:device_connected', payload);
    }
  }

  /**
   * FAZA 1: Mobil biometrik imzo tugallandi hodisasini xonaga uzatish
   */
  public emitSignatureCompleted(payload: any): void {
    if (this.socket?.connected) {
      this.socket.emit('qr:signature_completed', payload);
    }
  }

  /**
   * Imzolash sessiyasi bekor qilindi hodisasini uzatish
   */
  public emitSessionCancelled(payload: { sessionId?: string; sessionToken?: string; reason?: string }): void {
    if (this.socket?.connected) {
      this.socket.emit('qr:session_cancelled', payload);
    }
  }
}

export const socketService = SocketService.getInstance();

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Notification } from '@arco-design/web-react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService, ConnectionStatus } from '../services/socket.service';
import { useAuthStore } from '../store/authStore';

export interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  triggerFallbackSync: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionStatus: 'disconnected',
  joinRoom: () => {},
  leaveRoom: () => {},
  triggerFallbackSync: () => {},
});

export const useSocket = () => useContext(SocketContext);

// Soft subtle audio ping using Web Audio API (Rule 1 & Faza 6)
const playAudioPing = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Autoplay policy or browser audio disabled
  }
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(socketService.getStatus());

  /**
   * FAZA 7: Fallback Sync (Zero Data Loss)
   * Aloqa uzilib qayta ulanganda oraliqdagi o‘tkazib yuborilgan barcha ma’lumotlarni
   * HTTP orqali zaxira tekshirish va barcha kesh kalitlarini server bilan sinxronlash.
   */
  const triggerFallbackSync = useCallback(() => {
    console.log('[Socket.IO Fallback Sync] Server bilan ma’lumotlar to‘liq sinxronlashtirilmoqda...');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['requests'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse'] });
    queryClient.invalidateQueries({ queryKey: ['stocks'] });
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['writeOffs'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }, [queryClient]);

  useEffect(() => {
    const unsubscribeStatus = socketService.subscribeStatus((newStatus) => {
      setConnectionStatus(newStatus);
      setIsConnected(newStatus === 'connected');
    });

    return () => {
      unsubscribeStatus();
    };
  }, []);

  // Brauzer tarmoq holatini (online / offline) kuzatish
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Internet tarmog‘i tiklandi.');
      Notification.success({
        title: 'Tarmoq Tiklandi',
        content: 'Internet tarmog‘i tiklandi. Barcha ma’lumotlar yangilanmoqda...',
        duration: 3,
      });
      if (token && isAuthenticated) {
        socketService.connect(token);
        triggerFallbackSync();
      }
    };

    const handleOffline = () => {
      console.warn('[Network] Internet tarmog‘i uzildi.');
      Notification.warning({
        title: 'Tarmoq Uzildi',
        content: 'Internet aloqasi uzildi. Tizim oflayn rejimda, aloqa tiklangach barcha ma’lumotlar sinxronlashadi.',
        duration: 5,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token, isAuthenticated, triggerFallbackSync]);

  useEffect(() => {
    if (isAuthenticated && token) {
      const activeSocket = socketService.connect(token);
      setSocket(activeSocket);

      const onConnect = () => {
        setIsConnected(true);
      };

      const onDisconnect = () => {
        setIsConnected(false);
      };

      // Qayta ulanish (reconnect) muvaffaqiyatli bo'lganda Fallback Sync
      const onReconnect = () => {
        console.log('[Socket.IO] Qayta ulanish muvaffaqiyatli amalga oshirildi.');
        Notification.success({
          title: 'Jonli Aloqa Tiklandi',
          content: 'Real-time serverga qayta ulanildi. Ma’lumotlar sinxronlashtirildi.',
          duration: 3,
        });
        triggerFallbackSync();
      };

      activeSocket.on('connect', onConnect);
      activeSocket.on('disconnect', onDisconnect);
      activeSocket.io.on('reconnect', onReconnect);

      if (activeSocket.connected) {
        setIsConnected(true);
      }

      // ==========================================
      // GLOBAL VOQEALARNI TINGLASH (REACT QUERY INVALIDATION)
      // ==========================================

      // 1. Yangi bildirishnoma kelganda (Audio ping + Notification.info)
      const handleNewNotification = (data: any) => {
        playAudioPing();
        Notification.info({
          title: data.title || 'Yangi bildirishnoma',
          content: data.message || '',
          duration: 5,
        });

        // Bildirishnomalar soni va ro‘yxatini darhol yangilash
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      };

      // 2. Talabnoma statusi o‘zgarganda
      const handleRequestUpdated = () => {
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      };

      // 3. Ombor qoldiqlari o‘zgarganda
      const handleStockUpdated = () => {
        queryClient.invalidateQueries({ queryKey: ['warehouse'] });
        queryClient.invalidateQueries({ queryKey: ['stocks'] });
      };

      // 4. Xavfsizlik: Boshqa joydan yangi login bo'lganda ogohlantirish
      const handleConcurrentLogin = (data: any) => {
        playAudioPing();
        Notification.warning({
          title: 'Xavfsizlik Ogohlantirishi',
          content: data.message || 'Diqqat: Hisobingizga boshqa IP manzildan ulanish amalga oshirildi!',
          duration: 8,
        });
      };

      // 5. Xavfsizlik: Super Admin rolni o'zgartirganda yoki bloklaganda majburiy logout
      const handleForceLogout = (data: any) => {
        playAudioPing();
        Notification.error({
          title: 'Sessiya To‘xtatildi',
          content: data.reason || 'Sizning hisobingiz administrator tomonidan o‘zgartirildi yoki bloklandi. Xavfsizlik yuzasidan tizimdan chiqarildingiz.',
          duration: 10,
        });
        useAuthStore.getState().logout();
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
      };

      activeSocket.on('notification:new', handleNewNotification);
      activeSocket.on('request:updated', handleRequestUpdated);
      activeSocket.on('stock:updated', handleStockUpdated);
      activeSocket.on('security:concurrent_login', handleConcurrentLogin);
      activeSocket.on('security:force_logout', handleForceLogout);

      return () => {
        activeSocket.off('connect', onConnect);
        activeSocket.off('disconnect', onDisconnect);
        activeSocket.io.off('reconnect', onReconnect);
        activeSocket.off('notification:new', handleNewNotification);
        activeSocket.off('request:updated', handleRequestUpdated);
        activeSocket.off('stock:updated', handleStockUpdated);
        activeSocket.off('security:concurrent_login', handleConcurrentLogin);
        activeSocket.off('security:force_logout', handleForceLogout);
      };
    } else {
      socketService.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [isAuthenticated, token, queryClient, triggerFallbackSync]);

  const joinRoom = (room: string) => {
    socketService.joinRoom(room);
  };

  const leaveRoom = (room: string) => {
    socketService.leaveRoom(room);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionStatus,
        joinRoom,
        leaveRoom,
        triggerFallbackSync,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

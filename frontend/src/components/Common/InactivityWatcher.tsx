import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Typography, Button, Space, Progress, Notification } from '@arco-design/web-react';
import { IconExclamationCircle, IconCheckCircle, IconPoweroff } from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';

// Standart universitet va xavfsizlik parametri: 15 daqiqa faolsizlik
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 daqiqa = 900 000 ms
const WARNING_COUNTDOWN_SEC = 60; // Oxirgi 60 soniyada ogohlantirish
const STORAGE_KEY = 'uwms_last_activity_time';

export const InactivityWatcher: React.FC = () => {
  const { isAuthenticated, logout } = useAuthStore();
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(WARNING_COUNTDOWN_SEC);

  const lastActivityRef = useRef<number>(Date.now());
  const isWarningOpenRef = useRef<boolean>(false);

  // Faollikni yangilash (Multi-tab sinxronlash bilan)
  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {
      // LocalStorage access issues guard
    }

    if (isWarningOpenRef.current) {
      isWarningOpenRef.current = false;
      setShowWarningModal(false);
      setSecondsRemaining(WARNING_COUNTDOWN_SEC);
    }
  }, []);

  // Multi-tab sinxronizatsiyasi: Boshqa brauzer oynasidagi faollikni ham qabul qilish
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastActivityRef.current = remoteTime;
          if (isWarningOpenRef.current) {
            isWarningOpenRef.current = false;
            setShowWarningModal(false);
            setSecondsRemaining(WARNING_COUNTDOWN_SEC);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Foydalanuvchi amallarini (sichqoncha, klaviatura, scroll, teginish) kuzatish
  useEffect(() => {
    if (!isAuthenticated) return;

    // Har bir harakatda tez-tez chaqirmaslik uchun (Throttle: 1500ms)
    let lastHandled = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastHandled > 1500) {
        lastHandled = now;
        // Agar ogohlantirish oynasi ochiq bo'lsa, sichqoncha tasodifiy qimirlashi yopmasligi kerak,
        // foydalanuvchi "Davom ettirish" tugmasini bosishi lozim.
        if (!isWarningOpenRef.current) {
          lastActivityRef.current = now;
          try {
            localStorage.setItem(STORAGE_KEY, now.toString());
          } catch {}
        }
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [isAuthenticated]);

  // Taymer tsikli (Har 1 soniyada tekshiradi)
  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarningModal(false);
      isWarningOpenRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      // Boshqa tabdagi so'nggi vaqtni ham tekshirib olish
      let effectiveLastActivity = lastActivityRef.current;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > effectiveLastActivity) {
            effectiveLastActivity = parsed;
            lastActivityRef.current = parsed;
          }
        }
      } catch {}

      const elapsed = Date.now() - effectiveLastActivity;
      const timeLeftMs = INACTIVITY_TIMEOUT_MS - elapsed;
      const timeLeftSec = Math.max(0, Math.ceil(timeLeftMs / 1000));

      // 1. Agar vaqt butunlay tugagan bo'lsa -> Majburiy Logout
      if (timeLeftMs <= 0) {
        clearInterval(interval);
        isWarningOpenRef.current = false;
        setShowWarningModal(false);

        Notification.warning({
          title: 'Sessiya Yakunlandi',
          content: 'Xavfsizlik talabi: Siz 15 daqiqa davomida tizimda faol bo‘lmadingiz. Tizimdan avtomatik chiqarildingiz.',
          duration: 8,
        });

        logout();
        return;
      }

      // 2. Agar oxirgi 60 soniya qolgan bo'lsa -> Ogohlantirish modalini ochish
      if (timeLeftSec <= WARNING_COUNTDOWN_SEC) {
        if (!isWarningOpenRef.current) {
          isWarningOpenRef.current = true;
          setShowWarningModal(true);
        }
        setSecondsRemaining(timeLeftSec);
      } else {
        if (isWarningOpenRef.current) {
          isWarningOpenRef.current = false;
          setShowWarningModal(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  if (!isAuthenticated) return null;

  return (
    <Modal
      title={
        <Space size={8}>
          <IconExclamationCircle style={{ color: 'var(--color-warning-6)', fontSize: 22 }} />
          <Typography.Text bold style={{ fontSize: 16 }}>
            Faolsizlik Ogohlantirishi
          </Typography.Text>
        </Space>
      }
      visible={showWarningModal}
      closable={false}
      maskClosable={false}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button
            type="secondary"
            status="danger"
            icon={<IconPoweroff />}
            onClick={() => {
              isWarningOpenRef.current = false;
              setShowWarningModal(false);
              logout();
            }}
          >
            Chiqish
          </Button>

          <Button
            type="primary"
            icon={<IconCheckCircle />}
            onClick={resetInactivityTimer}
          >
            Sessiyani Davom Ettirish
          </Button>
        </div>
      }
      style={{ width: 440 }}
    >
      <div style={{ padding: '8px 0 16px' }}>
        <Typography.Paragraph style={{ marginBottom: 16, fontSize: 14 }}>
          Siz <strong>14 daqiqa</strong> davomida tizimda hech qanday amal bajarmadingiz. Xavfsizlik maqsadida
          sessiyangiz quyidagi vaqt ichida avtomatik yakunlanadi:
        </Typography.Paragraph>

        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Typography.Title heading={2} style={{ margin: 0, color: 'var(--color-danger-6)' }}>
            {secondsRemaining} soniya
          </Typography.Title>
        </div>

        <Progress
          percent={Math.round((secondsRemaining / WARNING_COUNTDOWN_SEC) * 100)}
          status={secondsRemaining <= 15 ? 'error' : 'warning'}
          showText={false}
        />
      </div>
    </Modal>
  );
};

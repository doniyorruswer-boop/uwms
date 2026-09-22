import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Typography,
  Progress,
  Tag,
  Button,
  Space,
  Alert,
  Spin,
  Message,
  Divider,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconClockCircle,
  IconMobile,
  IconSafe,
  IconRefresh,
  IconCopy,
  IconLink,
} from '@arco-design/web-react/icon';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants/api.constants';
import {
  InitSigningSessionPayload,
  SigningSessionInitResult,
  SigningSessionStatusResult,
} from '../../types';
import { formatRoleName } from '../../constants/roles.constants';
import { useSocket } from '../../hooks/useSocket';

const { Title, Text, Paragraph } = Typography;

export interface QRPairingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (result: SigningSessionStatusResult) => void;
  onOpenOfficialDoc?: (result: SigningSessionStatusResult) => void;
  payload: InitSigningSessionPayload;
  autoCloseOnSuccess?: boolean;
}

export const QRPairingModal: React.FC<QRPairingModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onOpenOfficialDoc,
  payload,
  autoCloseOnSuccess = true,
}) => {
  const { socket, joinRoom, leaveRoom } = useSocket();
  const [initLoading, setInitLoading] = useState<boolean>(false);
  const [session, setSession] = useState<SigningSessionInitResult | null>(null);
  const [status, setStatus] = useState<SigningSessionStatusResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  const timerIntervalRef = useRef<any>(null);
  const autoCloseTimeoutRef = useRef<any>(null);
  const currentRoomsRef = useRef<string[]>([]);

  const cleanupTimers = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    currentRoomsRef.current.forEach((room) => leaveRoom(room));
    currentRoomsRef.current = [];
  };

  const startSession = async () => {
    cleanupTimers();
    setInitLoading(true);
    setError(null);
    setStatus(null);
    setConnectedDevice(null);
    setSecondsLeft(60);

    try {
      const res = await apiClient.post(API_ENDPOINTS.SIGNING_SESSIONS.INIT, payload);
      const sessionData: SigningSessionInitResult = res.data;
      setSession(sessionData);
      setSecondsLeft(sessionData.remainingSeconds || 60);

      // Local 60s countdown timer
      timerIntervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            cleanupTimers();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Sessiyani boshlashda xatolik yuz berdi.');
    } finally {
      setInitLoading(false);
    }
  };

  // Dedicated Socket Room & Listener Subscription lifecycle
  useEffect(() => {
    if (!socket || !session?.sessionId) return;

    const sessionRoom = `session:${session.sessionId}`;
    const tokenRoom = session.sessionToken ? `session:${session.sessionToken}` : null;

    joinRoom(sessionRoom);
    currentRoomsRef.current.push(sessionRoom);
    if (tokenRoom) {
      joinRoom(tokenRoom);
      currentRoomsRef.current.push(tokenRoom);
    }

    // 1. Instant Handshake: Mobil telefon QR-kodni skanerlagan zahoti
    const handleDeviceConnected = (data: any) => {
      setStatus((prev) => ({
        sessionId: session.sessionId,
        status: 'SCANNED',
        remainingSeconds: session.remainingSeconds || 60,
        docNumber: session.docNumber,
        title: session.title,
        ...(prev || {}),
        ...data,
      }));
      if (data?.deviceInfo) {
        setConnectedDevice(data.deviceInfo);
      }
      Message.info('📱 Mobil telefon ulandi, biometrik tasdiq kutilmoqda...');
    };

    // 2. Instant Handshake: Mobil biometrika (TouchID / FaceID) tasdiqlanganda
    const handleSignatureCompleted = (data: any) => {
      cleanupTimers();
      const signedStatusResult: SigningSessionStatusResult = {
        sessionId: session.sessionId,
        status: 'SIGNED',
        remainingSeconds: session.remainingSeconds || 60,
        docNumber: session.docNumber,
        title: session.title,
        docType: session.docType,
        ...data,
      };

      setStatus(signedStatusResult);
      Message.success('Hujjat mobil biometrika orqali muvaffaqiyatli imzolandi!');

      if (onSuccess) {
        onSuccess(signedStatusResult);
      }
      if (onOpenOfficialDoc) {
        onOpenOfficialDoc(signedStatusResult);
      }

      // Ssenariy 5: Kompyuterda QR modal avtomatik yopilib rasmiy hujjatga yo‘naltirish
      if (autoCloseOnSuccess) {
        autoCloseTimeoutRef.current = setTimeout(() => {
          handleClose();
        }, 1200);
      }
    };

    // 3. Sessiya bekor qilinganda
    const handleSessionCancelled = () => {
      cleanupTimers();
      setStatus((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
    };

    socket.on('qr:device_connected', handleDeviceConnected);
    socket.on('qr:signature_completed', handleSignatureCompleted);
    socket.on('qr:session_cancelled', handleSessionCancelled);

    return () => {
      socket.off('qr:device_connected', handleDeviceConnected);
      socket.off('qr:signature_completed', handleSignatureCompleted);
      socket.off('qr:session_cancelled', handleSessionCancelled);
      if (tokenRoom) leaveRoom(tokenRoom);
      leaveRoom(sessionRoom);
    };
  }, [socket, session?.sessionId, session?.sessionToken]);

  useEffect(() => {
    if (visible) {
      startSession();
    } else {
      cleanupTimers();
      setSession(null);
      setStatus(null);
      setConnectedDevice(null);
    }
    return () => cleanupTimers();
  }, [visible, payload.docNumber]);

  const handleClose = () => {
    if (session?.sessionId && status?.status !== 'SIGNED') {
      apiClient.post(API_ENDPOINTS.SIGNING_SESSIONS.CANCEL(session.sessionId)).catch(() => {});
    }
    cleanupTimers();
    onClose();
  };

  const isSigned = status?.status === 'SIGNED';
  const isScanned = status?.status === 'SCANNED';
  const isExpired = secondsLeft === 0 || status?.status === 'EXPIRED';

  return (
    <Modal
      visible={visible}
      onCancel={handleClose}
      footer={null}
      title={null}
      style={{ width: 540, borderRadius: 0 }}
      maskClosable={isSigned || isExpired}
    >
      <div style={{ textAlign: 'center', padding: '12px 8px' }}>
        {/* Top Header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              margin: '0 auto 10px auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isSigned ? '#E8FFEA' : isExpired ? '#FFECE8' : isScanned ? '#E8F3FF' : '#F2F3F5',
              transition: 'background-color 0.3s ease',
            }}
          >
            {isSigned ? (
              <IconCheckCircle style={{ fontSize: 32, color: '#00B42A' }} />
            ) : isExpired ? (
              <IconCloseCircle style={{ fontSize: 32, color: '#F53F3F' }} />
            ) : isScanned ? (
              <IconMobile style={{ fontSize: 30, color: '#165DFF' }} />
            ) : (
              <IconMobile style={{ fontSize: 28, color: '#4E5969' }} />
            )}
          </div>

          <Title heading={4} style={{ margin: 0 }}>
            {isSigned
              ? 'Hujjat Muvaffaqiyatli Imzolandi!'
              : isExpired
              ? 'Imzolash Vaqti Tugadi (60s)'
              : isScanned
              ? '📱 Mobil Qurilma Ulandi'
              : 'Dinamik QR-Pairing Orqali Imzolash'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
            {isSigned
              ? 'Hujjatga doimiy raqamli QR-muhr bosildi, rasmiy dalolatnoma ochilmoqda...'
              : isExpired
              ? 'Xavfsizlik muddati tugadi. Qayta urinib ko‘ring'
              : isScanned
              ? 'Smartfonda biometrik tasdiqlash (TouchID / FaceID) kutilmoqda...'
              : 'Kompyuterda PIN kiritilmaydi. Shaxsiy telefoningiz kamerasi orqali tasdiqlang'}
          </Text>
        </div>

        {/* Loading Spinner */}
        {initLoading ? (
          <div style={{ padding: '40px 0' }}>
            <Spin dot />
            <div style={{ marginTop: 12 }}>
              <Text>60 soniyalik bir martalik xavfsiz sessiya yaratilmoqda...</Text>
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px 0' }}>
            <Alert type="error" title="Xatolik" content={error} />
            <Button
              type="primary"
              icon={<IconRefresh />}
              style={{ marginTop: 16, borderRadius: 0 }}
              onClick={startSession}
            >
              Qayta Urinish
            </Button>
          </div>
        ) : isSigned ? (
          /* SUCCESS SCREEN (Full Green State) */
          <div
            style={{
              backgroundColor: '#F6FFED',
              border: '1px solid #B7EB8F',
              padding: 24,
              borderRadius: 4,
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Tag color="green" size="large" icon={<IconCheckCircle />} style={{ fontWeight: 'bold' }}>
                IMZOLANDI VA MUHRLANDI
              </Tag>
              <Text bold style={{ color: '#52C41A' }}>
                {status?.biometricType || 'TOUCH_ID'} Biometrikasi
              </Text>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 8, fontSize: 13 }}>
              <Text bold>Hujjat Raqami:</Text>
              <Text bold style={{ fontFamily: 'monospace' }}>
                {status?.docNumber}
              </Text>

              <Text bold>Imzolagan Mas’ul:</Text>
              <Text>
                {status?.signerName} ({formatRoleName(status?.signerRole) || 'Mas’ul'})
              </Text>

              <Text bold>Tasdiqlangan Vaqt:</Text>
              <Text>
                {status?.signedAt ? new Date(status.signedAt).toLocaleString('uz-UZ') : 'Hozir'}
              </Text>

              <Text bold>SHA-256 Muhr Xeshi:</Text>
              <Text
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  wordBreak: 'break-all',
                  backgroundColor: '#fff',
                  padding: 4,
                  border: '1px solid #e8e8e8',
                }}
              >
                {status?.stamp?.verificationHash || 'Kriptografik Muhr'}
              </Text>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                type="text"
                size="small"
                icon={<IconLink />}
                onClick={() => window.open(`/verify-doc/${encodeURIComponent(status?.docNumber || '')}`, '_blank')}
              >
                Davlat Reyestridan Tekshirish
              </Button>
              <Button type="primary" style={{ borderRadius: 0 }} onClick={handleClose}>
                Yopish (Tayyor)
              </Button>
            </div>
          </div>
        ) : isExpired ? (
          /* EXPIRED SCREEN */
          <div style={{ padding: '20px 0' }}>
            <Alert
              type="warning"
              icon={<IconClockCircle />}
              title="Bir martalik QR-kod muddati (60s) tugadi"
              content="Xavfsizlik talablariga binoan har bir imzolash sessiyasi faqat 60 soniya yashaydi. Yangi kod olish uchun quyidagi tugmani bosing."
            />
            <Button
              type="primary"
              icon={<IconRefresh />}
              style={{ marginTop: 20, borderRadius: 0 }}
              onClick={startSession}
            >
              Yangi Dinamik QR-Kod Olish (60s)
            </Button>
          </div>
        ) : (
          /* ACTIVE QR-PAIRING SCREEN */
          <div>
            {/* Document preview summary */}
            <div
              style={{
                backgroundColor: 'var(--color-fill-2)',
                padding: '10px 14px',
                marginBottom: 16,
                textAlign: 'left',
                borderLeft: '4px solid #165DFF',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text bold style={{ fontSize: 13 }}>
                  {payload.title}
                </Text>
                <Tag color="blue">{payload.docType}</Tag>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>
                <b>Ashyolar:</b> {payload.itemSummary}
              </div>
              {payload.roomName && (
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                  Joylashuv: {payload.departmentName || ''} {payload.roomName}
                </div>
              )}
            </div>

            {/* Dynamic QR Box with Instant Handshake State */}
            <div
              style={{
                display: 'inline-block',
                padding: 16,
                backgroundColor: '#fff',
                border: isScanned ? '2px solid #165DFF' : '2px solid var(--color-border-2)',
                boxShadow: isScanned ? '0 6px 20px rgba(22,93,255,0.22)' : '0 4px 14px rgba(0,0,0,0.06)',
                position: 'relative',
                transition: 'all 0.3s ease',
              }}
            >
              {session?.qrUrl && (
                <QRCodeSVG
                  value={
                    typeof window !== 'undefined' &&
                    window.location.hostname !== 'localhost' &&
                    window.location.hostname !== '127.0.0.1'
                      ? session.qrUrl.replace(/^https?:\/\/localhost(:\d+)?/, window.location.origin)
                      : session.qrUrl
                  }
                  size={210}
                  level="H"
                  includeMargin={false}
                />
              )}

              {isScanned && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(22, 93, 255, 0.95)',
                    color: '#ffffff',
                    padding: '5px 12px',
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Spin dot size={10} />
                  <span>📱 Qurilma bog‘landi</span>
                </div>
              )}
            </div>

            {/* Timer & Status feedback */}
            <div style={{ marginTop: 16, maxWidth: 360, margin: '16px auto 0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12 }}>
                  {isScanned ? (
                    <span style={{ color: '#165DFF', fontWeight: 600 }}>
                      📱 {connectedDevice ? `Telefon: ${connectedDevice.substring(0, 24)}...` : 'Telefon ulandi, biometrika kutilmoqda...'}
                    </span>
                  ) : (
                    'Kamerangizni QR-kodga qarating:'
                  )}
                </Text>
                <Text bold style={{ color: secondsLeft <= 10 ? '#F53F3F' : '#165DFF' }}>
                  ⏳ {secondsLeft}s
                </Text>
              </div>

              <Progress
                percent={Math.round((secondsLeft / 60) * 100)}
                status={secondsLeft <= 10 ? 'error' : isScanned ? 'normal' : 'normal'}
                showText={false}
                style={{ width: '100%' }}
              />
            </div>

            {isScanned ? (
              <div style={{ marginTop: 16 }}>
                <Alert
                  type="info"
                  title="Mobil qurilma bilan jonli aloqa o‘rnatildi (0s kechikish)"
                  content="Telefoningiz ekrani ochildi. TouchID yoki FaceID tasdiqlangach, ushbu oyna avtomatik yopilib muhrlangan rasmiy hujjat ochiladi."
                />
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  🔒 Havola bir martalik xavfsiz token bilan himoyalangan. 60 soniyadan so‘ng avtomatik bekor bo‘ladi.
                </Text>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
export default QRPairingModal;

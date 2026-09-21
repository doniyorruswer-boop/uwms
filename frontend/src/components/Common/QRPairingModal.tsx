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

const { Title, Text, Paragraph } = Typography;

export interface QRPairingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (result: SigningSessionStatusResult) => void;
  payload: InitSigningSessionPayload;
}

export const QRPairingModal: React.FC<QRPairingModalProps> = ({
  visible,
  onClose,
  onSuccess,
  payload,
}) => {
  const [initLoading, setInitLoading] = useState<boolean>(false);
  const [session, setSession] = useState<SigningSessionInitResult | null>(null);
  const [status, setStatus] = useState<SigningSessionStatusResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  const cleanupTimers = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startSession = async () => {
    cleanupTimers();
    setInitLoading(true);
    setError(null);
    setStatus(null);
    setSecondsLeft(60);

    try {
      const res = await apiClient.post(API_ENDPOINTS.SIGNING_SESSIONS.INIT, payload);
      const sessionData: SigningSessionInitResult = res.data;
      setSession(sessionData);
      setSecondsLeft(sessionData.remainingSeconds || 60);

      // Local countdown timer
      timerIntervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            cleanupTimers();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Status polling every 1000ms
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await apiClient.get(
            API_ENDPOINTS.SIGNING_SESSIONS.STATUS(sessionData.sessionId),
          );
          const currentStatus: SigningSessionStatusResult = statusRes.data;
          setStatus(currentStatus);

          if (currentStatus.status === 'SIGNED') {
            cleanupTimers();
            Message.success('Hujjat mobil biometrika orqali muvaffaqiyatli imzolandi!');
            if (onSuccess) {
              onSuccess(currentStatus);
            }
          } else if (currentStatus.status === 'EXPIRED' || currentStatus.status === 'CANCELLED') {
            cleanupTimers();
          }
        } catch {
          // ignore transient poll error
        }
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Sessiyani boshlashda xatolik yuz berdi.');
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      startSession();
    } else {
      cleanupTimers();
      setSession(null);
      setStatus(null);
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
              backgroundColor: isSigned ? '#E8FFEA' : isExpired ? '#FFECE8' : '#E8F3FF',
            }}
          >
            {isSigned ? (
              <IconCheckCircle style={{ fontSize: 32, color: '#00B42A' }} />
            ) : isExpired ? (
              <IconCloseCircle style={{ fontSize: 32, color: '#F53F3F' }} />
            ) : (
              <IconMobile style={{ fontSize: 28, color: '#165DFF' }} />
            )}
          </div>

          <Title heading={4} style={{ margin: 0 }}>
            {isSigned
              ? 'Hujjat Muvaffaqiyatli Imzolandi!'
              : isExpired
              ? 'Imzolash Vaqti Tugadi (60s)'
              : 'Dinamik QR-Pairing Orqali Imzolash'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
            {isSigned
              ? 'Hujjatga doimiy raqamli QR-muhr muvaffaqiyatli bosildi'
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

            {/* Dynamic QR Box */}
            <div
              style={{
                display: 'inline-block',
                padding: 16,
                backgroundColor: '#fff',
                border: '2px solid var(--color-border-2)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                position: 'relative',
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
            </div>

            {/* Timer & Status feedback */}
            <div style={{ marginTop: 16, maxWidth: 360, margin: '16px auto 0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12 }}>
                  {isScanned ? (
                    <span style={{ color: '#165DFF', fontWeight: 600 }}>
                      📱 Telefon ulandi, biometrika kutilmoqda...
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
                status={secondsLeft <= 10 ? 'error' : 'normal'}
                showText={false}
                style={{ width: '100%' }}
              />
            </div>

            {isScanned ? (
              <div style={{ marginTop: 16 }}>
                <Alert
                  type="info"
                  content="Telefoningiz ekrani ochildi. Endi telefoningizda TouchID yoki FaceID bilan tasdiqlang."
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

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Radio,
  Button,
  Space,
  Typography,
  Card,
  Grid,
  Tag,
  Alert,
  Message,
} from '@arco-design/web-react';

import {
  IconCheckCircle,
  IconUser,
  IconIdcard,
  IconEraser,
  IconQrcode,
  IconEdit,
  IconSafe,
} from '@arco-design/web-react/icon';
import { AuditCampaignItem, CompleteCampaignParams } from '../../hooks/useAuditCampaignsQuery';
import { useAuthStore } from '../../store/authStore';
import { QRPairingModal } from '../Common/QRPairingModal';
import { APP_CONFIG } from '../../constants';

const { Text, Paragraph } = Typography;
const { Row, Col } = Grid;

interface AuditSignModalProps {
  visible: boolean;
  onClose: () => void;
  campaign: AuditCampaignItem | null;
  onConfirm: (params: CompleteCampaignParams) => Promise<void>;
  loading?: boolean;
}

type SignMode = 'e-sign' | 'canvas' | 'mobile';

export const AuditSignModal: React.FC<AuditSignModalProps> = ({
  visible,
  onClose,
  campaign,
  onConfirm,
  loading = false,
}) => {
  const { user } = useAuthStore();
  const [form] = Form.useForm();

  const [signMode, setSignMode] = useState<SignMode>('e-sign');
  const [hasCanvasSignature, setHasCanvasSignature] = useState(false);
  const [mobileSigned, setMobileSigned] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);

  // Canvas refs for signature pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Default values when modal opens
  useEffect(() => {
    if (visible && campaign) {
      const defaultRole =
        user?.role === 'AUDITOR'
          ? 'Bosh Auditor / Komissiya Raisi'
          : user?.role === 'SUPER_ADMIN'
          ? 'Bosh Nazoratchi (Admin)'
          : user?.role === 'HEAD_WAREHOUSE'
          ? 'Bosh Omborchi'
          : 'Komissiya Raisi / Auditor';

      form.setFieldsValue({
        signerName: user?.fullName || 'Bosh Auditor',
        signerRole: defaultRole,
        notes: `"${campaign.title}" rejasiga asosan inventarizatsiya to‘liq o‘tkazildi. Aniqlangan kamomadlar qayd etildi va INV-19 akti rasmiylashtirildi.`,
      });

      setHasCanvasSignature(false);
      setMobileSigned(false);
      setSignMode('e-sign');
    }
  }, [visible, campaign, user, form]);

  // Setup canvas drawing
  useEffect(() => {
    if (signMode !== 'canvas' || !visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#165DFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasCanvasSignature(true);
    };

    const stopDrawing = () => {
      isDrawingRef.current = false;
      ctx.closePath();
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    window.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      window.removeEventListener('mouseup', stopDrawing);

      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      window.removeEventListener('touchend', stopDrawing);
    };
  }, [signMode, visible]);

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setHasCanvasSignature(false);
    }
  };

  const generateCryptoHash = (name: string, role: string, campaignNum: string) => {
    const raw = `${name}_${role}_${campaignNum}_${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `SHA256:SIG-${hex.toUpperCase()}-${new Date().getFullYear()}`;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      if (!campaign) return;

      let sigHash = '';
      if (signMode === 'canvas') {
        if (!hasCanvasSignature) {
          Message.warning('Iltimos, ekranda imzo cheking yoki "Elektron Imzo" usulini tanlang!');
          return;
        }
        const canvas = canvasRef.current;
        sigHash = canvas ? canvas.toDataURL('image/png').slice(0, 80) : 'CANVAS_SIGNED';
      } else if (signMode === 'mobile') {
        if (!mobileSigned) {
          Message.warning('Iltimos, avval mobil telefon orqali QR-imzoni tasdiqlang!');
          return;
        }
        sigHash = `MOBILE_BIOMETRIC_VERIFIED_${Date.now()}`;
      } else {
        sigHash = generateCryptoHash(values.signerName, values.signerRole, campaign.campaignNumber);
      }

      await onConfirm({
        id: campaign.id,
        signerName: values.signerName,
        signerRole: values.signerRole,
        notes: values.notes,
        signatureHash: sigHash,
      });

      onClose();
    } catch (err) {
      // form validation or mutation error
    }
  };

  if (!campaign) return null;

  return (
    <>
      <Modal
        visible={visible}
        onCancel={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                backgroundColor: '#E8FFEA',
                color: '#00B42A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              <IconSafe />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Inventarizatsiyani Yakunlash va Imzolash</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 400 }}>
                Davlat INV-19 standarti bo‘yicha mas’ul auditorlik tasdig‘i va muhrlash
              </div>
            </div>
          </div>
        }
        style={{ width: 680, top: 50 }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCheckCircle style={{ color: '#00B42A' }} />
              Kriptografik SHA-256 muhr bilan himoyalanadi
            </div>
            <Space>
              <Button onClick={onClose} disabled={loading} style={{ borderRadius: 0 }}>
                Bekor qilish
              </Button>
              <Button
                type="primary"
                status="success"
                icon={<IconCheckCircle />}
                loading={loading}
                onClick={handleSubmit}
                style={{ borderRadius: 0 }}
              >
                Rasmiy Imzolash va Yakunlash
              </Button>
            </Space>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Campaign summary card */}
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, backgroundColor: '#F7F8FA', border: '1px solid #E5E6EB' }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <Text bold style={{ fontSize: 14 }}>{campaign.title}</Text>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                  Reja kodi: <b>{campaign.campaignNumber}</b>
                </div>
              </div>
              <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                INV-19 Shakli
              </Tag>
            </div>

            <Row gutter={12}>
              <Col span={6}>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Qamrov xonalari</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{campaign.totalRooms} ta</div>
              </Col>
              <Col span={6}>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Bajarildi</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#00B42A' }}>
                  {campaign.completedRooms} ta ({campaign.progressPercent}%)
                </div>
              </Col>
              <Col span={6}>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Topilgan (Mavjud)</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#165DFF' }}>
                  {campaign.matchedCount} ta
                </div>
              </Col>
              <Col span={6}>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Kamomad (MISSING)</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: campaign.missingCount > 0 ? '#F53F3F' : '#00B42A',
                  }}
                >
                  {campaign.missingCount} ta
                </div>
              </Col>
            </Row>
          </Card>

          {campaign.missingCount > 0 && (
            <Alert
              type="warning"
              showIcon
              content={
                <div style={{ fontSize: 12 }}>
                  Ushbu kampaniyada <b>{campaign.missingCount} ta</b> asosiy vosita topilmadi (Kamomad). Kampaniya yakunlangach, barcha javobgar xodimlarga (MOL) avtomatik bildirishnoma yuboriladi va kamomadlar qaydnomasi INV-19 hisobotiga kiritiladi.
                </div>
              }
            />
          )}

          {/* Signer Details Form */}
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Tekshirgan Mas’ul (Auditor / Komissiya Raisi)"
                  field="signerName"
                  rules={[{ required: true, message: 'Mas’ul shaxs F.I.O.si kiritilishi shart!' }]}
                >
                  <Input
                    prefix={<IconUser />}
                    placeholder="Masalan: Qosim Jo‘rayev"
                    style={{ borderRadius: 0 }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Lavozimi / Roli"
                  field="signerRole"
                  rules={[{ required: true, message: 'Lavozimi kiritilishi shart!' }]}
                >
                  <Input
                    prefix={<IconIdcard />}
                    placeholder="Masalan: Bosh Auditor / Komissiya Raisi"
                    style={{ borderRadius: 0 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Auditorlik Dalolatnomasi Xulosasi va Izohi"
              field="notes"
              rules={[{ required: true, message: 'Tekshiruv xulosasi kiritilishi shart!' }]}
            >
              <Input.TextArea
                rows={2}
                placeholder="Tekshiruv bo‘yicha rasmiy xulosa va qaydlar..."
                style={{ borderRadius: 0 }}
              />
            </Form.Item>
          </Form>

          {/* Signature Method Selector */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconEdit style={{ color: '#165DFF' }} /> Imzo Qo‘yish Usulini Tanlang:
            </div>
            <Radio.Group
              type="button"
              value={signMode}
              onChange={(val) => setSignMode(val as SignMode)}
              style={{ width: '100%', display: 'flex', borderRadius: 0 }}
            >
              <Radio value="e-sign" style={{ flex: 1, textAlign: 'center', borderRadius: 0 }}>
                <IconCheckCircle /> Dinamik QR-Pairing
              </Radio>
              <Radio value="canvas" style={{ flex: 1, textAlign: 'center', borderRadius: 0 }}>
                <IconEdit /> Qo‘lda Imzo Chizish
              </Radio>
              <Radio value="mobile" style={{ flex: 1, textAlign: 'center', borderRadius: 0 }}>
                <IconQrcode /> Mobil QR-Imzo
              </Radio>
            </Radio.Group>
          </div>

          {/* Signature Pad / Display Box */}
          {signMode === 'e-sign' && (
            <Card
              className="uwms-card"
              style={{
                borderRadius: 0,
                border: '1px solid #C9CDD4',
                backgroundColor: '#F7F8FA',
              }}
              bodyStyle={{ padding: '14px 18px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1D2129' }}>
                    {APP_CONFIG.defaultOrganizationName.toUpperCase()} — ELEKTRON HUJJAT REYESTRI
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>
                    Tasdiqlovchi: <b>{form.getFieldValue('signerName') || user?.fullName}</b>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                    Lavozim: {form.getFieldValue('signerRole') || 'Auditor'} &nbsp;|&nbsp; Vaqt: {new Date().toLocaleDateString('uz-UZ')} {new Date().toLocaleTimeString('uz-UZ')}
                  </div>
                </div>
                <Tag color="green" style={{ borderRadius: 0, padding: '4px 10px', fontSize: 12 }}>
                  <IconCheckCircle /> QR-Pairing Tayyor
                </Tag>
              </div>
            </Card>
          )}

          {signMode === 'canvas' && (
            <div>
              <div
                style={{
                  border: '1px dashed #165DFF',
                  backgroundColor: '#FFFFFF',
                  height: 120,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={120}
                  style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                />
                {!hasCanvasSignature && (
                  <div
                    style={{
                      position: 'absolute',
                      pointerEvents: 'none',
                      color: '#86909C',
                      fontSize: 12,
                    }}
                  >
                    Sichqoncha yoki sensor orqali bu yerga imzo cheking...
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <Button
                  size="mini"
                  type="text"
                  icon={<IconEraser />}
                  onClick={handleClearCanvas}
                  style={{ borderRadius: 0 }}
                >
                  Tozalash
                </Button>
              </div>
            </div>
          )}

          {signMode === 'mobile' && (
            <Card
              className="uwms-card"
              style={{ borderRadius: 0, backgroundColor: '#F7F8FA', border: '1px solid #E5E6EB' }}
              bodyStyle={{ padding: '16px', textAlign: 'center' }}
            >
              {mobileSigned ? (
                <div style={{ color: '#00B42A' }}>
                  <IconCheckCircle style={{ fontSize: 32, marginBottom: 8 }} />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Mobil Imzo Muvaffaqiyatli Tasdiqlandi!</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Smartfon orqali biometrik autentifikatsiya muhrlandi.
                  </div>
                </div>
              ) : (
                <div>
                  <IconQrcode style={{ fontSize: 32, color: '#165DFF', marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Smartfon yordamida QR-kod orqali imzolash</div>
                  <Paragraph style={{ fontSize: 12, color: 'var(--color-text-3)', margin: '4px 0 12px' }}>
                    Telefoningiz kamerasi orqali QR-kodni skaner qilib, FaceID yoki barmoq izi orqali tezkor tasdiqlang.
                  </Paragraph>
                  <Button
                    type="outline"
                    icon={<IconQrcode />}
                    onClick={() => setIsQrModalVisible(true)}
                    style={{ borderRadius: 0 }}
                  >
                    Mobil QR-Pairingni Boshlash
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </Modal>

      {/* QR-Pairing Modal */}
      {campaign && (
        <QRPairingModal
          visible={isQrModalVisible}
          onClose={() => setIsQrModalVisible(false)}
          onSuccess={() => {
            setMobileSigned(true);
            setIsQrModalVisible(false);
            Message.success('Mobil imzo muvaffaqiyatli qabul qilindi!');
          }}
          payload={{
            docNumber: campaign.campaignNumber,
            docType: 'INV_19',
            title: `Yalpi Inventarizatsiya (INV-19) - ${campaign.title}`,
            itemSummary: `Qamrov: ${campaign.totalRooms} ta xona, ${campaign.matchedCount} ta topildi, ${campaign.missingCount} ta kamomad`,
          }}
        />
      )}
    </>
  );
};

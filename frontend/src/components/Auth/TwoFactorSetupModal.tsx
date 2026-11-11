import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Space,
  Typography,
  Alert,
  Spin,
  Tag,
  Divider,
  Message,
  Popconfirm,
  Form,
  Grid,
} from '@arco-design/web-react';
import {
  IconSafe,
  IconLock,
  IconCopy,
  IconCheckCircle,
  IconExclamationCircle,
  IconRefresh,
  IconDownload,
} from '@arco-design/web-react/icon';
import { QRCodeSVG } from 'qrcode.react';
import {
  useTwoFactorStatusQuery,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
  useDisableTwoFactorMutation,
} from '../../hooks/useTwoFactorQuery';

const { Text, Title, Paragraph } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;

interface TwoFactorSetupModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  visible,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [disableForm] = Form.useForm();
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUri: string;
    recoveryCodes: string[];
  } | null>(null);
  const [confirmedRecoveryCodes, setConfirmedRecoveryCodes] = useState<string[] | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);

  const { data: statusData, isLoading: isStatusLoading, refetch: refetchStatus } = useTwoFactorStatusQuery();
  const setupMutation = useSetupTwoFactorMutation();
  const enableMutation = useEnableTwoFactorMutation();
  const disableMutation = useDisableTwoFactorMutation();

  const isEnabled = !!statusData?.enabled;

  useEffect(() => {
    if (visible) {
      refetchStatus();
      setConfirmedRecoveryCodes(null);
      setIsDisabling(false);
      form.resetFields();
      disableForm.resetFields();

      if (!statusData?.enabled) {
        setupMutation.mutateAsync().then((res) => {
          setSetupData(res);
        }).catch(() => {});
      }
    } else {
      setSetupData(null);
      setConfirmedRecoveryCodes(null);
    }
  }, [visible]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    Message.success(`${label} nusxalandi!`);
  };

  const handleDownloadRecoveryCodes = (codes: string[]) => {
    const element = document.createElement('a');
    const file = new Blob([codes.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'uwms-2fa-recovery-codes.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    Message.success('Zaxira kodlari yuklab olindi!');
  };

  const handleVerifyAndEnable = async () => {
    if (!setupData?.secret) return;
    try {
      const values = await form.validate();
      const res = await enableMutation.mutateAsync({
        secret: setupData.secret,
        code: values.verificationCode.trim(),
      });
      setConfirmedRecoveryCodes(res.recoveryCodes || setupData.recoveryCodes);
      refetchStatus();
    } catch {
      // Form validation or mutation error handled
    }
  };

  const handleConfirmDisable = async () => {
    try {
      const values = await disableForm.validate();
      await disableMutation.mutateAsync({
        password: values.password,
        code: values.totpCode,
      });
      setIsDisabling(false);
      disableForm.resetFields();
      refetchStatus();
      // Restart setup flow for user convenience
      const newSetup = await setupMutation.mutateAsync();
      setSetupData(newSetup);
    } catch {
      // error handled
    }
  };

  return (
    <Modal
      title={
        <Space>
          <IconSafe style={{ color: '#165DFF', fontSize: 20 }} />
          <span style={{ fontWeight: 600 }}>Google Authenticator (2FA) Xavfsizlik Sozlamalari</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Yopish
          </Button>
          {!isEnabled && !confirmedRecoveryCodes && (
            <Button
              type="primary"
              style={{ borderRadius: 0 }}
              loading={enableMutation.isPending}
              onClick={handleVerifyAndEnable}
            >
              Tasdiqlash va Faollashtirish
            </Button>
          )}
        </div>
      }
      style={{ width: 620, maxWidth: '95vw', borderRadius: 0 }}
      unmountOnExit
    >
      {isStatusLoading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Spin dot />
          <div style={{ marginTop: 12, color: 'var(--color-text-3)' }}>Yuklanmoqda...</div>
        </div>
      ) : isEnabled && !isDisabling ? (
        /* ALREADY ENABLED STATE */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="success"
            showIcon
            title="Google Authenticator (2FA) Faol"
            content="Sizning hisobingiz ikki bosqichli autentifikatsiya (TOTP RFC 6238) orqali to‘liq himoyalangan. Rektorat va moliya vizalari qo‘yishda yoki muhim moliyaviy tasdiqlashlarda shaxsiy mobil ilovangizdagi 6 xonali kod talab etiladi."
            style={{ borderRadius: 0 }}
          />

          <div
            style={{
              padding: 16,
              backgroundColor: 'var(--color-fill-2)',
              border: '1px solid var(--color-border-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text bold>Zaxira kodlari (Recovery codes):</Text>
              <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                {statusData?.recoveryCodesCount ?? 0} ta kod mavjud
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Agar telefoningizga ulanish imkoni bo‘lmasa (akkumulyator tugaganda yoki qurilma yangilanganda), ushbu zaxira kodlaridan biri orqali viza qo‘yishingiz mumkin.
            </Text>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text bold style={{ color: 'var(--color-text-1)' }}>
                2FA Himoyasini o‘chirish
              </Text>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                Google Authenticator himoyasini hisobingizdan o‘chirish
              </div>
            </div>
            <Button
              status="danger"
              style={{ borderRadius: 0 }}
              onClick={() => setIsDisabling(true)}
            >
              O‘chirish
            </Button>
          </div>
        </div>
      ) : isDisabling ? (
        /* DISABLE CONFIRMATION FORM */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="warning"
            showIcon
            title="Ikki Bosqichli Himoyani O‘chirish"
            content="2FA ni o‘chirsangiz, hisobingiz faqat parol orqali himoyalanadi va ruxsatsiz shaxslar kompyuteringiz orqali viza qo‘yishi xavfi oshadi."
            style={{ borderRadius: 0 }}
          />

          <Form form={disableForm} layout="vertical">
            <FormItem
              label="Joriy Parolingiz"
              field="password"
              rules={[{ required: true, message: 'Parolingizni kiriting' }]}
            >
              <Input.Password placeholder="Parolni kiriting" style={{ borderRadius: 0 }} />
            </FormItem>

            <FormItem
              label="Google Authenticator ilovasidagi 6 xonali kod (yoki Zaxira kodi)"
              field="totpCode"
              rules={[
                { required: true, message: 'Tasdiqlash kodini kiriting' },
                { minLength: 6, message: 'Kamida 6 ta belgi bo‘lishi kerak' },
              ]}
            >
              <Input
                placeholder="Masalan: 482910"
                maxLength={9}
                style={{ borderRadius: 0, letterSpacing: 4, fontWeight: 700 }}
              />
            </FormItem>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button onClick={() => setIsDisabling(false)} style={{ borderRadius: 0 }}>
                Bekor qilish
              </Button>
              <Button
                status="danger"
                type="primary"
                loading={disableMutation.isPending}
                style={{ borderRadius: 0 }}
                onClick={handleConfirmDisable}
              >
                2FA Himoyasini O‘chirish
              </Button>
            </div>
          </Form>
        </div>
      ) : confirmedRecoveryCodes ? (
        /* SUCCESS & RECOVERY CODES VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="success"
            showIcon
            title="Google Authenticator Muvaffaqiyatli Faollashtirildi!"
            content="Endi barcha muhim rahbarlik vizalari faqat sizning telefoningizdagi Google Authenticator ilovasi kodi bilan tasdiqlanadi."
            style={{ borderRadius: 0 }}
          />

          <div
            style={{
              padding: 16,
              backgroundColor: 'var(--color-fill-2)',
              border: '1px solid var(--color-border-2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text bold>Bir Martalik Zaxira Kodlari (Recovery Codes):</Text>
              <Space>
                <Button
                  size="mini"
                  icon={<IconCopy />}
                  style={{ borderRadius: 0 }}
                  onClick={() => handleCopy(confirmedRecoveryCodes.join('\n'), 'Zaxira kodlari')}
                >
                  Nusxalash
                </Button>
                <Button
                  size="mini"
                  icon={<IconDownload />}
                  style={{ borderRadius: 0 }}
                  onClick={() => handleDownloadRecoveryCodes(confirmedRecoveryCodes)}
                >
                  Yuklab olish
                </Button>
              </Space>
            </div>

            <Row gutter={[12, 8]}>
              {confirmedRecoveryCodes.map((code, idx) => (
                <Col span={12} key={idx}>
                  <div
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-bg-2)',
                      border: '1px dashed var(--color-border-3)',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: 14,
                      textAlign: 'center',
                      letterSpacing: 2,
                    }}
                  >
                    {code}
                  </div>
                </Col>
              ))}
            </Row>

            <Paragraph
              type="secondary"
              style={{ fontSize: 12, marginTop: 12, marginBottom: 0, lineHeight: 1.4 }}
            >
              ⚠️ Ushbu kodlarni xavfsiz joyga saqlab qo‘ying. Agar telefoningizni yo‘qotsangiz yoki ilova o‘chib ketsa, ushbu kodlar orqali tizimda viza qo‘yishingiz mumkin bo‘ladi.
            </Paragraph>
          </div>
        </div>
      ) : (
        /* SETUP / ENROLLMENT VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            showIcon
            title="Ikki Bosqichli Himoya (Google Authenticator)"
            content="Universitetda viza qo‘yish jarayonlarida kompyuteringiz orqali boshqa odamlar tasdiqlab yuborishining oldini olish uchun Google Authenticator yoki Microsoft Authenticator ilovasini shaxsiy telefoningizga o‘rnating."
            style={{ borderRadius: 0 }}
          />

          {setupMutation.isPending ? (
            <div style={{ padding: '30px 0', textAlign: 'center' }}>
              <Spin dot />
              <div style={{ marginTop: 8, color: 'var(--color-text-3)' }}>QR-kod tayyorlanmoqda...</div>
            </div>
          ) : setupData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: 16,
                  backgroundColor: 'var(--color-fill-2)',
                  border: '1px solid var(--color-border-2)',
                  flexWrap: 'wrap',
                }}
              >
                {/* QR Code Container */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <QRCodeSVG value={setupData.qrCodeUri || (setupData as any).otpAuthUri || ''} size={150} level="M" />
                </div>

                {/* Instructions */}
                <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Text bold style={{ fontSize: 14 }}>
                    1-qadam: Ilovada skanerlang
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                    Telefoningizdagi <b>Google Authenticator</b> ilovasini oching, «+» tugmasini bosing va ushbu QR-kodni skanerlang.
                  </Text>

                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Agar QR-kodni skanerlash imkoni bo‘lmasa, quyidagi maxfiy kalitni qo‘lda kiriting:
                    </Text>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 4,
                        padding: '4px 8px',
                        backgroundColor: 'var(--color-bg-2)',
                        border: '1px solid var(--color-border-3)',
                      }}
                    >
                      <code
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          letterSpacing: 2,
                          color: '#165DFF',
                        }}
                      >
                        {setupData.secret}
                      </code>
                      <Button
                        size="mini"
                        type="text"
                        icon={<IconCopy />}
                        onClick={() => handleCopy(setupData.secret, 'Maxfiy kalit')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2nd step: verification code */}
              <Form form={form} layout="vertical">
                <FormItem
                  label="2-qadam: Google Authenticator ilovasidagi 6 xonali tekshiruv kodini kiriting"
                  field="verificationCode"
                  rules={[
                    { required: true, message: '6 xonali tasdiqlash kodini kiriting!' },
                    { match: /^\d{6}$/, message: 'Kod faqat 6 ta raqamdan iborat bo‘lishi kerak!' },
                  ]}
                >
                  <Input
                    placeholder="Masalan: 384910"
                    maxLength={6}
                    prefix={<IconLock />}
                    style={{
                      letterSpacing: 6,
                      fontSize: 18,
                      fontWeight: 700,
                      borderRadius: 0,
                      textAlign: 'center',
                      height: 44,
                    }}
                  />
                </FormItem>
              </Form>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Button
                type="primary"
                icon={<IconRefresh />}
                style={{ borderRadius: 0 }}
                onClick={() => setupMutation.mutateAsync().then(setSetupData)}
              >
                Ulash Kodini Qayta Yaratish
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

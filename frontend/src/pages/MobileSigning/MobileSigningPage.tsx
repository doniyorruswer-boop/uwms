import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Tag,
  Button,
  Space,
  Alert,
  Spin,
  Input,
  Form,
  Modal,
  Message,
  Table,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconClockCircle,
  IconSafe,
  IconMobile,
  IconThunderbolt,
  IconLock,
  IconUser,
} from '@arco-design/web-react/icon';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants/api.constants';
import { MobileSigningDetailsResult } from '../../types';
import { useAuthStore } from '../../store/authStore';

const { Title, Text, Paragraph } = Typography;

export const MobileSigningPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user: currentUser, login } = useAuthStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<MobileSigningDetailsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [signerName, setSignerName] = useState<string>('');
  const [signerRole, setSignerRole] = useState<string>('');
  const [biometricType, setBiometricType] = useState<string>('WEBAUTHN_BIOMETRICS');

  const [signingInProgress, setSigningInProgress] = useState<boolean>(false);
  const [signedResult, setSignedResult] = useState<any | null>(null);

  const [loginForm] = Form.useForm();
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  const handleMobileLogin = async () => {
    try {
      const values = await loginForm.validate();
      setLoginLoading(true);
      const res = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        username: values.username,
        password: values.password,
      });
      const { access_token, refresh_token, user } = res.data;
      login(access_token, user, refresh_token);
      Message.success(`Xush kelibsiz, ${user.fullName}!`);
      setSignerName(user.fullName);
      setSignerRole(user.position || user.role);
    } catch (err: any) {
      if (err?.response?.data?.message) {
        Message.error(err.response.data.message);
      } else {
        Message.error('Login yoki parol noto‘g‘ri kiritildi!');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      if (!signerName) {
        setSignerName(currentUser.fullName);
      }
      if (!signerRole) {
        setSignerRole(currentUser.position || currentUser.role);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!token) return;

    const fetchSession = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(API_ENDPOINTS.SIGNING_SESSIONS.PUBLIC_GET(token));
        setSession(res.data);
        if (res.data?.expectedSignerName) {
          setSignerName(res.data.expectedSignerName);
        }
        if (res.data?.expectedSignerRole) {
          setSignerRole(res.data.expectedSignerRole);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Ushbu imzolash sessiyasi topilmadi yoki bekor qilingan.');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [token]);

  // Helper to obtain GPS coordinates - strictly required for legal audit and security
  const getCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          },
          (err) => {
            if (err.code === 1) {
              // PERMISSION_DENIED
              reject(
                new Error(
                  "Geolokatsiyaga ruxsat berilmadi (Don't allow tanlandi). Xavfsizlik va yuridik audit talabi bo‘yicha hujjatni imzolash uchun GPS geolokatsiyaga ruxsat berishingiz shart!",
                ),
              );
            } else if (err.code === 2) {
              // POSITION_UNAVAILABLE
              reject(
                new Error(
                  'Qurilmada GPS signali topilmadi yoki geolokatsiya o‘chirilgan. Telefoningizda Joylashuv (Location) xizmatini yoqing.',
                ),
              );
            } else if (err.code === 3) {
              // TIMEOUT
              reject(
                new Error(
                  'Geolokatsiyani aniqlash vaqti tugadi (Timeout). Iltimos, qayta urinib ko‘ring.',
                ),
              );
            } else {
              reject(
                new Error(
                  'Geolokatsiyani aniqlab bo‘lmadi. Hujjatni imzolash uchun GPS ruxsati zarur.',
                ),
              );
            }
          },
          { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
        );
      } else {
        reject(new Error('Ushbu qurilma yoki brauzerda geolokatsiya xizmati mavjud emas!'));
      }
    });
  };

  const handleBiometricConfirm = async () => {
    if (!signerName.trim() || !signerRole.trim()) {
      Message.error('Iltimos, ism-familiyangiz va lavozimingizni tasdiqlang!');
      return;
    }

    setSigningInProgress(true);

    // Mobile haptic tebranish
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([40, 80, 40]); } catch { /* ignore */ }
    }

    // 1. Geolokatsiyani qat’iy tekshirish va olish (MAJBURIY!)
    let location: { latitude: number; longitude: number; accuracy: number };
    try {
      location = await getCoordinates();
      if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new Error('Geolokatsiya koordinatalari olinmadi.');
      }
    } catch (locErr: any) {
      Message.error(
        locErr.message || 'Geolokatsiyaga ruxsat berilmadi! Hujjatni imzolash uchun GPS geolokatsiyaga ruxsat berish shart.',
      );
      setSigningInProgress(false);
      return; // STOP: Geolokatsiyasiz imzo qo'yib bo'lmaydi
    }

    // 2. Biometrik (TouchID / FaceID) tekshiruvi (MAJBURIY!)
    const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator?.userAgent || '');
    const isAndroid = /Android/.test(navigator?.userAgent || '');
    let detectedBiometric = isApple ? 'WEBAUTHN_FACE_ID' : isAndroid ? 'ANDROID_TOUCH_ID' : 'WEBAUTHN_TOUCH_ID';
    setBiometricType(detectedBiometric);

    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
      Message.error('Ushbu qurilmada yoki brauzerda biometrik imzo (TouchID/FaceID) texnologiyasi mavjud emas!');
      setSigningInProgress(false);
      return;
    }

    let credentialId: string | undefined = undefined;

    try {
      const isIpOrLocal =
        !window.location.hostname ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);

      const challengeBuffer = new Uint8Array(32);
      window.crypto.getRandomValues(challengeBuffer);

      const rp: any = { name: 'UWMS Elektron Imzo' };
      // W3C WebAuthn: RP ID IP manzil yoki localhost bo'lmasligi kerak
      if (!isIpOrLocal) {
        rp.id = window.location.hostname;
      }

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp,
          user: {
            id: new TextEncoder().encode(signerName.trim() + '_' + Date.now()),
            name: signerName.trim(),
            displayName: signerName.trim(),
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
            { alg: -8, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required', // MAJBURIY: Biometrik (TouchID/FaceID) tekshiruvi shart
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      })) as any;

      if (!credential || !credential.id) {
        Message.error('Biometrik tasdiqlash bajarilmadi. Hujjat imzolanmadi!');
        setSigningInProgress(false);
        return;
      }

      credentialId = credential.id;
      detectedBiometric = isApple ? 'WEBAUTHN_FACE_ID' : isAndroid ? 'ANDROID_TOUCH_ID' : 'WEBAUTHN_TOUCH_ID';
    } catch (authErr: any) {
      console.warn('WebAuthn platform check error:', authErr);
      const errName = authErr?.name || '';
      if (errName === 'NotAllowedError') {
        Message.error('Biometrik tasdiqlash bekor qilindi yoki barmoq izi/yuz skan qilinmadi. Hujjat imzolanmadi!');
      } else if (errName === 'AbortError') {
        Message.warning('Biometrik tasdiqlash jarayoni to‘xtatildi. Qayta urinib ko‘ring.');
      } else {
        Message.error(`Biometrik tasdiqlash amalga oshmadi: ${authErr?.message || 'Qurilma biometrikasidan o‘tilmadi'}`);
      }
      setSigningInProgress(false);
      return; // STOP: Biometrika o'tmasa, hech qachon hujjat imzolanmaydi!
    }

    // 3. Serverga imzolash natijasini yuborish (faqat har ikkala tekshiruv 100% muvaffaqiyatli bo'lsa)
    const userAgent =
      typeof navigator !== 'undefined' ? navigator.userAgent : 'Mobile Device';

    try {
      const res = await apiClient.post(
        API_ENDPOINTS.SIGNING_SESSIONS.PUBLIC_CONFIRM(token!),
        {
          signerName: signerName.trim(),
          signerRole: signerRole.trim(),
          biometricType: detectedBiometric,
          deviceInfo: userAgent,
          credentialId,
          location,
        },
      );

      setSignedResult(res.data);
      Message.success('Hujjat biometrika orqali muvaffaqiyatli imzolandi!');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([60, 100, 60]); } catch { /* ignore */ }
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || '';
      if (serverMsg.includes('muddati tugagan') || serverMsg.includes('60 soniya') || err?.response?.status === 400) {
        Message.error('QR kod muddati tugagan (60 soniya). Kompyuterda QR kodni yangilang va qaytadan skaner qiling.');
      } else if (err?.code === 'ERR_NETWORK' || !err?.response) {
        Message.error('Server bilan aloqa o‘rnatilmadi. Mobil telefon va kompyuter bir xil tarmoqda ekanligini tekshiring.');
      } else {
        Message.error(serverMsg || err?.message || 'Imzolashda xatolik yuz berdi.');
      }
    } finally {
      setSigningInProgress(false);
    }
  };

  const isExpired = session?.status === 'EXPIRED';
  const isAlreadySigned = session?.status === 'SIGNED' || !!signedResult;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#F7F8FA',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 12px 60px 12px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: 540 }}>
        {/* Mobile Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              margin: '0 auto 8px auto',
              backgroundColor: isAlreadySigned ? '#E8FFEA' : isExpired ? '#FFECE8' : '#E8F3FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isAlreadySigned ? (
              <IconCheckCircle style={{ fontSize: 32, color: '#00B42A' }} />
            ) : isExpired ? (
              <IconCloseCircle style={{ fontSize: 32, color: '#F53F3F' }} />
            ) : (
              <IconMobile style={{ fontSize: 28, color: '#165DFF' }} />
            )}
          </div>

          <Text bold style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-3)', letterSpacing: 0.5 }}>
            O‘zbekiston Respublikasi Oliy Ta’lim Muassasasi
          </Text>
          <Title heading={4} style={{ margin: '4px 0 2px 0' }}>
            {isAlreadySigned
              ? 'Hujjat Imzolandi'
              : isExpired
              ? 'Imzo Muddati Tugagan'
              : 'Mobil Biometrik Imzolash'}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            UWMS Yagona Raqamli Muhrlash Markazi
          </Text>
        </div>

        {/* Auth Gate: require login before seeing document */}
        {!isAuthenticated ? (
          <Card
            style={{
              borderRadius: 8,
              borderTop: '5px solid #165DFF',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  margin: '0 auto 10px auto',
                  backgroundColor: '#E8F3FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconLock style={{ fontSize: 26, color: '#165DFF' }} />
              </div>
              <Title heading={5} style={{ margin: '0 0 6px 0' }}>
                Tizimga Kirish Talab Qilinadi
              </Title>
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                Hujjatni mobil qurilma orqali imzolash uchun avval shaxsiy hisobingiz bilan tizimga kiring.
              </Text>
            </div>

            <Form form={loginForm} layout="vertical" onSubmit={handleMobileLogin}>
              <Form.Item
                label="Foydalanuvchi nomi (Login)"
                field="username"
                rules={[{ required: true, message: 'Login kiritilishi shart!' }]}
              >
                <Input
                  prefix={<IconUser />}
                  placeholder="Masalan: omborchi"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label="Parol"
                field="password"
                rules={[{ required: true, message: 'Parol kiritilishi shart!' }]}
              >
                <Input.Password
                  prefix={<IconLock />}
                  placeholder="Parolingizni kiriting"
                  size="large"
                />
              </Form.Item>

              <Button
                type="primary"
                long
                size="large"
                loading={loginLoading}
                onClick={handleMobileLogin}
                style={{
                  height: 48,
                  fontSize: 15,
                  fontWeight: 600,
                  backgroundColor: '#165DFF',
                  borderRadius: 6,
                  marginTop: 8,
                }}
              >
                Tizimga Kirish va Imzolash
              </Button>
            </Form>
          </Card>
        ) : loading ? (
          <Card style={{ textAlign: 'center', padding: '50px 0', borderRadius: 8 }}>
            <Spin dot />
            <div style={{ marginTop: 12 }}>
              <Text>Imzolash sessiyasi yuklanmoqda...</Text>
            </div>
          </Card>
        ) : error ? (
          <Card style={{ borderTop: '4px solid #F53F3F', borderRadius: 8 }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <IconCloseCircle style={{ fontSize: 44, color: '#F53F3F' }} />
              <Title heading={5} style={{ color: '#F53F3F', marginTop: 12 }}>
                Sessiya Topilmadi
              </Title>
              <Paragraph style={{ color: 'var(--color-text-2)', fontSize: 13 }}>{error}</Paragraph>
              <Button type="primary" onClick={() => navigate('/')} style={{ marginTop: 12, borderRadius: 0 }}>
                Bosh Sahifaga O‘tish
              </Button>
            </div>
          </Card>
        ) : isAlreadySigned ? (
          /* SUCCESS STATE AFTER SIGNING */
          <Card
            style={{
              borderTop: '6px solid #00B42A',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              borderRadius: 8,
            }}
          >
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <IconCheckCircle style={{ fontSize: 48, color: '#00B42A' }} />
              <Title heading={4} style={{ color: '#00B42A', margin: '12px 0 6px 0' }}>
                Dalolatnoma Imzolandi!
              </Title>
              <Paragraph style={{ color: 'var(--color-text-2)', fontSize: 13 }}>
                Hujjat sizning TouchID/FaceID biometrikangiz orqali qonuniy tasdiqlandi va raqamli muhr bilan arxivlandi.
              </Paragraph>

              <Alert
                type="success"
                style={{ textAlign: 'left', marginTop: 16 }}
                content={
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                    <div>
                      <b>Hujjat raqami:</b> {signedResult?.docNumber || session?.docNumber}
                    </div>
                    <div>
                      <b>Mas’ul shaxs:</b> {signedResult?.signerName || signerName} ({signedResult?.signerRole || signerRole})
                    </div>
                    <div>
                      <b>Tasdiqlangan vaqt:</b>{' '}
                      {signedResult?.signedAt ? new Date(signedResult.signedAt).toLocaleString('uz-UZ') : 'Hozir'}
                    </div>
                    <div>
                      <b>Biometrik usul:</b>{' '}
                      <Tag color="green" size="small">
                        {signedResult?.biometricType || 'WEBAUTHN_BIOMETRICS'}
                      </Tag>
                    </div>
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--color-border-2)' }}>
                      <b>Audit IP & Geolokatsiya:</b>{' '}
                      <span style={{ color: '#165DFF', fontWeight: 600 }}>
                        {signedResult?.ipAddress ? `IP: ${signedResult.ipAddress}` : 'IP qayd etildi'}
                        {signedResult?.location
                          ? ` (GPS: ${signedResult.location.latitude.toFixed(4)}, ${signedResult.location.longitude.toFixed(4)})`
                          : ' (Universitet tarmog‘i orqali muhrlandi)'}
                      </span>
                    </div>
                  </div>
                }
              />

              <div style={{ marginTop: 20 }}>
                <Text style={{ fontSize: 13, color: 'var(--color-text-2)', display: 'block', marginBottom: 12 }}>
                  Kompyuteringiz ekrani avtomatik ravishda yashil rangda yangilandi.
                </Text>
                <Button
                  type="outline"
                  onClick={() =>
                    window.open(`/verify-doc/${encodeURIComponent(session?.docNumber || '')}`, '_blank')
                  }
                  style={{ borderRadius: 0 }}
                >
                  Ommaviy Reyestrdan Tekshirish
                </Button>
              </div>
            </div>
          </Card>
        ) : isExpired ? (
          /* EXPIRED STATE */
          <Card style={{ borderTop: '4px solid #F53F3F', borderRadius: 8 }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <IconClockCircle style={{ fontSize: 44, color: '#F53F3F' }} />
              <Title heading={5} style={{ color: '#F53F3F', marginTop: 12 }}>
                60 Soniyalik Muddat Tugadi
              </Title>
              <Paragraph style={{ color: 'var(--color-text-2)', fontSize: 13 }}>
                Xavfsizlik qoidalariga muvofiq bir martalik dinamik QR-kod muddati 60 soniyada tugaydi.
              </Paragraph>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Iltimos, kompyuteringiz ekranidagi "Yangi QR-kod olish" tugmasini bosing va qayta skanerlang.
              </Text>
            </div>
          </Card>
        ) : session ? (
          /* ACTIVE SIGNING FORM */
          <Card
            style={{
              borderRadius: 8,
              borderTop: '5px solid #165DFF',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            {session.expectedSignerName && currentUser?.fullName && session.expectedSignerName !== currentUser.fullName && (
              <Alert
                type="warning"
                style={{ marginBottom: 12 }}
                content={`Diqqat: Ushbu dalolatnoma '${session.expectedSignerName}' uchun biriktirilgan. Siz hozir '${currentUser.fullName}' sifatida tizimdasiz.`}
              />
            )}

            {/* Document Attributes */}
            <div style={{ borderBottom: '1px solid var(--color-border-2)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color={session.docType === 'HANDOVER_ACT' ? 'green' : 'blue'} size="large">
                  {session.docType === 'HANDOVER_ACT' ? 'OS-1 TOPSHIRISH AKTI' : session.docType}
                </Tag>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>
                  {session.docNumber}
                </span>
              </div>
              <Title heading={5} style={{ margin: '8px 0 4px 0' }}>
                {session.title}
              </Title>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 4 }}>
                <b>Ashyolar:</b> {session.itemSummary}
              </div>
              {(session.departmentName || session.roomName) && (
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                  <b>Joylashuv:</b> {session.departmentName || ''} {session.roomName || ''}
                </div>
              )}
              {session.metadata?.isHandover && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--color-fill-2)', borderRadius: 6, fontSize: 12 }}>
                  <div><b>Topshiruvchi (Eski MOL):</b> {session.metadata.departingUser}</div>
                  {session.metadata.targetUser && <div><b>Qabul qiluvchi:</b> {session.metadata.targetUser}</div>}
                  {session.metadata.building && <div><b>Bino / Xona:</b> {session.metadata.building} {session.metadata.room ? `(${session.metadata.room})` : ''}</div>}
                  {session.metadata.signatoryRole && (
                    <div style={{ marginTop: 6 }}>
                      <Tag color="arcoblue" size="small">
                        Siz ushbu dalolatnomani <b>{
                          session.metadata.signatoryRole === 'DEPARTING' ? 'Topshiruvchi (Eski MOL)' :
                          session.metadata.signatoryRole === 'TARGET' ? 'Qabul qiluvchi (Yangi MOL/Omborchi)' :
                          session.metadata.signatoryRole === 'COMMANDANT' ? 'Bino Komendanti' :
                          session.metadata.signatoryRole === 'ACCOUNTANT' ? 'Buxgalteriya vakili' : session.metadata.signatoryRole
                        }</b> sifatida imzolamoqdasiz
                      </Tag>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* If detailed items table in metadata */}
            {session.metadata?.items && session.metadata.items.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text bold style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                  {session.metadata.isHandover ? 'Topshirilayotgan Asosiy Vositalar Taqsimoti:' : 'Qabul Qilinuvchi Ashyolar Ro‘yxati:'}
                </Text>
                {session.metadata.isHandover ? (
                  <Table
                    size="small"
                    pagination={false}
                    border={{ wrapper: true, cell: true }}
                    columns={[
                      {
                        title: 'Inv №',
                        dataIndex: 'inventoryNumber',
                        width: 90,
                        render: (val: string) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{val}</span>,
                      },
                      { title: 'Aktiv nomi', dataIndex: 'name' },
                      {
                        title: 'Belgilangan amal',
                        width: 140,
                        render: (_: any, r: any) => {
                          const action = r.actionType;
                          if (action === 'TRANSFER_TO_MOL') return <Tag color="blue" size="small">MOLga o‘tadi</Tag>;
                          if (action === 'RETURN_TO_WAREHOUSE') return <Tag color="green" size="small">Omborga</Tag>;
                          if (action === 'SEND_TO_REPAIR') return <Tag color="orange" size="small">Ta’mirga</Tag>;
                          if (action === 'WRITE_OFF') return <Tag color="red" size="small">Hisobdan chiqarish</Tag>;
                          if (action === 'SHORTAGE') return <Tag color="magenta" size="small">Kamomad</Tag>;
                          return <Tag size="small">{action}</Tag>;
                        },
                      },
                    ]}
                    data={session.metadata.items}
                    rowKey={(r: any, index?: number) => r.id || r.inventoryNumber || `${r.name}-${index ?? 0}`}
                  />
                ) : (
                  <Table
                    size="small"
                    pagination={false}
                    border={{ wrapper: true, cell: true }}
                    columns={[
                      { title: 'Ashyo', dataIndex: 'name' },
                      {
                        title: 'Soni',
                        width: 80,
                        render: (_: any, i: any) => `${i.qty || 1} ${i.unit || 'dona'}`,
                      },
                    ]}
                    data={session.metadata.items}
                    rowKey={(r: any, index?: number) => r.id || r.inv || `${r.name}-${index ?? 0}`}
                  />
                )}
              </div>
            )}

            {/* Legal Commitment Notice */}
            <Alert
              type="warning"
              style={{ marginBottom: 12 }}
              content={
                session.metadata?.isHandover
                  ? "Ushbu dalolatnomadagi ashyolar ro‘yxati va moddiy javobgarlik taqsimotini shaxsiy TouchID/FaceID biometrik imzoingiz bilan tasdiqlaysizmi?"
                  : "Ushbu ashyolarni qabul qilganingiz to‘g‘risida shaxsiy TouchID/FaceID biometrik imzoingiz bilan tasdiqlaysizmi?"
              }
            />

            {/* GPS & IP Security Audit Notice */}
            <Alert
              type="info"
              icon={<IconSafe />}
              style={{ marginBottom: 16 }}
              title="Xavfsizlik va Yuridik Audit Nazorati"
              content={
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  O‘zbekiston Respublikasi OTM moliyaviy javobgarlik qonunchiligiga muvofiq,
                  ushbu hujjatni tasdiqlashda sizning <b>qurilma IP manzili</b> hamda <b>GPS geolokatsiyasi</b> universitet
                  markaziy xavfsizlik audit jurnalida (<code>SystemAuditLog</code>) qaytarilmas (WORM) tarzda muhrlanadi.
                </div>
              }
            />

            {/* Signer Confirmation Fields */}
            {session.expectedSignerName ? (
              <div
                style={{
                  background: 'var(--color-fill-2)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 6,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <IconSafe style={{ color: '#00B42A', fontSize: 18 }} />
                  <Text bold style={{ fontSize: 12, color: 'var(--color-text-1)' }}>
                    Biriktirilgan Rasmiy Imzolovchi (Autentifikatsiya qilingan):
                  </Text>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)' }}>
                  {session.expectedSignerName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 2 }}>
                  {session.expectedSignerRole || 'Mas’ul Shaxs'}
                </div>
              </div>
            ) : (
              <Form layout="vertical">
                <Form.Item label="Mas’ul Shaxs F.I.Sh. (Imzolovchi)" style={{ marginBottom: 12 }}>
                  <Input
                    value={signerName}
                    onChange={(val) => setSignerName(val)}
                    placeholder="Mas’ul xodim F.I.Sh."
                  />
                </Form.Item>

                <Form.Item label="Lavozimi / Biriktirilgan Kafedra" style={{ marginBottom: 16 }}>
                  <Input
                    value={signerRole}
                    onChange={(val) => setSignerRole(val)}
                    placeholder="Masalan: Kafedra mudiri"
                  />
                </Form.Item>
              </Form>
            )}

            {/* Big Biometric Button */}
            <div style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  status="success"
                  size="large"
                  long
                  loading={signingInProgress}
                  icon={<IconThunderbolt />}
                  style={{
                    height: 52,
                    fontSize: 16,
                    fontWeight: 'bold',
                    backgroundColor: '#00B42A',
                    borderRadius: 6,
                    boxShadow: '0 4px 12px rgba(0,180,42,0.3)',
                  }}
                  onClick={handleBiometricConfirm}
                >
                  {signingInProgress ? 'Biometrika Tasdiqlanmoqda...' : 'TouchID / FaceID Bilan Tasdiqlash'}
                </Button>
              </div>

              {signingInProgress && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    backgroundColor: '#E8FFEA',
                    border: '1px solid #B7EB8F',
                    borderRadius: 6,
                    textAlign: 'center',
                  }}
                >
                  <Spin dot />
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: '#00B42A' }}>
                    📱 Barmoq izingiz (TouchID / FaceID) orqali tasdiqlanmoqda...
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  🔒 Shaxsiy mobil qurilmangizning biometrik autentifikatsiyasi orqali tasdiqlanadi.
                </Text>
              </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
};
export default MobileSigningPage;

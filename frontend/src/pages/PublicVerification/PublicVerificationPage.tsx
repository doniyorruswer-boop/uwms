import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Tag,
  Button,
  Space,
  Spin,
  Alert,
  Table,
  Message,
  Progress,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconCopy,
  IconPrinter,
  IconArrowLeft,
  IconSafe,
  IconExclamationCircle,
  IconLock,
  IconClockCircle,
  IconMobile,
  IconQrcode,
  IconDownload,
  IconRefresh,
} from '@arco-design/web-react/icon';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants/api.constants';
import { APP_CONFIG } from '../../constants';
import { PublicVerifyResult } from '../../types';
import { formatRoleName } from '../../constants/roles.constants';

const { Title, Text, Paragraph } = Typography;

export const PublicVerificationPage: React.FC = () => {
  const { docNumber } = useParams<{ docNumber: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PublicVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const verify = async () => {
    if (!docNumber) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        API_ENDPOINTS.DOCUMENT_STAMPS.PUBLIC_VERIFY(docNumber),
      );
      setData(res.data);
    } catch (err: any) {
      // Strictly prevent internal server/DB/exception text leaks to public visitors
      const status = err?.response?.status;
      if (status === 404) {
        setError(
          `"${docNumber}" raqamli rasmiy hujjat universitet davlat reyestridan topilmadi yoki kiritilmagan. Iltimos, QR-kod yoki hujjat raqamini qayta tekshiring.`,
        );
      } else if (status === 400) {
        setError(
          'Hujjat kodi formati noto‘g‘ri yoki qidiruv parametrlarida noaniqlik mavjud.',
        );
      } else {
        setError(
          'Tizim bilan vaqtinchalik aloqa o‘rnatib bo‘lmadi yoki serverda texnik profilaktika ketmoqda. Iltimos, keyinroq qayta tekshirib ko‘ring.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verify();
  }, [docNumber]);

  const handleCopyHash = () => {
    if (data?.verificationHash) {
      navigator.clipboard.writeText(data.verificationHash);
      Message.success('Kriptografik HMAC nazorat kodi nusxalandi!');
    }
  };

  const handleDownloadPdf = async () => {
    if (!data?.docNumber) return;

    try {
      setDownloadingPdf(true);
      Message.info('Rasmiy hujjat nusxasi yuklab olinmoqda...');

      const response = await apiClient.get(
        API_ENDPOINTS.DOCUMENT_STAMPS.PUBLIC_DOWNLOAD_PDF(data.docNumber),
        { responseType: 'blob' },
      );

      const blob = new Blob([response.data], {
        type:
          (response.headers['content-type'] as string) ||
          'text/html;charset=utf-8',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${data.docNumber}_rasmiy_hujjat.html`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      Message.success('Rasmiy hujjat nusxasi muvaffaqiyatli yuklab olindi!');
    } catch {
      // If download endpoint fails or is offline, fallback to clean print
      Message.warning(
        'Yuklab olishda xatolik yuz berdi. Sahifani chop etish oynasi ochilmoqda.',
      );
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const isRevoked = data?.status === 'REVOKED' || data?.isValid === false;
  const isFullySigned =
    !isRevoked &&
    (data?.status === 'VERIFIED' ||
      (data?.signingProgress?.isFullySigned ?? true));
  const isInProgress = !isRevoked && !isFullySigned;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#F2F3F5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 12px 60px 12px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* Container */}
      <div style={{ width: '100%', maxWidth: 840, boxSizing: 'border-box' }}>
        {/* Navigation / Top Sticky Bar with Exit Button */}
        <div
          className="no-print"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: '#F2F3F5',
            padding: '10px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: 8,
            boxSizing: 'border-box',
          }}
        >
          <Button
            type="primary"
            status="default"
            icon={<IconArrowLeft />}
            onClick={() => {
              if (window.history.length > 1 && document.referrer) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            style={{
              borderRadius: 6,
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: '#1D2129',
              border: '1px solid var(--color-border-3)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              height: 38,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            Chiqish
          </Button>

          {data && (
            <Button
              type="outline"
              icon={<IconDownload />}
              loading={downloadingPdf}
              onClick={handleDownloadPdf}
              style={{
                borderRadius: 6,
                borderColor: '#165DFF',
                color: '#165DFF',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                height: 38,
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              PDF Yuklab Olish
            </Button>
          )}
        </div>

        <div
          className="no-print"
          style={{
            fontSize: 11,
            color: 'var(--color-text-3)',
            marginBottom: 14,
            textAlign: 'left',
          }}
        >
          {APP_CONFIG.defaultOrganizationName} — Elektron Hujjat Reyestri
        </div>

        {loading ? (
          <Card
            style={{ borderRadius: 0, textAlign: 'center', padding: '60px 0' }}
          >
            <Spin dot />
            <div style={{ marginTop: 16 }}>
              <Text>Universitet axborot tizimidan tekshirilmoqda...</Text>
            </div>
          </Card>
        ) : error ? (
          <Card style={{ borderRadius: 0, borderTop: '4px solid #F53F3F' }}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <IconCloseCircle style={{ fontSize: 54, color: '#F53F3F' }} />
              <Title heading={4} style={{ color: '#F53F3F', marginTop: 16 }}>
                Hujjat Tasdiqlanmadi
              </Title>
              <Paragraph
                style={{
                  color: 'var(--color-text-2)',
                  maxWidth: 520,
                  margin: '0 auto 20px auto',
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {error}
              </Paragraph>
              <Space size="medium">
                <Button
                  icon={<IconRefresh />}
                  onClick={verify}
                  style={{ borderRadius: 0 }}
                >
                  Qayta Tekshirish
                </Button>
                <Button
                  type="primary"
                  style={{ borderRadius: 0 }}
                  onClick={() => navigate('/')}
                >
                  Bosh Sahifaga O‘tish
                </Button>
              </Space>
            </div>
          </Card>
        ) : data ? (
          <Card
            className="print-area"
            style={{
              borderRadius: 0,
              borderTop: isRevoked
                ? '6px solid #F53F3F'
                : isFullySigned
                ? '6px solid #00B42A'
                : '6px solid #FA8C16',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {/* Header / University Branding */}
            <div
              style={{
                textAlign: 'center',
                borderBottom: '1px solid var(--color-border-2)',
                paddingBottom: 20,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 12px auto',
                  borderRadius: '50%',
                  backgroundColor: isRevoked
                    ? '#FFECE8'
                    : isFullySigned
                    ? '#E8FFEA'
                    : '#FFF7E6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isRevoked ? (
                  <IconCloseCircle style={{ fontSize: 32, color: '#F53F3F' }} />
                ) : isFullySigned ? (
                  <IconSafe style={{ fontSize: 32, color: '#00B42A' }} />
                ) : (
                  <IconClockCircle style={{ fontSize: 32, color: '#FA8C16' }} />
                )}
              </div>

              <Text
                bold
                style={{
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'var(--color-text-2)',
                }}
              >
                {APP_CONFIG.defaultOrganizationName}
              </Text>
              <Title heading={3} style={{ margin: '6px 0 4px 0', fontSize: 18, lineHeight: 1.4, wordBreak: 'break-word' }}>
                Ichki Elektron Hujjat Verifikatsiyasi (QR-Pairing)
              </Title>
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                Universitet markaziy axborot tizimi orqali ro‘yxatga olingan hujjat holati
              </Text>

              {/* Status Badge */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                {isRevoked ? (
                  <Tag
                    color="red"
                    size="large"
                    icon={<IconCloseCircle />}
                    style={{ fontSize: 13, padding: '6px 12px', fontWeight: 'bold', whiteSpace: 'normal', height: 'auto', textAlign: 'center', lineHeight: 1.4, maxWidth: '100%' }}
                  >
                    BEKOR QILINGAN (REVOKED — YAROQSIZ)
                  </Tag>
                ) : isFullySigned ? (
                  <Tag
                    color="green"
                    size="large"
                    icon={<IconCheckCircle />}
                    style={{ fontSize: 13, padding: '6px 12px', fontWeight: 'bold', whiteSpace: 'normal', height: 'auto', textAlign: 'center', lineHeight: 1.4, maxWidth: '100%' }}
                  >
                    ✓ HUJJAT HAQIQIY VA TO‘LIQ TASDIQLANGAN (VERIFIED — 100%)
                  </Tag>
                ) : (
                  <Tag
                    color="orange"
                    size="large"
                    icon={<IconClockCircle />}
                    style={{ fontSize: 13, padding: '6px 12px', fontWeight: 'bold', whiteSpace: 'normal', height: 'auto', textAlign: 'center', lineHeight: 1.4, maxWidth: '100%' }}
                  >
                    ⏳ TASDIQLASH JARAYONIDA ({data.signingProgress?.completedCount || 0}/
                    {data.signingProgress?.totalRequired || 1} TA IMZO QO‘YILDI)
                  </Tag>
                )}
              </div>
            </div>

            {/* Status Informational Alert */}
            {isRevoked ? (
              <div style={{ marginTop: 20 }}>
                <Alert
                  type="error"
                  icon={<IconExclamationCircle />}
                  title="DIQQAT: USHBU RASMIY HUJJAT BEKOR QILINGAN (YAROQSIZ)!"
                  content={
                    <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
                      <div>
                        <b>Bekor qilingan sana:</b>{' '}
                        {data.revokedAt
                          ? new Date(data.revokedAt).toLocaleString('uz-UZ')
                          : '—'}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <b>Bekor qilish sababi (Backend rasmiy asosi):</b>{' '}
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#CF1322',
                            backgroundColor: '#FFEBE9',
                            padding: '3px 8px',
                            borderRadius: 2,
                            display: 'inline-block',
                            marginTop: 2,
                          }}
                        >
                          {data.revokedReason ||
                            'Universitet ma’muriyati yoki audit komissiyasi qaroriga asosan bekor qilingan'}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          color: 'var(--color-text-3)',
                          fontSize: 12,
                        }}
                      >
                        * Eslatma: Ushbu hujjat reyestrda arxivlangan holda saqlanadi,
                        biroq bekor qilinganligi sababli barcha moddiy va yuridik kuchini yo‘qotgan.
                      </div>
                    </div>
                  }
                />
              </div>
            ) : isFullySigned ? (
              <div style={{ marginTop: 20 }}>
                <Alert
                  type="success"
                  icon={<IconCheckCircle />}
                  title="Hujjat Haqiqiyligi To‘liq Tasdiqlangan"
                  content="Ushbu hujjat universitet markaziy bazasida ro‘yxatga olingan. Barcha talab etilgan mas’ul shaxslar Dinamik QR-Pairing orqali o‘z imzolarini qo‘ygan va hujjatning butunligi kafolatlangan."
                />
              </div>
            ) : (
              <div style={{ marginTop: 20 }}>
                <Alert
                  type="warning"
                  icon={<IconClockCircle />}
                  title="Tasdiqlash Jarayoni Hali Yakunlanmagan"
                  content="Hujjat universitet tizimiga muvaffaqiyatli kiritilgan, biroq barcha ishtirokchilar to‘liq imzo chekib bo‘lmagan. Barcha tomonlar QR-Pairing orqali tasdiqlaganidan so‘ng to‘liq kuchga kiradi."
                />
              </div>
            )}

            {/* Privacy Guarantee Banner */}
            <div style={{ marginTop: 16 }}>
              <Alert
                type="info"
                icon={<IconLock />}
                title="Shaxsga oid ma’lumotlar daxlsizligi"
                content={
                  data.securityNotice ||
                  'Universitet xavfsizlik siyosatiga muvofiq, xodimlarning shaxsiy ma’lumotlari ochiq reyestrda ko‘rsatilmaydi.'
                }
              />
            </div>

            {/* Dynamic Signing Progress & Signers Table */}
            {data.signingProgress && (
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  backgroundColor: isRevoked
                    ? '#FFF7F5'
                    : isFullySigned
                    ? '#F6FFED'
                    : '#FFFBE6',
                  border: `1px solid ${
                    isRevoked ? '#FFA39E' : isFullySigned ? '#B7EB8F' : '#FFE58F'
                  }`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Space>
                    <IconQrcode
                      style={{
                        fontSize: 18,
                        color: isFullySigned ? '#00B42A' : '#FA8C16',
                      }}
                    />
                    <Text bold style={{ fontSize: 14 }}>
                      Dinamik QR-Pairing Imzolash Jarayoni
                    </Text>
                  </Space>
                  <Text
                    bold
                    style={{
                      color: isFullySigned ? '#00B42A' : '#FA8C16',
                      fontSize: 13,
                    }}
                  >
                    {data.signingProgress.completedCount} /{' '}
                    {data.signingProgress.totalRequired} ta tasdiq (
                    {data.signingProgress.percent}%)
                  </Text>
                </div>

                <Progress
                  percent={data.signingProgress.percent}
                  status={
                    isRevoked ? 'error' : isFullySigned ? 'success' : 'normal'
                  }
                  style={{ width: '100%', marginBottom: 16 }}
                />

                <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 12 }}>
                  <Table
                    size="small"
                    border={{ wrapper: true, cell: true }}
                    pagination={false}
                    scroll={{ x: 600 }}
                    columns={[
                      {
                        title: '№',
                        width: 50,
                        render: (_: any, __: any, idx: number) => idx + 1,
                      },
                      {
                        title: 'Mas’ul Shaxs / Lavozimi',
                        render: (_: any, signer: any) => (
                          <div>
                            <div style={{ fontWeight: 600, color: '#1D2129' }}>
                              {signer.name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: '#86909C' }}>
                              {formatRoleName(signer.role)}
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: 'Imzo Holati',
                        width: 170,
                        render: (_: any, signer: any) =>
                          signer.isSigned ? (
                            <Tag
                              color="green"
                              icon={<IconCheckCircle />}
                              style={{ fontWeight: 600 }}
                            >
                              ✓ TASDIQLANDI
                            </Tag>
                          ) : (
                            <Tag
                              color="orange"
                              icon={<IconClockCircle />}
                              style={{ fontWeight: 600 }}
                            >
                              ⏳ KUTILMOQDA
                            </Tag>
                          ),
                      },
                      {
                        title: 'Tasdiqlash Vaqti',
                        width: 160,
                        render: (_: any, signer: any) =>
                          signer.signedAt ? (
                            <span style={{ fontSize: 12 }}>
                              {new Date(signer.signedAt).toLocaleString('uz-UZ')}
                            </span>
                          ) : (
                            <span style={{ color: '#86909C', fontSize: 12 }}>—</span>
                          ),
                      },
                      {
                        title: 'Usul',
                        width: 150,
                        render: (_: any, signer: any) => (
                          <span style={{ fontSize: 12, color: '#165DFF' }}>
                            <IconMobile style={{ marginRight: 4 }} />
                            {signer.method || 'Dinamik QR-Pairing'}
                          </span>
                        ),
                      },
                    ]}
                    data={data.signingProgress.signers}
                    rowKey={(record: any) => `${record.role}-${record.name}`}
                  />
                </div>
              </div>
            )}

            {/* Document Attributes */}
            <div style={{ padding: '20px 0 12px 0' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Hujjat Nomi:</Text>
                  <Text bold style={{ color: '#165DFF', fontSize: 14, wordBreak: 'break-word' }}>
                    {data.title}
                  </Text>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Hujjat Holati:</Text>
                  <div>
                    {isRevoked ? (
                      <Tag color="red" icon={<IconCloseCircle />}>
                        BEKOR QILINGAN (REVOKED — YAROQSIZ)
                      </Tag>
                    ) : isFullySigned ? (
                      <Tag color="green" icon={<IconCheckCircle />}>
                        HAQIQIY VA TASDIQLANGAN (VERIFIED)
                      </Tag>
                    ) : (
                      <Tag color="orange" icon={<IconClockCircle />}>
                        TASDIQLASH JARAYONIDA
                      </Tag>
                    )}
                  </div>
                </div>

                {isRevoked && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                      <Text bold style={{ color: '#F53F3F', fontSize: 12 }}>Bekor Qilingan Sana:</Text>
                      <span style={{ color: '#F53F3F', fontWeight: 600 }}>
                        {data.revokedAt
                          ? new Date(data.revokedAt).toLocaleString('uz-UZ')
                          : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                      <Text bold style={{ color: '#F53F3F', fontSize: 12 }}>Bekor Qilish Asosi / Sababi:</Text>
                      <div
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#FFF2F0',
                          border: '1px solid #FFCCC7',
                          color: '#CF1322',
                          fontWeight: 600,
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {data.revokedReason ||
                          'Universitet rasmiy farmoyishiga asosan bekor qilingan'}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Hujjat Raqami:</Text>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
                    {data.docNumber}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Hujjat Turi:</Text>
                  <div><Tag>{data.docType}</Tag></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Tizimga Kiritilgan Sana:</Text>
                  <span>{new Date(data.issuedAt).toLocaleString('uz-UZ')}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Tasdiqlash Texnologiyasi:</Text>
                  <span>
                    {data.verificationMethod ||
                      'Dinamik Mobil QR-Pairing (Mobil Biometrik Tasdiq)'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--color-border-1)' }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Bosh Mas’ul / Tashabbuskor:</Text>
                  <span style={{ fontWeight: 600 }}>
                    {data.signerName} ({formatRoleName(data.signerRole)})
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10 }}>
                  <Text bold style={{ color: 'var(--color-text-2)', fontSize: 12 }}>Kriptografik HMAC Nazorat Kodi:</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        backgroundColor: 'var(--color-fill-2)',
                        padding: '6px 10px',
                        borderRadius: 4,
                        wordBreak: 'break-all',
                        maxWidth: '100%',
                        lineHeight: 1.5,
                      }}
                    >
                      {data.verificationHash}
                    </span>
                    <Button
                      size="small"
                      icon={<IconCopy />}
                      onClick={handleCopyHash}
                    >
                      Nusxalash
                    </Button>
                  </div>
                </div>
              </div>

              {/* Verified Metadata Items if available */}
              {data.metadata?.items && data.metadata.items.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Text
                    bold
                    style={{ fontSize: 14, display: 'block', marginBottom: 8 }}
                  >
                    Hujjatdagi Tasdiqlangan Ashyolar Ro‘yxati:
                  </Text>
                  <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 8 }}>
                    <Table
                      size="small"
                      border={{ wrapper: true, cell: true }}
                      pagination={false}
                      scroll={{ x: 500 }}
                      columns={[
                        {
                          title: '№',
                          width: 50,
                          render: (_: any, __: any, index: number) => index + 1,
                        },
                        {
                          title: 'Ashyo / Mahsulot Nomi',
                          dataIndex: 'name',
                        },
                        {
                          title: 'Miqdor / Inventar №',
                          render: (_: any, item: any) =>
                            item.qty
                              ? `${item.qty} ${item.unit || 'dona'}`
                              : item.inv || '—',
                        },
                        {
                          title: 'Xona / Joylashuv',
                          render: (_: any, item: any) => item.room || 'Ombor',
                        },
                      ]}
                      data={data.metadata.items}
                      rowKey={(record: any, index?: number) =>
                        record.id || record.inv || `${record.name || 'item'}-${index ?? 0}`
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* University Official Footnote (Strictly no fake legal text) */}
            <div
              style={{
                backgroundColor: 'var(--color-fill-1)',
                padding: 16,
                border: '1px solid var(--color-border-2)',
                marginTop: 12,
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-3)',
                  lineHeight: 1.6,
                }}
              >
                Ushbu ma’lumotlar {APP_CONFIG.defaultOrganizationName} markaziy axborot
                tizimida (UWMS) xavfsiz elektron reyestrda saqlanadi. Hujjatning har bir
                ishtirokchisi mobil qurilma orqali Dinamik QR-Pairing usulida tasdiqlangan
                va o‘zgartirishlardan himoyalangan.
              </div>
            </div>

            {/* Download & Print Action Buttons */}
            <div
              className="no-print"
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--color-border-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                width: '100%',
              }}
            >
              <Button
                type="primary"
                size="large"
                long
                icon={<IconDownload />}
                loading={downloadingPdf}
                onClick={handleDownloadPdf}
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Rasmiy Hujjat Nusxasini Yuklab Olish (PDF)
              </Button>
              <Button
                size="large"
                long
                icon={<IconPrinter />}
                style={{
                  borderRadius: 6,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => window.print()}
              >
                Sahifani Chop Etish (Print)
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default PublicVerificationPage;

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
        backgroundColor: '#F2F3F5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
      }}
    >
      {/* Container */}
      <div style={{ width: '100%', maxWidth: 840 }}>
        {/* Navigation / Top Back & Quick Actions */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Button
            type="text"
            icon={<IconArrowLeft />}
            onClick={() => navigate('/')}
            style={{ borderRadius: 0 }}
          >
            Tizimga Qaytish
          </Button>

          <Space>
            {data && (
              <Button
                type="outline"
                size="small"
                icon={<IconDownload />}
                loading={downloadingPdf}
                onClick={handleDownloadPdf}
                style={{ borderRadius: 0 }}
              >
                PDF Yuklab Olish
              </Button>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {APP_CONFIG.defaultOrganizationName} — Elektron Hujjat Reyestri
            </Text>
          </Space>
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
              <Title heading={3} style={{ margin: '6px 0 4px 0' }}>
                Ichki Elektron Hujjat Verifikatsiyasi (QR-Pairing)
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Universitet markaziy axborot tizimi orqali ro‘yxatga olingan hujjat holati
              </Text>

              {/* Status Badge */}
              <div style={{ marginTop: 16 }}>
                {isRevoked ? (
                  <Tag
                    color="red"
                    size="large"
                    icon={<IconCloseCircle />}
                    style={{ fontSize: 14, padding: '6px 16px', fontWeight: 'bold' }}
                  >
                    BEKOR QILINGAN (REVOKED — YAROQSIZ)
                  </Tag>
                ) : isFullySigned ? (
                  <Tag
                    color="green"
                    size="large"
                    icon={<IconCheckCircle />}
                    style={{ fontSize: 14, padding: '6px 16px', fontWeight: 'bold' }}
                  >
                    ✓ HUJJAT HAQIQIY VA TO‘LIQ TASDIQLANGAN (VERIFIED — 100%)
                  </Tag>
                ) : (
                  <Tag
                    color="orange"
                    size="large"
                    icon={<IconClockCircle />}
                    style={{ fontSize: 14, padding: '6px 16px', fontWeight: 'bold' }}
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

                <Table
                  size="small"
                  border={{ wrapper: true, cell: true }}
                  pagination={false}
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
                            {signer.role}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Imzo Holati',
                      width: 190,
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
                      width: 170,
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
                      width: 160,
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
            )}

            {/* Document Attributes */}
            <div style={{ padding: '24px 0 12px 0' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr',
                  rowGap: 14,
                  fontSize: 14,
                }}
              >
                <Text bold>Hujjat Nomi:</Text>
                <Text bold style={{ color: '#165DFF' }}>
                  {data.title}
                </Text>

                <Text bold>Hujjat Holati:</Text>
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

                {isRevoked && (
                  <>
                    <Text bold style={{ color: '#F53F3F' }}>
                      Bekor Qilingan Sana:
                    </Text>
                    <span style={{ color: '#F53F3F', fontWeight: 600 }}>
                      {data.revokedAt
                        ? new Date(data.revokedAt).toLocaleString('uz-UZ')
                        : '—'}
                    </span>

                    <Text bold style={{ color: '#F53F3F' }}>
                      Bekor Qilish Asosi / Sababi:
                    </Text>
                    <div
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#FFF2F0',
                        border: '1px solid #FFCCC7',
                        color: '#CF1322',
                        fontWeight: 600,
                        borderRadius: 2,
                      }}
                    >
                      {data.revokedReason ||
                        'Universitet rasmiy farmoyishiga asosan bekor qilingan'}
                    </div>
                  </>
                )}

                <Text bold>Hujjat Raqami:</Text>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {data.docNumber}
                </span>

                <Text bold>Hujjat Turi:</Text>
                <Tag>{data.docType}</Tag>

                <Text bold>Tizimga Kiritilgan Sana:</Text>
                <span>{new Date(data.issuedAt).toLocaleString('uz-UZ')}</span>

                <Text bold>Tasdiqlash Texnologiyasi:</Text>
                <span>
                  {data.verificationMethod ||
                    'Dinamik QR-Pairing (Mobil Biometrik Tasdiq)'}
                </span>

                <Text bold>Bosh Mas’ul / Tashabbuskor:</Text>
                <span>
                  {data.signerName} ({data.signerRole})
                </span>

                <Text bold>Kriptografik HMAC Nazorat Kodi:</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      backgroundColor: 'var(--color-fill-2)',
                      padding: '4px 8px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {data.verificationHash}
                  </span>
                  <Button
                    size="mini"
                    icon={<IconCopy />}
                    onClick={handleCopyHash}
                  />
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
                  <Table
                    size="small"
                    border={{ wrapper: true, cell: true }}
                    pagination={false}
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
              )}
            </div>

            {/* University Official Footnote (Strictly no fake legal text) */}
            <div
              style={{
                backgroundColor: 'var(--color-fill-1)',
                padding: 16,
                border: '1px solid var(--color-border-2)',
                marginTop: 12,
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
                justifyContent: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Button
                type="primary"
                size="large"
                icon={<IconDownload />}
                loading={downloadingPdf}
                onClick={handleDownloadPdf}
                style={{ borderRadius: 0, fontWeight: 600 }}
              >
                Rasmiy Hujjat Nusxasini Yuklab Olish (PDF)
              </Button>
              <Button
                size="large"
                icon={<IconPrinter />}
                style={{ borderRadius: 0 }}
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

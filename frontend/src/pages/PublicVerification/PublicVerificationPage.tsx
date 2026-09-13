import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Tag,
  Button,
  Space,
  Divider,
  Spin,
  Alert,
  Table,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconCopy,
  IconPrinter,
  IconArrowLeft,
  IconSafe,
} from '@arco-design/web-react/icon';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants/api.constants';
import { PublicVerifyResult } from '../../types';

const { Title, Text, Paragraph } = Typography;

export const PublicVerificationPage: React.FC = () => {
  const { docNumber } = useParams<{ docNumber: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PublicVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docNumber) return;

    const verify = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(
          API_ENDPOINTS.DOCUMENT_STAMPS.PUBLIC_VERIFY(docNumber),
        );
        setData(res.data);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            `"${docNumber}" raqamli hujjat davlat reestridan topilmadi yoki bekor qilingan.`,
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [docNumber]);

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
      <div style={{ width: '100%', maxWidth: 780 }}>
        {/* Navigation / Top Back */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Button
            type="text"
            icon={<IconArrowLeft />}
            onClick={() => navigate('/')}
            style={{ borderRadius: 0 }}
          >
            Tizimga Qaytish
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            UWMS Davlat Verifikatsiya Markazi
          </Text>
        </div>

        {loading ? (
          <Card style={{ borderRadius: 0, textAlign: 'center', padding: '60px 0' }}>
            <Spin dot />
            <div style={{ marginTop: 16 }}>
              <Text>Davlat kriptografik reestridan tekshirilmoqda...</Text>
            </div>
          </Card>
        ) : error ? (
          <Card style={{ borderRadius: 0, borderTop: '4px solid #F53F3F' }}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <IconCloseCircle style={{ fontSize: 54, color: '#F53F3F' }} />
              <Title heading={4} style={{ color: '#F53F3F', marginTop: 16 }}>
                Hujjat Tasdiqlanmadi
              </Title>
              <Paragraph style={{ color: 'var(--color-text-2)', maxWidth: 500, margin: '0 auto' }}>
                {error}
              </Paragraph>
              <Button
                type="primary"
                style={{ marginTop: 20, borderRadius: 0 }}
                onClick={() => navigate('/')}
              >
                Bosh Sahifaga O‘tish
              </Button>
            </div>
          </Card>
        ) : data ? (
          <Card
            style={{
              borderRadius: 0,
              borderTop: '6px solid #00B42A',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {/* Header / Republic Emblem */}
            <div style={{ textAlign: 'center', borderBottom: '1px solid var(--color-border-2)', paddingBottom: 20 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 12px auto',
                  borderRadius: '50%',
                  backgroundColor: '#E8FFEA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSafe style={{ fontSize: 32, color: '#00B42A' }} />
              </div>

              <Text bold style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-2)' }}>
                O‘zbekiston Respublikasi Oliy Ta’lim Muassasasi
              </Text>
              <Title heading={3} style={{ margin: '6px 0 4px 0' }}>
                Elektron Hujjat Verifikatsiyasi
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Yagona elektron reyestr orqali tasdiqlangan rasmiy ma’lumotlar
              </Text>

              <div style={{ marginTop: 16 }}>
                <Tag
                  color="green"
                  size="large"
                  icon={<IconCheckCircle />}
                  style={{ fontSize: 14, padding: '4px 16px' }}
                >
                  TASDIQLANGAN VA HAQIQIY (VERIFIED)
                </Tag>
              </div>
            </div>

            {/* Document Attributes */}
            <div style={{ padding: '24px 0' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr',
                  rowGap: 14,
                  fontSize: 14,
                }}
              >
                <Text bold>Hujjat Nomi:</Text>
                <Text bold style={{ color: '#165DFF' }}>
                  {data.title}
                </Text>

                <Text bold>Hujjat Raqami:</Text>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {data.docNumber}
                </span>

                <Text bold>Hujjat Turi:</Text>
                <Tag>{data.docType}</Tag>

                <Text bold>Tasdiqlangan Sana:</Text>
                <span>{new Date(data.issuedAt).toLocaleString('uz-UZ')}</span>

                <Text bold>Mas’ul Tasdiqlovchi:</Text>
                <span>
                  {data.signerName} ({data.signerRole})
                </span>

                <Text bold>Kriptografik SHA-256 Muhr:</Text>
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
                    onClick={() => {
                      navigator.clipboard.writeText(data.verificationHash);
                    }}
                  />
                </div>
              </div>

              {/* Verified Metadata items if available */}
              {data.metadata?.items && data.metadata.items.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Text bold style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
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
                    rowKey={(record: any) => `${record.name || 'item'}-${Math.random()}`}
                  />
                </div>
              )}
            </div>

            {/* Official Legal Footnote */}
            <div
              style={{
                backgroundColor: 'var(--color-fill-1)',
                padding: 16,
                border: '1px solid var(--color-border-2)',
                marginTop: 12,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.6 }}>
                Ushbu ma’lumotlar O‘zbekiston Respublikasining "Elektron hujjat aylanishi to‘g‘risida"gi hamda "Elektron raqamli imzo to‘g‘risida"gi Qonunlariga muvofiq, universitet markaziy ma’lumotlar bazasida saqlanadi va qog‘oz shaklidagi rasmiy davlat hujjati bilan teng yuridik kuchga ega.
              </div>
            </div>

            {/* Print Button */}
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Button
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

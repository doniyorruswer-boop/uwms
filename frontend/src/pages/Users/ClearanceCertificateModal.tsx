import React from 'react';
import {
  Modal,
  Button,
  Space,
  Tag,
  Card,
  Spin,
  Alert,
  Typography,
} from '@arco-design/web-react';
import {
  IconFile,
  IconPrinter,
  IconDownload,
  IconCheckCircle,
  IconCloseCircle,
} from '@arco-design/web-react/icon';
import { useClearanceCertificateQuery } from '../../hooks/useHandoverQuery';
import type { UserItem } from '../../hooks/useUsersQuery';
import { API_BASE_URL } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';

const { Text } = Typography;

interface ClearanceCertificateModalProps {
  visible: boolean;
  user: UserItem | null;
  onClose: () => void;
}

export const ClearanceCertificateModal: React.FC<ClearanceCertificateModalProps> = ({
  visible,
  user,
  onClose,
}) => {
  const userId = user?.id || '';
  const { data, isLoading, isError } = useClearanceCertificateQuery(userId, {
    enabled: visible && !!userId,
  });

  const handlePrint = () => {
    if (!data?.contentHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(data.contentHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (!userId) return;
    const downloadUrl = `${API_BASE_URL}${API_ENDPOINTS.REPORTS.CLEARANCE_CERTIFICATE_DOWNLOAD(userId)}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <Modal
      visible={visible}
      title={
        <Space>
          <IconFile style={{ color: 'var(--color-primary-6)' }} />
          <span>
            Elektron Aylanma Varaqa (Clearance Certificate) — {user?.fullName}
          </span>
        </Space>
      }
      onCancel={onClose}
      style={{ width: 920, maxWidth: '95vw', top: 25 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space>
            {data?.isCleared ? (
              <Tag color="green" icon={<IconCheckCircle />}>
                Moddiy javobgarlikdan to‘liq ozod qilingan
              </Tag>
            ) : (
              <Tag color="red" icon={<IconCloseCircle />}>
                Zimmasida aktivlar mavjud ({data?.activeAssets || 0} ta)
              </Tag>
            )}
          </Space>

          <Space>
            <Button icon={<IconDownload />} onClick={handleDownload} disabled={!data}>
              Faylni Yuklab Olish
            </Button>
            <Button
              type="primary"
              icon={<IconPrinter />}
              onClick={handlePrint}
              disabled={!data}
            >
              Chop Etish / PDF
            </Button>
            <Button type="secondary" onClick={onClose}>
              Yopish
            </Button>
          </Space>
        </div>
      }
      unmountOnExit
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin tip="Elektron aylanma varaqa ma’lumotlari tayyorlanmoqda..." />
        </div>
      ) : isError || !data ? (
        <Alert
          type="error"
          title="Ma’lumot yuklanmadi"
          content="Aylanma varaqa ma’lumotlarini olishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko‘ring."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--color-fill-2)',
              padding: '10px 16px',
              borderRadius: 4,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                № {data.certificateNumber}
              </span>
              <span style={{ color: 'var(--color-text-3)', marginLeft: 12, fontSize: 12 }}>
                Sana: {new Date(data.issueDate).toLocaleDateString('uz-UZ')}
              </span>
            </div>

            <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
              HMAC Xesh: <code>{data.verificationHash.slice(0, 24)}...</code>
            </div>
          </div>

          {/* Certificate Paper Container */}
          <Card
            className="uwms-card"
            style={{
              maxHeight: 560,
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid var(--color-border)',
              padding: 0,
            }}
            bodyStyle={{ padding: 12 }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: data.contentHtml }}
              style={{
                transform: 'scale(0.96)',
                transformOrigin: 'top center',
              }}
            />
          </Card>
        </div>
      )}
    </Modal>
  );
};

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Spin,
  Alert,
  Empty,
  Tag,
  Typography,
  Message,
} from '@arco-design/web-react';
import {
  IconPrinter,
  IconHistory,
  IconFile,
  IconRefresh,
  IconCheckCircle,
  IconClockCircle,
} from '@arco-design/web-react/icon';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';
import type { HandoverDocumentResponse } from '../../hooks/useHandoverQuery';

interface HandoverDocModalProps {
  visible: boolean;
  handoverId: string | null;
  onClose: () => void;
  onOpenAudit?: (handoverId: string) => void;
}

export const HandoverDocModal: React.FC<HandoverDocModalProps> = ({
  visible,
  handoverId,
  onClose,
  onOpenAudit,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch official OS-1 Document from server
  const {
    data: docData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<HandoverDocumentResponse>({
    queryKey: ['handover-doc-view', handoverId],
    queryFn: async () => {
      const res = await apiClient.get<HandoverDocumentResponse>(
        API_ENDPOINTS.HANDOVERS.DOCUMENT(handoverId || ''),
      );
      return res.data;
    },
    enabled: visible && !!handoverId,
  });

  const handlePrint = () => {
    if (!docData?.contentHtml) {
      Message.warning('Chop etish uchun hujjat matni mavjud emas');
      return;
    }

    try {
      setIsPrinting(true);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(docData.contentHtml);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          setIsPrinting(false);
        }, 500);
      } else {
        setIsPrinting(false);
        Message.error('Brauzer oynasi bloklandi. Iltimos, qalqib chiquvchi oynalarga ruxsat bering');
      }
    } catch {
      setIsPrinting(false);
      Message.error('Hujjatni chop etishda xatolik yuz berdi');
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 32 }}>
          <Space size="medium">
            <IconFile style={{ color: '#165DFF', fontSize: 20 }} />
            <Typography.Text bold style={{ fontSize: 16 }}>
              OS-1 Topshirish-Qabul Qilish Dalolatnomasi — {docData?.handoverNumber || 'Yuklanmoqda...'}
            </Typography.Text>
            {docData && (
              <Tag
                color={docData.isFullySigned ? 'green' : 'orange'}
                icon={docData.isFullySigned ? <IconCheckCircle /> : <IconClockCircle />}
                style={{ borderRadius: 0, fontWeight: 500 }}
              >
                {docData.isFullySigned ? 'Tasdiqlangan / Muhrlangan' : 'Imzolar Jarayonida'}
              </Tag>
            )}
          </Space>
        </div>
      }
      style={{ width: 920, top: 20 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="small">
            <Button
              icon={<IconRefresh />}
              loading={isFetching}
              onClick={() => refetch()}
              style={{ borderRadius: 0 }}
            >
              Yangilash
            </Button>
            {onOpenAudit && handoverId && (
              <Button
                type="outline"
                icon={<IconHistory />}
                onClick={() => {
                  onClose();
                  onOpenAudit(handoverId);
                }}
                style={{ borderRadius: 0 }}
              >
                Audit Logini Ko‘rish
              </Button>
            )}
          </Space>

          <Space size="small">
            <Button
              type="primary"
              icon={<IconPrinter />}
              loading={isPrinting}
              onClick={handlePrint}
              disabled={!docData?.contentHtml}
              style={{ borderRadius: 0, fontWeight: 500 }}
            >
              Chop Etish (PDF)
            </Button>
            <Button onClick={onClose} style={{ borderRadius: 0 }}>
              Yopish
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ minHeight: 480, maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', padding: '8px 4px' }}>
        {/* LOADING UX STATE (Rule 6.3) */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size={32} tip="Davlat standarti OS-1 elektron dalolatnomasi yuklanmoqda..." />
          </div>
        ) : isError ? (
          /* ERROR UX STATE (Rule 6.3) */
          <div style={{ padding: 20 }}>
            <Alert
              type="error"
              title="Dalolatnoma hujjatini yuklab bo‘lmadi"
              content="Server bilan aloqa uzilgan yoki dalolatnoma hali to‘liq shakllanmagan bo‘lishi mumkin."
              action={
                <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
                  Qayta urinish
                </Button>
              }
              style={{ borderRadius: 0 }}
            />
          </div>
        ) : !docData || !docData.contentHtml ? (
          /* EMPTY UX STATE (Rule 6.3) */
          <div style={{ padding: '80px 0' }}>
            <Empty description="Dalolatnomaning rasmiy elektron hujjati topilmadi" />
          </div>
        ) : (
          /* A4 DOCUMENT VIEWER CONTAINER */
          <div
            style={{
              backgroundColor: '#FFFFFF',
              color: '#000000',
              padding: '24px 32px',
              border: '1px solid #E5E6EB',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
              fontFamily: 'serif',
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: docData.contentHtml }}
              style={{
                width: '100%',
                overflowX: 'auto',
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default HandoverDocModal;

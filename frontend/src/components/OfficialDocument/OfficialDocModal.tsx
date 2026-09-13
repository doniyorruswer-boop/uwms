import React from 'react';
import { Modal, Button, Space } from '@arco-design/web-react';
import { IconPrinter, IconCheckCircle } from '@arco-design/web-react/icon';
import { APP_CONFIG, DOCUMENT_TEMPLATES, type DocType } from '../../constants';

export interface OfficialDocProps {
  visible: boolean;
  onClose: () => void;
  docType: DocType;
  docNumber: string;
  date: string;
  sourceLocation?: string;
  targetLocation?: string;
  senderName?: string;
  receiverName?: string;
  items: {
    inventoryNumber: string;
    name: string;
    model?: string;
    serialNumber?: string;
    price?: number;
    quantity: number;
    unit: string;
  }[];
  reason?: string;
}

export const OfficialDocModal: React.FC<OfficialDocProps> = ({
  visible,
  onClose,
  docType,
  docNumber,
  date,
  sourceLocation,
  targetLocation,
  senderName,
  receiverName,
  items,
  reason,
}) => {
  const docMeta = DOCUMENT_TEMPLATES[docType];

  return (
    <Modal
      style={{ width: 840 }}
      title={`Rasmiy Universitet Hujjati (${docMeta.formCode} shakli)`}
      visible={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button type="primary" icon={<IconPrinter />} onClick={() => window.print()} style={{ borderRadius: 0 }}>
            Hujjatni Chop Etish (Print)
          </Button>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>Yopish</Button>
        </Space>
      }
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px' }}>
        <div
          className="print-area"
          style={{
            background: '#fff',
            color: '#000',
            padding: '32px 40px',
            border: '1px solid #d9d9d9',
            borderRadius: '0px',
            fontSize: '13px',
            lineHeight: 1.6,
            fontFamily: 'Times New Roman, serif',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>
              {APP_CONFIG.ministryName}
            </div>
            <div style={{ fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4 }}>
              {APP_CONFIG.defaultOrganizationName}
            </div>
            <div style={{ borderBottom: '2px solid #000', margin: '12px auto', width: '85%' }} />
          </div>

          {/* Doc Title */}
          <div style={{ textAlign: 'center', margin: '16px 0 24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>
              {docMeta.title}
            </h3>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>
              Hujjat № <u>{docNumber}</u> ({docMeta.formCode})
            </div>
            <div style={{ fontSize: 12, color: '#333', marginTop: 4 }}>
              Sana: {date} yil &nbsp;&nbsp;|&nbsp;&nbsp; {APP_CONFIG.city}
            </div>
          </div>

          {/* Parties Info */}
          <div style={{ marginBottom: 20, fontSize: 13 }}>
            {docType === 'TRANSFER' && (
              <div>
                <p style={{ margin: '4px 0' }}>
                  <b>Jo‘natuvchi (Topshiruvchi bino/ombor):</b> {sourceLocation || 'Chiqim joylashuvi'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <b>Qabul qiluvchi (Kafedra / Xona):</b> {targetLocation || 'Qabul joylashuvi'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <b>Asos:</b> {reason || 'Ichki siljish buyrug‘i va talabnoma'}
                </p>
              </div>
            )}
            {docType === 'KIRIM' && (
              <div>
                <p style={{ margin: '4px 0' }}>
                  <b>Ta’minotchi tashkilot:</b> {sourceLocation || 'Ta’minotchi / Shartnoma'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <b>Qabul qiluvchi ombor:</b> {targetLocation || 'Qabul ombori'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <b>Asos hujjati:</b> {reason || 'Hisob-faktura va kirim orderi'}
                </p>
              </div>
            )}
            {docType === 'SPISANIE' && (
              <div>
                <p style={{ margin: '4px 0' }}>
                  <b>Hisobdan chiqarish asosi:</b> {reason || 'Eskirish va texnik yaroqsizlik dalolatnomasi'}
                </p>
              </div>
            )}
            {docType === 'AUDIT' && (
              <div>
                <p style={{ margin: '4px 0' }}>
                  <b>Inventarizatsiya obyekti (Xona):</b> {sourceLocation || 'Universitet xonasi'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <b>Tekshiruvchi komissiya (Auditor):</b> {receiverName || 'Ichki nazorat va audit guruhi'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <b>Moddiy javobgar shaxs (MOL):</b> {senderName || 'Kafedra mudiri / Laborant'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <b>Audit xulosasi va asosi:</b> {reason || 'Rejali inventarizatsiya natijalari solishtirildi (INV-19)'}
                </p>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              margin: '16px 0 24px',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ border: '1px solid #000', padding: '6px' }}>№</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Inventar №</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Moddiy aktiv nomi va modeli</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Seriya №</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Birligi</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Soni</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Balans qiymati (so‘m)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>{item.inventoryNumber}</td>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>{item.name} {item.model ? `(${item.model})` : ''}</td>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>{item.serialNumber || '—'}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                    {item.price ? item.price.toLocaleString('uz-UZ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ marginTop: 36, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <div>
              <p style={{ margin: '8px 0' }}><b>{docMeta.senderLabel}:</b></p>
              <p style={{ margin: '8px 0', color: '#555' }}>
                {senderName || docMeta.senderLabel} ___________________
              </p>
              <p style={{ fontSize: 11, color: '#888' }}>(imzo, sana)</p>
            </div>

            <div>
              <p style={{ margin: '8px 0' }}><b>{docMeta.receiverLabel}:</b></p>
              <p style={{ margin: '8px 0', color: '#555' }}>
                {receiverName || docMeta.receiverLabel} ___________________
              </p>
              <p style={{ fontSize: 11, color: '#888' }}>(imzo, sana)</p>
            </div>

            <div>
              <p style={{ margin: '8px 0' }}><b>{docMeta.supervisorLabel}:</b></p>
              <p style={{ margin: '8px 0', color: '#555' }}>
                Tasdiqlovchi mas’ul ___________________
              </p>
              <p style={{ fontSize: 11, color: '#888' }}>(imzo, muhr o‘rni)</p>
            </div>
          </div>

          {/* Cryptographic Verification Stamp Banner */}
          <div
            style={{
              marginTop: 40,
              padding: '12px 16px',
              border: '2px dashed #4E5969',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FAFAFA',
            }}
          >
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: '#1D2129' }}>
                O‘zbekiston Respublikasi OTM Davlat Elektron Hujjat Reyestri
              </div>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#00B42A', margin: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconCheckCircle /> ELEKTRON RAQAMLI RO‘YXATDAN O‘TGAN (VERIFIED)
              </div>
              <div style={{ fontSize: 11, color: '#4E5969' }}>
                Hujjat haqiqiyligini tekshirish: <u>{window.location.origin}/verify-doc/{docNumber}</u>
              </div>
              <div style={{ fontSize: 10, color: '#86909C', marginTop: 2 }}>
                Kriptografik SHA-256 muhr bilan himoyalangan. Qonuniy yuridik kuchga ega.
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=${encodeURIComponent(
                  `${window.location.origin}/verify-doc/${docNumber}`,
                )}`}
                alt="Verification QR"
                style={{ width: 80, height: 80, border: '1px solid #C9CDD4', padding: 2, background: '#fff' }}
              />
              <div style={{ fontSize: 9, color: '#86909C', marginTop: 2 }}>QR Skaner qiling</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>

  );
};

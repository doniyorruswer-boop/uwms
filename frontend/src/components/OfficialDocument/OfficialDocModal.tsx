import React, { useState, useMemo } from 'react';
import {
  Modal,
  Button,
  Space,
  Drawer,
  Table,
  Tag,
  Message,
  Input,
  Tooltip,
  Alert,
} from '@arco-design/web-react';
import {
  IconPrinter,
  IconCheckCircle,
  IconCheckCircleFill,
  IconClockCircle,
  IconHistory,
  IconDownload,
  IconCloseCircle,
  IconFile,
  IconStamp,
  IconMobile,
  IconQrcode,
} from '@arco-design/web-react/icon';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants/api.constants';
import { APP_CONFIG, DOCUMENT_TEMPLATES, type DocType } from '../../constants';
import {
  documentArchivesApi,
  type DocumentArchiveItem,
} from '../../api/documentArchives.api';

export interface DocumentSignatureParticipant {
  role: string;
  name: string;
  signedAt?: string;
  signatureHash?: string;
  biometricType?: string;
  isSigned?: boolean;
}

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
  supervisorName?: string;
  signatures?: DocumentSignatureParticipant[];
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
  entityId?: string;
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
  supervisorName,
  signatures,
  items,
  reason,
  entityId,
}) => {
  const docMeta = DOCUMENT_TEMPLATES[docType] || DOCUMENT_TEMPLATES.TRANSFER;
  const effectiveEntityId = entityId || docNumber;

  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [selectedArchiveVersion, setSelectedArchiveVersion] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch Version History from database
  const {
    data: archives = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['doc-archives', docType, effectiveEntityId],
    queryFn: () =>
      documentArchivesApi.getHistory({
        entityId: effectiveEntityId,
        docType,
      }),
    enabled: visible,
  });

  const latestArchive = archives.length > 0 ? archives[0] : null;

  // Fetch real document stamp from database if stamped
  const { data: realStamp } = useQuery({
    queryKey: ['doc-stamp', docNumber],
    queryFn: async () => {
      try {
        const res = await apiClient.get(
          API_ENDPOINTS.DOCUMENT_STAMPS.PUBLIC_VERIFY(docNumber),
        );
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: visible && !!docNumber,
  });

  const effectiveSignatures: DocumentSignatureParticipant[] = useMemo(() => {
    // 1. If explicit signatures prop is provided:
    if (signatures && signatures.length > 0) {
      if (docType === 'KIRIM') {
        return signatures.filter(
          (s) =>
            s.role !== docMeta.senderLabel &&
            !s.role.toLowerCase().includes('ta’minotchi') &&
            !s.role.toLowerCase().includes("ta'minotchi") &&
            !s.role.toLowerCase().includes('yetkazib beruvchi') &&
            !s.role.toLowerCase().includes('shartnoma'),
        );
      }
      return signatures;
    }

    // 2. Base list of participants required for this official form:
    const baseList: DocumentSignatureParticipant[] = [];

    if (docType === 'KIRIM') {
      // OS-1 Kirim aktida tovarlarni qabul qilib oluvchi yagona moddiy javobgar shaxs: Bosh ombor mudiri
      baseList.push({
        role: docMeta.receiverLabel,
        name: receiverName || 'Bosh ombor mudiri',
        isSigned: false,
      });
    } else if (docType === 'TRANSFER') {
      // OS-2 Chiqim/Siljish nakladnoyida faqat 2 ta tomon: Topshiruvchi Bosh ombor mudiri va Qabul qiluvchi Bino komendanti
      baseList.push({
        role: docMeta.senderLabel,
        name: senderName || 'Bosh ombor mudiri',
        isSigned: false,
      });
      baseList.push({
        role: docMeta.receiverLabel,
        name: receiverName || 'Bino komendanti',
        isSigned: false,
      });
    } else if (docType === 'KAFEDRA_HANDOVER') {
      // Komendant va Talabnoma kiritgan shaxs (Bo'lim boshlig'i / Kafedra mudiri / Prorektor) o'rtasidagi topshirish-qabul qilish shartnomasi
      baseList.push({
        role: docMeta.senderLabel,
        name: senderName || 'Bino komendanti',
        isSigned: false,
      });
      baseList.push({
        role: docMeta.receiverLabel,
        name: receiverName || 'Mas’ul shaxs (Kafedra mudiri / Bo‘lim boshlig‘i / Prorektor)',
        isSigned: false,
      });
    } else {
      if (senderName) {
        baseList.push({
          role: docMeta.senderLabel,
          name: senderName,
          isSigned: false,
        });
      }
      if (receiverName) {
        baseList.push({
          role: docMeta.receiverLabel,
          name: receiverName,
          isSigned: false,
        });
      }
      if (supervisorName) {
        baseList.push({
          role: docMeta.supervisorLabel,
          name: supervisorName,
          isSigned: false,
        });
      }
    }

    // 3. Extract real verified signatures from realStamp or latestArchive metadata:
    const stampSigners =
      realStamp?.signingProgress?.signers ||
      (Array.isArray(realStamp?.metadata?.signatures) ? realStamp.metadata.signatures : null);

    const archiveSigners =
      latestArchive?.metadata?.signatures && Array.isArray(latestArchive.metadata.signatures)
        ? latestArchive.metadata.signatures
        : null;

    const sourceSigners = stampSigners || archiveSigners;

    const normalizeStr = (str?: string) =>
      (str || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();

    const isMatch = (roleA?: string, nameA?: string, roleB?: string, nameB?: string) => {
      const normNameA = normalizeStr(nameA);
      const normNameB = normalizeStr(nameB);
      if (normNameA && normNameB) {
        if (normNameA === normNameB || normNameA.includes(normNameB) || normNameB.includes(normNameA)) {
          return true;
        }
      }
      const normRoleA = normalizeStr(roleA);
      const normRoleB = normalizeStr(roleB);
      if (normRoleA && normRoleB) {
        if (normRoleA === normRoleB) return true;
        if (normRoleA.includes('ombor') && normRoleB.includes('ombor')) return true;
        if (normRoleA.includes('komendant') && normRoleB.includes('komendant')) return true;
        if (normRoleA.includes('mudir') && normRoleB.includes('mudir')) return true;
        if (normRoleA.includes('prorektor') && normRoleB.includes('prorektor')) return true;
        if (normRoleA.includes('hisobchi') && normRoleB.includes('hisobchi')) return true;
      }
      return false;
    };

    if (sourceSigners && sourceSigners.length > 0) {
      return baseList.map((participant) => {
        const matched = sourceSigners.find(
          (s: any) =>
            isMatch(participant.role, participant.name, s.role, s.name) ||
            (docType === 'KIRIM' && Boolean(s.isSigned)),
        );

        if (matched && Boolean(matched.isSigned)) {
          return {
            ...participant,
            name: matched.name || participant.name,
            isSigned: true,
            signedAt: matched.signedAt
              ? new Date(matched.signedAt).toLocaleString('uz-UZ')
              : realStamp?.issuedAt
              ? new Date(realStamp.issuedAt).toLocaleString('uz-UZ')
              : undefined,
            biometricType: matched.method || realStamp?.verificationMethod || 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
            signatureHash: matched.signatureHash || realStamp?.verificationHash || latestArchive?.checksum,
          };
        }

        return {
          ...participant,
          isSigned: false,
        };
      });
    }

    // 4. Single-signer stamp fallback / fully-signed fallback:
    if (realStamp && realStamp.isValid) {
      if (realStamp.signingProgress?.isFullySigned) {
        return baseList.map((participant) => ({
          ...participant,
          isSigned: true,
          signedAt: realStamp.issuedAt ? new Date(realStamp.issuedAt).toLocaleString('uz-UZ') : undefined,
          biometricType: realStamp.verificationMethod || 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
          signatureHash: realStamp.verificationHash,
        }));
      }

      return baseList.map((participant) => {
        const isThisSigner = isMatch(participant.role, participant.name, realStamp.signerRole, realStamp.signerName);

        if (isThisSigner) {
          return {
            ...participant,
            name: realStamp.signerName || participant.name,
            isSigned: true,
            signedAt: realStamp.issuedAt ? new Date(realStamp.issuedAt).toLocaleString('uz-UZ') : undefined,
            biometricType: realStamp.verificationMethod || 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
            signatureHash: realStamp.verificationHash,
          };
        }

        return {
          ...participant,
          isSigned: false,
        };
      });
    }

    // 5. Default: No signatures yet in database
    return baseList;
  }, [signatures, realStamp, latestArchive, docMeta, senderName, receiverName, supervisorName, docType]);



  // Handle Archive Creation
  const handleArchive = async () => {
    try {
      setIsArchiving(true);
      await documentArchivesApi.generateArchive({
        docType,
        entityId: effectiveEntityId,
        docNumber,
        title: docMeta.title,
        metadata: {
          sourceLocation,
          targetLocation,
          senderName,
          receiverName,
          reason,
          items,
          signatures: effectiveSignatures,
        },
      });
      Message.success('Hujjat rasmiy arxivga muvaffaqiyatli saqlandi va versiyalandi!');
      await refetchHistory();
    } catch (err: any) {
      Message.error(
        err?.response?.data?.message || 'Arxivlashda xatolik yuz berdi',
      );
    } finally {
      setIsArchiving(false);
    }
  };

  // Handle Download File
  const handleDownload = async (record: DocumentArchiveItem) => {
    try {
      Message.info('Fayl yuklab olinmoqda...');
      await documentArchivesApi.downloadArchive(
        record.id,
        `${record.docType}_${record.docNumber}_v${record.version}.html`,
      );
      Message.success('Fayl muvaffaqiyatli yuklab olindi');
    } catch {
      Message.error('Faylni yuklab olishda xatolik yuz berdi');
    }
  };

  // Handle Cancel Document
  const handleConfirmCancel = async () => {
    if (!selectedArchiveId) return;
    if (!cancelReason.trim()) {
      Message.warning('Iltimos, bekor qilishning asosli sababini kiriting!');
      return;
    }

    try {
      setIsCancelling(true);
      await documentArchivesApi.cancelArchive(selectedArchiveId, cancelReason.trim());
      Message.success('Arxivlangan hujjat muvaffaqiyatli bekor qilindi');
      setCancelModalVisible(false);
      setSelectedArchiveId(null);
      setSelectedArchiveVersion(null);
      setCancelReason('');
      await refetchHistory();
    } catch (err: any) {
      Message.error(
        err?.response?.data?.message || 'Bekor qilishda xatolik yuz berdi',
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Archive History Table Columns
  const historyColumns = [
    {
      title: 'Versiya',
      dataIndex: 'version',
      width: 90,
      render: (v: number) => (
        <Tag color="arcoblue" style={{ fontWeight: 'bold' }}>
          v{v}
        </Tag>
      ),
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      width: 140,
      render: (status: string, record: DocumentArchiveItem) => {
        if (status === 'SIGNED') {
          return (
            <Tag color="green" icon={<IconCheckCircle />}>
              Tasdiqlangan
            </Tag>
          );
        }
        if (status === 'CANCELLED') {
          return (
            <Tooltip content={record.cancelReason || 'Sabab ko‘rsatilmagan'}>
              <Tag color="red" icon={<IconCloseCircle />}>
                Bekor qilingan
              </Tag>
            </Tooltip>
          );
        }
        if (status === 'ARCHIVED') {
          return <Tag color="gray">Arxivlangan</Tag>;
        }
        return <Tag>{status}</Tag>;
      },
    },
    {
      title: 'Sana va Vaqt',
      dataIndex: 'createdAt',
      width: 160,
      render: (val: string) => (val ? new Date(val).toLocaleString('uz-UZ') : '—'),
    },
    {
      title: 'Mas’ul Shaxs',
      dataIndex: 'signedBy',
      width: 180,
      render: (_: any, record: DocumentArchiveItem) =>
        record.signedBy?.fullName || 'Tizim foydalanuvchisi',
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 210,
      render: (_: any, record: DocumentArchiveItem) => (
        <Space>
          <Button
            size="mini"
            type="primary"
            icon={<IconDownload />}
            onClick={() => handleDownload(record)}
          >
            Yuklab olish
          </Button>
          {record.status !== 'CANCELLED' && (
            <Button
              size="mini"
              status="danger"
              icon={<IconCloseCircle />}
              onClick={() => {
                setSelectedArchiveId(record.id);
                setSelectedArchiveVersion(record.version);
                setCancelModalVisible(true);
              }}
            >
              Bekor qilish
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        style={{ width: 940 }}
        title={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingRight: 32,
            }}
          >
            <span>Rasmiy Universitet Hujjati ({docMeta.formCode} shakli)</span>
            {latestArchive && (
              <Tag
                color={
                  latestArchive.status === 'CANCELLED'
                    ? 'red'
                    : latestArchive.status === 'SIGNED'
                    ? 'green'
                    : 'arcoblue'
                }
                style={{ fontWeight: 600 }}
              >
                {latestArchive.status === 'CANCELLED'
                  ? `Bekor qilingan (v${latestArchive.version})`
                  : latestArchive.status === 'SIGNED'
                  ? `Tasdiqlangan: v${latestArchive.version}`
                  : `Arxivda: v${latestArchive.version}`}
              </Tag>
            )}
          </div>
        }
        visible={visible}
        onCancel={onClose}
        footer={
          <Space>
            <Button
              type="primary"
              status="success"
              icon={<IconFile />}
              loading={isArchiving}
              onClick={handleArchive}
              style={{ borderRadius: 0 }}
            >
              Arxivga Saqlash
            </Button>
            <Button
              icon={<IconHistory />}
              onClick={() => setHistoryDrawerVisible(true)}
              style={{ borderRadius: 0 }}
            >
              Versiyalar tarixi {archives.length > 0 && `(${archives.length})`}
            </Button>
            <Button
              type="primary"
              icon={<IconPrinter />}
              onClick={() => window.print()}
              style={{ borderRadius: 0 }}
            >
              Chop Etish
            </Button>
            <Button onClick={onClose} style={{ borderRadius: 0 }}>
              Yopish
            </Button>
          </Space>
        }
      >
        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px' }}>
          {latestArchive?.status === 'CANCELLED' && (
            <Alert
              type="error"
              style={{ marginBottom: 16 }}
              title="Diqqat: Ushbu hujjat bekor qilingan!"
              content={`Bekor qilish asosi: ${latestArchive.cancelReason || 'Ko‘rsatilmagan'}`}
            />
          )}

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
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  color: '#1D2129',
                  letterSpacing: '0.5px',
                }}
              >
                {APP_CONFIG.defaultOrganizationName}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#4E5969',
                  marginTop: 4,
                }}
              >
                Moddiy-texnik ta’minot va aktivlarni boshqarish tizimi
              </div>
              <div
                style={{
                  borderBottom: '2px solid #000',
                  margin: '12px auto',
                  width: '85%',
                }}
              />
            </div>

            {/* Doc Title */}
            <div style={{ textAlign: 'center', margin: '16px 0 24px' }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 'bold',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                {docMeta.title}
              </h3>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>
                Hujjat № <u>{docNumber}</u> ({docMeta.formCode})
                {latestArchive && ` — Versiya: v${latestArchive.version}`}
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
                    <b>Topshiruvchi (Ombor):</b>{' '}
                    {sourceLocation || 'Universitet Bosh Ombori'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Qabul qiluvchi (Bino / Komendant):</b>{' '}
                    {targetLocation || 'Bino komendanti'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Asos:</b> {reason || 'Ichki siljish buyrug‘i va talabnoma'}
                  </p>
                </div>
              )}
              {docType === 'KAFEDRA_HANDOVER' && (
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <b>Topshiruvchi (Bino komendanti):</b>{' '}
                    {senderName || 'Bino komendanti'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Qabul qiluvchi mas’ul shaxs:</b>{' '}
                    {receiverName || 'Kafedra mudiri / Bo‘lim boshlig‘i / Prorektor'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Biriktirilgan manzil / Xona:</b>{' '}
                    {targetLocation || 'Kafedra / Bo‘lim'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Topshirish-qabul qilish asosi:</b>{' '}
                    {reason || 'Talabnoma bo‘yicha ashyolarni xonaga o‘zaro imzo bilan topshirish-qabul qilish'}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '11px', color: '#86909C' }}>
                    <i>* Izoh: Ushbu dalolatnoma bino komendanti hamda talabnoma kiritgan mas’ul shaxs (Kafedra mudiri / Bo‘lim boshlig‘i / Prorektor) o‘rtasida o‘zaro imzo almashish orqali topshirish-qabul qilishni rasmiylashtiradi.</i>
                  </p>
                </div>
              )}
              {docType === 'KIRIM' && (
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <b>Ta’minotchi tashkilot:</b>{' '}
                    {sourceLocation || senderName || 'Ta’minotchi / Shartnoma'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Qabul qiluvchi ombor:</b>{' '}
                    {targetLocation || 'Qabul ombori'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Asos hujjati:</b> {reason || 'Hisob-faktura va kirim orderi'}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '11px', color: '#86909C' }}>
                    <i>* Izoh: Ta’minotchi tashqi yuridik shaxs hisoblanib, topshirish majburiyati davlat EHF (Elektron hisob-faktura) orqali rasmiylashtiriladi. Universitet ichki kirim akti bosh ombor mudiri tomonidan QR-Pairing orqali muhrlanadi.</i>
                  </p>
                </div>
              )}
              {docType === 'SPISANIE' && (
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <b>Hisobdan chiqarish asosi:</b>{' '}
                    {reason || 'Eskirish va texnik yaroqsizlik dalolatnomasi'}
                  </p>
                </div>
              )}
              {docType === 'AUDIT' && (
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <b>Inventarizatsiya obyekti (Xona):</b>{' '}
                    {sourceLocation || 'Universitet xonasi'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Tekshiruvchi komissiya (Auditor):</b>{' '}
                    {receiverName || 'Ichki nazorat va audit guruhi'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Moddiy javobgar shaxs (MOL):</b>{' '}
                    {senderName || 'Kafedra mudiri / Laborant'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Audit xulosasi va asosi:</b>{' '}
                    {reason ||
                      'Rejali inventarizatsiya natijalari solishtirildi (INV-19)'}
                  </p>
                </div>
              )}
              {docType === 'AUDIT_DECREE' && (
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <b>Farmoyish beruvchi:</b>{' '}
                    {senderName || 'Universitet Rektori'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Mas’ul bosh auditor / Komissiya raisi:</b>{' '}
                    {receiverName || 'Ichki audit boshqarmasi'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Inventarizatsiya qamrovi:</b>{' '}
                    {sourceLocation || 'Universitet binolari va xonalari'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Farmoyish asosi va maqsadi:</b>{' '}
                    {reason ||
                      'Universitet moddiy boyliklari butligini ta’minlash va qoldiqlarni qayta sanash'}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '11px', color: '#86909C' }}>
                    <i>* Izoh: Ushbu farmoyish Universitet Rektori tomonidan elektron raqamli imzo (QR-Pairing) orqali tasdiqlangan va qonuniy kuchga kirgan.</i>
                  </p>
                </div>
              )}
              {(docType === 'MOL_TRANSFER' || docType === 'RETURN') && (
                <div>
                  <p style={{ margin: '4px 0' }}>
                    <b>Topshiruvchi tomon:</b> {senderName || 'Topshiruvchi mas’ul'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Qabul qiluvchi tomon:</b>{' '}
                    {receiverName || 'Qabul qiluvchi mas’ul'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <b>Asos:</b> {reason || 'Rasmiy universitet buyrug‘i'}
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
                  <th style={{ border: '1px solid #000', padding: '6px' }}>
                    Inventar №
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px' }}>
                    Moddiy aktiv nomi va modeli
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px' }}>
                    Seriya №
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px' }}>
                    Birligi
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px' }}>Soni</th>
                  <th style={{ border: '1px solid #000', padding: '6px' }}>
                    Balans qiymati (so‘m)
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        border: '1px solid #000',
                        padding: '6px',
                        textAlign: 'center',
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        border: '1px solid #000',
                        padding: '6px',
                        fontWeight: 'bold',
                      }}
                    >
                      {item.inventoryNumber}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>
                      {item.name} {item.model ? `(${item.model})` : ''}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>
                      {item.serialNumber || '—'}
                    </td>
                    <td
                      style={{
                        border: '1px solid #000',
                        padding: '6px',
                        textAlign: 'center',
                      }}
                    >
                      {item.unit}
                    </td>
                    <td
                      style={{
                        border: '1px solid #000',
                        padding: '6px',
                        textAlign: 'center',
                      }}
                    >
                      {item.quantity}
                    </td>
                    <td
                      style={{
                        border: '1px solid #000',
                        padding: '6px',
                        textAlign: 'right',
                      }}
                    >
                      {item.price ? item.price.toLocaleString('uz-UZ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Participating Signers - Official Electronic Digital Signature Stamps */}
            <div style={{ marginTop: 32 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#4E5969',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <IconStamp style={{ color: '#165DFF', fontSize: 14 }} />
                <span>Hujjatda ishtirok etuvchi mas’ul shaxslar (QR-Pairing tasdiqlari):</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    effectiveSignatures.length <= 2
                      ? 'repeat(2, 1fr)'
                      : effectiveSignatures.length === 3
                      ? 'repeat(3, 1fr)'
                      : 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: 12,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {effectiveSignatures.map((sig, idx) => {
                  const isSigned = sig.isSigned !== false;
                  return (
                    <div
                      key={idx}
                      style={{
                        border: isSigned ? '1.5px solid #00B42A' : '1.5px dashed #C9CDD4',
                        backgroundColor: isSigned ? '#F6FFED' : '#FAFAFA',
                        borderRadius: 4,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        boxShadow: isSigned ? '0 1px 4px rgba(0, 180, 42, 0.08)' : 'none',
                      }}
                    >
                      {/* Header of Stamp */}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 6,
                            borderBottom: isSigned ? '1px solid #B7EB8F' : '1px dashed #E5E6EB',
                            paddingBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: isSigned ? '#00B42A' : '#FA8C16',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {isSigned ? (
                              <>
                                <IconCheckCircleFill style={{ color: '#00B42A' }} />
                                QR-PAIRING BILAN TASDIQLANDI
                              </>
                            ) : (
                              <>
                                <IconClockCircle style={{ color: '#FA8C16' }} />
                                TASDIQ KUTILMOQDA
                              </>
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 2,
                              backgroundColor: isSigned ? '#E8FFEA' : '#F2F3F5',
                              color: isSigned ? '#00B42A' : '#86909C',
                              fontFamily: 'monospace',
                            }}
                          >
                            № {idx + 1}
                          </span>
                        </div>

                        {/* Signer Role & Full Name */}
                        <div
                          style={{
                            fontSize: 10,
                            color: '#4E5969',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                          }}
                        >
                          {sig.role}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#1D2129',
                            margin: '3px 0 6px 0',
                          }}
                        >
                          {sig.name}
                        </div>
                      </div>

                      {/* Verification Details */}
                      <div
                        style={{
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: isSigned ? '1px solid #D9F7BE' : '1px dashed #E5E6EB',
                          fontSize: 10,
                          color: '#4E5969',
                          lineHeight: 1.4,
                        }}
                      >
                        {isSigned ? (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                color: '#165DFF',
                                fontWeight: 600,
                              }}
                            >
                              <IconMobile style={{ fontSize: 11 }} />
                              <span>{sig.biometricType || 'FaceID (QR-Pairing)'}</span>
                            </div>
                            {sig.signedAt && (
                              <div style={{ color: '#4E5969', fontSize: 10, marginTop: 2 }}>
                                Vaqt: <b>{sig.signedAt}</b>
                              </div>
                            )}
                            {sig.signatureHash && (
                              <div
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 9,
                                  color: '#00B42A',
                                  marginTop: 3,
                                  wordBreak: 'break-all',
                                  backgroundColor: '#E8FFEA',
                                  padding: '2px 4px',
                                  borderRadius: 2,
                                }}
                                title={sig.signatureHash}
                              >
                                HASH: {sig.signatureHash.length > 24 ? `${sig.signatureHash.substring(0, 24)}...` : sig.signatureHash}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ color: '#86909C', fontStyle: 'italic', fontSize: 10 }}>
                            Mobil ilovada QR-Pairing orqali biometrik tasdiqlash kutilmoqda...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    color: '#1D2129',
                  }}
                >
                  {APP_CONFIG.defaultOrganizationName} — Ichki Elektron Hujjat Reyestri
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: effectiveSignatures.length > 0 && effectiveSignatures.every((s) => s.isSigned) ? '#00B42A' : '#FA8C16',
                    margin: '2px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {effectiveSignatures.length > 0 && effectiveSignatures.every((s) => s.isSigned) ? (
                    <>
                      <IconCheckCircle style={{ color: '#00B42A' }} /> QR-PAIRING BILAN TO‘LIQ TASDIQLANGAN (VERIFIED)
                    </>
                  ) : (
                    <>
                      <IconClockCircle style={{ color: '#FA8C16' }} /> TASDIQLASH JARAYONIDA (IMZOLAR KUTILMOQDA)
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#4E5969' }}>
                  Hujjat haqiqiyligi va imzolar progressini tekshirish:{' '}
                  <u>
                    {window.location.origin}/verify-doc/{docNumber}
                  </u>
                </div>
                <div style={{ fontSize: 10, color: '#86909C', marginTop: 2 }}>
                  Universitet tizimida ro‘yxatga olingan. Dinamik QR-Pairing orqali tekshiriladi.
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=${encodeURIComponent(
                    `${window.location.origin}/verify-doc/${docNumber}`,
                  )}`}
                  alt="Verification QR"
                  style={{
                    width: 80,
                    height: 80,
                    border: '1px solid #C9CDD4',
                    padding: 2,
                    background: '#fff',
                  }}
                />
                <div style={{ fontSize: 9, color: '#86909C', marginTop: 2 }}>
                  QR Skaner qiling
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* VERSION HISTORY DRAWER */}
      <Drawer
        width={760}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconHistory style={{ color: 'var(--color-primary-6)' }} />
            <span>
              Hujjat Versiyalari Tarixi ({docNumber} — {docMeta.formCode})
            </span>
          </div>
        }
        visible={historyDrawerVisible}
        onCancel={() => setHistoryDrawerVisible(false)}
        footer={
          <Button onClick={() => setHistoryDrawerVisible(false)}>Yopish</Button>
        }
      >
        <Table
          rowKey="id"
          loading={historyLoading}
          columns={historyColumns}
          data={archives}
          pagination={false}
          noDataElement={
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#86909c' }}>
              Ushbu hujjat uchun hali arxivlangan versiya mavjud emas. "Arxivga
              Saqlash va Muhrlash" tugmasi orqali yangi versiya yarating.
            </div>
          }
        />
      </Drawer>

      {/* CANCEL REASON MODAL */}
      <Modal
        title={`Hujjatni Bekor Qilish (v${selectedArchiveVersion || 1})`}
        visible={cancelModalVisible}
        onCancel={() => {
          setCancelModalVisible(false);
          setCancelReason('');
        }}
        onOk={handleConfirmCancel}
        confirmLoading={isCancelling}
        okText="Bekor Qilishni Tasdiqlash"
        cancelText="Ortga"
        okButtonProps={{ status: 'danger' }}
      >
        <div style={{ marginBottom: 12, color: '#4E5969' }}>
          Ushbu rasmiy hujjatni bekor qilish sababini ko‘rsating. Bu sabab davlat
          audit jurnalida (Audit Log) qonuniy qayd etiladi.
        </div>
        <Input.TextArea
          rows={3}
          value={cancelReason}
          onChange={(val) => setCancelReason(val)}
          placeholder="Masalan: Kafedra buyrug‘i bekor qilinganligi sababli yangi dalolatnoma tuziladi..."
        />
      </Modal>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Checkbox,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Tag,
  Divider,
  Card,
  Progress,
  Message,
} from '@arco-design/web-react';
import {
  IconTool,
  IconCheckCircle,
  IconClose,
  IconCheck,
  IconExclamationCircle,
  IconSafe,
} from '@arco-design/web-react/icon';
import type { RequestRecord } from '../../types';

const { Title, Text, Paragraph } = Typography;

interface TechnicalInspectionModalProps {
  visible: boolean;
  onClose: () => void;
  request: RequestRecord | null;
  onConfirm: (checklist: {
    packagingIntegrity: boolean;
    completeness: boolean;
    powerSafety: boolean;
    serialNumberMatch: boolean;
    specsCompliance: boolean;
    notes?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export const TechnicalInspectionModal: React.FC<TechnicalInspectionModalProps> = ({
  visible,
  onClose,
  request,
  onConfirm,
  loading = false,
}) => {
  const [packagingIntegrity, setPackagingIntegrity] = useState<boolean>(false);
  const [completeness, setCompleteness] = useState<boolean>(false);
  const [powerSafety, setPowerSafety] = useState<boolean>(false);
  const [serialNumberMatch, setSerialNumberMatch] = useState<boolean>(false);
  const [specsCompliance, setSpecsCompliance] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setPackagingIntegrity(false);
      setCompleteness(false);
      setPowerSafety(false);
      setSerialNumberMatch(false);
      setSpecsCompliance(false);
      setNotes('');
    }
  }, [visible]);

  if (!request) return null;

  const checklistItems = [
    {
      id: 'packagingIntegrity',
      num: 1,
      title: 'Qadoq va jismoniy butunlik',
      desc: 'Zavod qadog‘i shikastlanmagan, uskunaning korpusida darz, yoriq, sinish, chizilgan yoki zarba izlari yo‘qligi tekshirildi.',
      checked: packagingIntegrity,
      onChange: setPackagingIntegrity,
    },
    {
      id: 'completeness',
      num: 2,
      title: 'To‘liq komplektatsiya va butlovchi qismlar',
      desc: 'Barcha quvvat kabellari, zaryadlash adapteri, texnik pasport, kafolat taloni va standart aksessuarlar to‘liq mavjud.',
      checked: completeness,
      onChange: setCompleteness,
    },
    {
      id: 'powerSafety',
      num: 3,
      title: 'Elektr va yong‘in xavfsizligi (Power-ON sinovi)',
      desc: 'Elektr tarmog‘iga ulanganda qisqa tutashuv, tutash, me’yordan ortiq qizish yoki shovqin yo‘qligi, indikatorlar me’yorda ishlashi sinovdan o‘tkazildi.',
      checked: powerSafety,
      onChange: setPowerSafety,
    },
    {
      id: 'serialNumberMatch',
      num: 4,
      title: 'Zavod seriya raqami (S/N) va kafolat muvofiqligi',
      desc: 'Uskuna korpusidagi zavod seriya raqami (S/N) hisob-faktura, texnik pasport va kafolat taloni bilan 100% mos keladi.',
      checked: serialNumberMatch,
      onChange: setSerialNumberMatch,
    },
    {
      id: 'specsCompliance',
      num: 5,
      title: 'Texnik parametrlar va shartnoma talablariga mosligi',
      desc: 'Protsessor, tezkor xotira (RAM), doimiy xotira (SSD/HDD), quvvat va boshqa parametrlar talabnomada buyurtma qilingan spetsifikatsiyalarga to‘liq javob beradi.',
      checked: specsCompliance,
      onChange: setSpecsCompliance,
    },
  ];

  const checkedCount = checklistItems.filter((i) => i.checked).length;
  const isAllChecked = checkedCount === 5;
  const progressPercent = Math.round((checkedCount / 5) * 100);

  const handleSubmit = async () => {
    if (!isAllChecked) {
      Message.warning('Xavfsizlik bo‘yicha barcha 5 ta tekshiruv punkti bajarilishi shart!');
      return;
    }

    await onConfirm({
      packagingIntegrity,
      completeness,
      powerSafety,
      serialNumberMatch,
      specsCompliance,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              background: '#E8F3FF',
              color: '#165DFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconTool style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-1)' }}>
              5 Bosqichli Texnik Ko‘rik va Sozlik Nazorati
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 400 }}>
              Talabnoma: <b>{request.requestNumber}</b> · Rasmiy AKT-TEX shakllantirish
            </div>
          </div>
        </div>
      }
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText={isAllChecked ? 'Texnik ko‘rikdan o‘tdi (Soz) — QR Tasdiq' : `Texnik ko‘rikdan o‘tdi (${checkedCount}/5)`}
      cancelText="Bekor qilish"
      okButtonProps={{
        type: 'primary',
        status: isAllChecked ? 'success' : 'default',
        disabled: !isAllChecked,
        loading,
        style: {
          borderRadius: 2,
          fontWeight: 600,
          background: isAllChecked ? '#00b42a' : undefined,
          borderColor: isAllChecked ? '#00b42a' : undefined,
        },
      }}
      cancelButtonProps={{ style: { borderRadius: 2 } }}
      style={{ width: 720, top: 40 }}
      autoFocus={false}
      maskClosable={false}
    >
      {/* MAHSULOTLAR MA'LUMOTI */}
      <div
        style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: 'var(--color-fill-2)',
          borderRadius: 4,
          border: '1px solid var(--color-border-2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>
            TEKSHIRILAYOTGAN MAHSULOTLAR RO‘YXATI:
          </span>
          <Tag color="arcoblue" size="small" style={{ borderRadius: 2 }}>
            Ombor holatida (OS-1 qabul qilingan)
          </Tag>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {request.items.map((it) => (
            <Tag
              key={it.id}
              color="gray"
              style={{
                fontSize: 12,
                borderRadius: 2,
                padding: '4px 8px',
                border: '1px solid var(--color-border-3)',
              }}
            >
              <b>{it.itemName}</b>: {it.requestedQty} {it.unit}
            </Tag>
          ))}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>
            Xavfsizlik va sozlik nazorati holati:
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: isAllChecked ? '#00b42a' : '#ff7d00',
            }}
          >
            {checkedCount} / 5 bajarildi ({progressPercent}%)
          </span>
        </div>
        <Progress
          percent={progressPercent}
          status={isAllChecked ? 'success' : 'normal'}
          size="small"
          showText={false}
          color={isAllChecked ? '#00b42a' : '#165DFF'}
        />
      </div>

      {/* OGOHLANTIRISH YOKI MUVAFFAQIYAT BANNERI */}
      {!isAllChecked ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 4 }}
          content={
            <div style={{ fontSize: 12, lineHeight: 1.45 }}>
              <b>Xavfsizlik talabi:</b> Barcha 5 ta tekshiruv punkti birma-bir ko‘rikdan o‘tkazilib
              tasdiqlanishi shart. Qolib ketgan tekshirish bor bo‘lsa, uskunani soz deb topish va xonaga/bo‘limga
              topshirishga ruxsat berilmaydi.
            </div>
          }
        />
      ) : (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16, borderRadius: 4 }}
          content={
            <div style={{ fontSize: 12, lineHeight: 1.45 }}>
              <b>Tekshiruv to‘liq yakunlandi (5/5):</b> Barcha punktlar ijobiy xulosaga ega. Pastdagi
              tugmani bosib rasmiy <b>AKT-TEX</b> dalolatnomasini elektron (QR) imzolash orqali tasdiqlashingiz mumkin.
            </div>
          }
        />
      )}

      {/* 5 TA CHECKLIST KARTALARI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {checklistItems.map((item) => (
          <div
            key={item.id}
            onClick={() => item.onChange(!item.checked)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 4,
              border: `1px solid ${item.checked ? '#00b42a' : 'var(--color-border-2)'}`,
              background: item.checked ? 'rgba(0, 180, 42, 0.04)' : 'var(--color-bg-2)',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <div style={{ paddingTop: 2 }} onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={item.checked}
                onChange={(checked) => item.onChange(checked)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: item.checked ? '#00b42a' : 'var(--color-text-1)',
                  marginBottom: 2,
                }}
              >
                {item.num}. {item.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.4 }}>
                {item.desc}
              </div>
            </div>
            <div>
              {item.checked ? (
                <Tag color="green" size="small" style={{ borderRadius: 2 }}>
                  <IconCheck style={{ marginRight: 4 }} /> Soz
                </Tag>
              ) : (
                <Tag color="gray" size="small" style={{ borderRadius: 2 }}>
                  Kutilmoqda
                </Tag>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* QO'SHIMCHA IZOH VA XULOSA */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 4 }}>
          Texnik xulosa va qo‘shimcha izohlar (Seriya raqamlari, test natijalari):
        </div>
        <Input.TextArea
          placeholder="Masalan: Dell Inspiron S/N: CN-0982-124 sinovdan o‘tkazildi. Quvvat bloki va portlari soz holatda. Foydalanishga to‘liq yaroqli."
          rows={2}
          value={notes}
          onChange={(val) => setNotes(val)}
          style={{ fontSize: 13, borderRadius: 2 }}
        />
      </div>
    </Modal>
  );
};

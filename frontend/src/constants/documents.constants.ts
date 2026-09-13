/**
 * UWMS — O‘zbekiston Respublikasi Oliy Ta’lim Standartidagi Rasmiy Hujjatlar Konfiguratsiyasi
 */

export type DocType = 'KIRIM' | 'TRANSFER' | 'SPISANIE' | 'AUDIT';

export interface DocumentMeta {
  type: DocType;
  formCode: string;
  title: string;
  legalBasisDefault: string;
  senderLabel: string;
  receiverLabel: string;
  supervisorLabel: string;
}

export const DOCUMENT_TEMPLATES: Record<DocType, DocumentMeta> = {
  KIRIM: {
    type: 'KIRIM',
    formCode: 'OS-1',
    title: 'ASOSIY VOSITALARNI QABUL QILISH VA KIRIM DALOLATNOMASI',
    legalBasisDefault: 'Hisob-faktura va kirim orderi',
    senderLabel: 'Ta’minotchi / Shartnoma',
    receiverLabel: 'Qabul qiluvchi ombor mudiri',
    supervisorLabel: 'Bosh buxgalter',
  },
  TRANSFER: {
    type: 'TRANSFER',
    formCode: 'OS-2',
    title: 'ICHKI SILJISH VA TOPSHIRISH-QABUL QILISH YUK XATI (NAKLADNOY)',
    legalBasisDefault: 'Ichki siljish buyrug‘i va talabnoma',
    senderLabel: 'Topshiruvchi ombor mudiri',
    receiverLabel: 'Qabul qiluvchi (MOL mudiri)',
    supervisorLabel: 'Moddiy bo‘lim buxgalteri',
  },
  SPISANIE: {
    type: 'SPISANIE',
    formCode: 'OS-4',
    title: 'YAROQSIZ VA MA’NAN ESKIRGAN MULKLARNI HISOBDAN CHIQARISH (SPISANIE) DALOLATNOMASI',
    legalBasisDefault: 'Eskirish va texnik yaroqsizlik ekspertiza xulosasi',
    senderLabel: 'Mulkka javobgar shaxs (MOL)',
    receiverLabel: 'Spisanie komissiyasi raisi',
    supervisorLabel: 'Moliya va iqtisod bo‘yicha prorektor',
  },
  AUDIT: {
    type: 'AUDIT',
    formCode: 'INV-19',
    title: 'INVENTARIZATSIYA NATIJALARI VA QOLDIQLARNI SOLISHTIRISH DALOLATNOMASI',
    legalBasisDefault: 'Rejali inventarizatsiya natijalari solishtirildi (INV-19)',
    senderLabel: 'Moddiy javobgar shaxs (MOL)',
    receiverLabel: 'Auditor / Komissiya a’zosi',
    supervisorLabel: 'Ichki audit boshqarmasi boshlig‘i',
  },
};

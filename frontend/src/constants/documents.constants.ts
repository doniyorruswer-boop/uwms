/**
 * UWMS — O‘zbekiston Respublikasi Oliy Ta’lim Standartidagi Rasmiy Hujjatlar Konfiguratsiyasi
 */

export type DocType =
  | 'KIRIM'
  | 'TRANSFER'
  | 'SPISANIE'
  | 'AUDIT'
  | 'AUDIT_DECREE'
  | 'MOL_TRANSFER'
  | 'RETURN'
  | 'KAFEDRA_HANDOVER';

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
    receiverLabel: 'Qabul qiluvchi bosh ombor mudiri',
    supervisorLabel: 'Bosh ombor mudiri',
  },
  TRANSFER: {
    type: 'TRANSFER',
    formCode: 'OS-2',
    title: 'ICHKI SILJISH VA TOPSHIRISH-QABUL QILISH YUK XATI (NAKLADNOY)',
    legalBasisDefault: 'Ichki siljish buyrug‘i va talabnoma',
    senderLabel: 'Topshiruvchi bosh ombor mudiri',
    receiverLabel: 'Qabul qiluvchi bino komendanti',
    supervisorLabel: 'Bosh ombor mudiri',
  },
  KAFEDRA_HANDOVER: {
    type: 'KAFEDRA_HANDOVER',
    formCode: 'AKT-OS2',
    title: 'ICHKI TOPSHIRISH-QABUL QILISH DALOLATNOMASI (KAFEDRA / BO‘LIM QABULI)',
    legalBasisDefault: 'Tasdiqlangan talabnoma va xonaga topshirish-qabul qilish dalolatnomasi',
    senderLabel: 'Topshiruvchi bino komendanti',
    receiverLabel: 'Qabul qiluvchi mas’ul (Bo‘lim boshlig‘i / Kafedra mudiri / Prorektor)',
    supervisorLabel: 'Bosh buxgalter',
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
  AUDIT_DECREE: {
    type: 'AUDIT_DECREE',
    formCode: 'FARMOYISH',
    title: 'UNIVERSITETDA REJALI INVENTARIZATSIYA O‘TKAZISH TO‘G‘RISIDA REKTOR FARMOYISHI',
    legalBasisDefault: 'Oliy ta’lim muassasasi Nizomi hamda moddiy boyliklar butligini ta’minlash qoidalari',
    senderLabel: 'Universitet Rektorati',
    receiverLabel: 'Mas’ul bosh auditor / Komissiya raisi',
    supervisorLabel: 'Universitet Rektori',
  },
  MOL_TRANSFER: {
    type: 'MOL_TRANSFER',
    formCode: 'MOL-AKT',
    title: 'MODDIY JAVOBGAR SHAXSLAR O‘RTASIDA VOSITALARNI TOPSHIRISH-QABUL QILISH DALOLATNOMASI',
    legalBasisDefault: 'Kafedra mudiri / MOL o‘zgarishi to‘g‘risidagi buyruq',
    senderLabel: 'Topshiruvchi moddiy javobgar shaxs (MOL)',
    receiverLabel: 'Qabul qiluvchi yangi moddiy javobgar shaxs (MOL)',
    supervisorLabel: 'Bosh buxgalter / Moddiy hisob bo‘limi',
  },
  RETURN: {
    type: 'RETURN',
    formCode: 'QAYTIM-AKT',
    title: 'ASOSIY VOSITANI KAFEDRADAN OMBORGA QAYTARISH DALOLATNOMASI',
    legalBasisDefault: 'Ehtiyoj qolmaganligi yoki texnik xizmatga topshirish arizasi',
    senderLabel: 'Qaytaruvchi mas’ul shaxs (MOL)',
    receiverLabel: 'Qabul qiluvchi ombor mudiri',
    supervisorLabel: 'Moddiy hisob buxgalteri',
  },
};

/**
 * UWMS — Unikal Kodlar va Identifikatorlar Konfiguratsiyasi
 */

export const CODE_GENERATOR_CONFIG = {
  // O‘zbekiston Soliq To‘lovchining Identifikatsiya Raqami (9 xonali)
  INN: {
    PREFIX: '30',
    LENGTH: 9,
    BASE_NUM: 300000000,
  },
  // Shartnoma raqami (SH-YYYY-XXXXXXXX)
  CONTRACT: {
    PREFIX: 'SH',
    DIGITS: 8,
  },
  // Hisob-faktura raqami (HF-YYYY-XXXXXXXX)
  INVOICE: {
    PREFIX: 'HF',
    DIGITS: 8,
  },
  // Asosiy vosita inventar raqami (INV-YYYY-XXXXXXXX)
  INVENTORY: {
    PREFIX: 'INV',
    DIGITS: 8,
  },
  // Harakat jurnali raqami (MOV-YYYY-XXXXXXXX)
  MOVEMENT: {
    PREFIX: 'MOV',
    DIGITS: 8,
  },
  // Ta'mirlash talabnomasi raqami (REP-YYYY-XXXXXXXX)
  REPAIR: {
    PREFIX: 'REP',
    DIGITS: 8,
  },
  // Ko'chirish arizasi raqami (TRF-YYYY-XXXXXXXX)
  TRANSFER: {
    PREFIX: 'TRF',
    DIGITS: 8,
  },
  // Davlat dalolatnomalari (OS1, OS2, OS4, INV19)
  DOCUMENTS: {
    OS1: 'OS1',
    OS2: 'OS2',
    OS4: 'OS4',
    INV19: 'INV19',
    DIGITS: 8,
  },
  // QR-kod prefiksi
  QR_PREFIX: 'UWMS:ASSET',
} as const;

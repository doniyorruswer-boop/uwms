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
  // Shartnoma raqami (SH-YYYY-XXXX)
  CONTRACT: {
    PREFIX: 'SH',
    DIGITS: 4,
  },
  // Hisob-faktura raqami (HF-YYYY-XXXX)
  INVOICE: {
    PREFIX: 'HF',
    DIGITS: 4,
  },
  // Asosiy vosita inventar raqami (INV-YYYY-XXXXX)
  INVENTORY: {
    PREFIX: 'INV',
    DIGITS: 5,
  },
  // Harakat jurnali raqami (MOV-YYYY-XXXXX)
  MOVEMENT: {
    PREFIX: 'MOV',
    DIGITS: 5,
  },
  // Ta'mirlash talabnomasi raqami (REP-YYYY-XXXX)
  REPAIR: {
    PREFIX: 'REP',
    DIGITS: 4,
  },
  // Ko'chirish arizasi raqami (TRF-YYYY-XXXX)
  TRANSFER: {
    PREFIX: 'TRF',
    DIGITS: 4,
  },
  // Davlat dalolatnomalari (OS1, OS2, OS4, INV19)
  DOCUMENTS: {
    OS1: 'OS1',
    OS2: 'OS2',
    OS4: 'OS4',
    INV19: 'INV19',
    DIGITS: 4,
  },
  // QR-kod prefiksi
  QR_PREFIX: 'UWMS:ASSET',
} as const;

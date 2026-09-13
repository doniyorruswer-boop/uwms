/**
 * UWMS — Markazlashtirilgan Ilova va Tizim Konfiguratsiyasi
 * Barcha asosiy metama'lumotlar, tashkilot rekvizitlari va dizayn tokenlari shu yerda saqlanadi.
 */

export const APP_CONFIG = {
  name: 'UWMS',
  fullName: 'Universitet Ombor va Inventar Boshqaruv Tizimi',
  shortDescription: 'Oliy ta’lim muassasalarida moddiy aktivlar va sarflanuvchi materiallarni hisobga olish',
  version: '1.0.0',
  
  // Tashkilot va yurisdiksiya ma'lumotlari (Davlat standarti)
  ministryName: 'O‘zbekiston Respublikasi Oliy Ta’lim, Fan va Innovatsiyalar Vazirligi',
  defaultOrganizationName: 'Universitet Moddiy-Texnik Ta’minot va Ombor Boshqarmasi',
  universityName: 'O‘zbekiston Milliy Universiteti',
  city: 'Toshkent shahri',
  country: 'O‘zbekiston',

  // Formatlash va lokalizatsiya
  locale: 'uz-UZ',
  currency: 'so‘m',
  dateFormat: 'DD.MM.YYYY',
  dateTimeFormat: 'DD.MM.YYYY HH:mm',

  // Aloqa va yordam
  supportPhone: '+998 (71) 200-00-00',
  supportEmail: 'support@uwms.uz',
} as const;

export const DESIGN_TOKENS = {
  // Qat'iy qoida: Butun tizimda o'tkir burchakli (0 border-radius) standart
  borderRadius: 0,
  borderRadiusStyle: '0px',
  
  // Asosiy brend ranglari
  primaryColor: '#165DFF',
  primaryHover: '#4080FF',
  successColor: '#00B42A',
  warningColor: '#FF7D00',
  dangerColor: '#F53F3F',
  infoColor: '#86909C',

  // O'lchamlar
  sidebarWidth: 250,
  sidebarCollapsedWidth: 48,
  headerHeight: 64,
} as const;

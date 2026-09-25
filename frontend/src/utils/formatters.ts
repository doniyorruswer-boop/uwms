/**
 * UWMS — Markazlashtirilgan Formatlash Utilitalari (Single Source of Truth for Formatters)
 * Barcha sahifa va modallarda valyuta, sana va miqdor formatlash faqat ushbu utilitalar orqali bajariladi.
 */

/**
 * Valyuta qiymatini O‘zbekiston so‘mi formatida chiroyli ko‘rsatish
 * Masalan: 12500000 -> "12 500 000 so‘m"
 * @param amount Son yoki raqamli string
 * @param fallback Qiymat bo'lmaganda chiqadigan matn (default: '0 so‘m')
 */
export function formatMoney(
  amount: number | string | null | undefined,
  fallback = '0 so‘m',
): string {
  if (amount === null || amount === undefined || amount === '') {
    return fallback;
  }
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(numeric)) {
    return fallback;
  }
  return `${numeric.toLocaleString('uz-UZ')} so‘m`;
}

/**
 * Sanani o'zbekcha lokalizatsiyalangan formatda ko'rsatish
 * @param date Sana stringi yoki Date obyekti
 * @param includeTime Soat va daqiqa qo'shilsinmi (default: true)
 */
export function formatDate(
  date: string | Date | null | undefined,
  includeTime = true,
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    if (!includeTime) {
      return d.toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }

    return d.toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Miqdor va o'lchov birligini chiroyli formatlash
 * Masalan: formatQuantity(15, 'DONA') -> "15 dona"
 */
export function formatQuantity(
  qty: number | null | undefined,
  unit = 'dona',
): string {
  if (qty === null || qty === undefined) return `0 ${unit.toLowerCase()}`;
  return `${Number(qty).toLocaleString('uz-UZ')} ${unit.toLowerCase()}`;
}

/**
 * Foiz stavkasini formatlash (masalan 20 -> "20.0%")
 */
export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '0.0%';
  return `${Number(val).toFixed(1)}%`;
}

/**
 * Valyutani million so'm ko'rinishida formatlash (masalan 25400000 -> "25.4")
 */
export function formatMln(amount: number | string | null | undefined, fallback = '0.0'): string {
  if (amount === null || amount === undefined || amount === '') return fallback;
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) return fallback;
  return (num / 1_000_000).toFixed(1);
}

/**
 * O'zbekiston telefon raqamini ko'rsatish uchun formatlash
 * Masalan: "+998901234567" -> "+998 (90) 123-45-67"
 */
export function formatUzbekPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('998') ? digits.slice(3) : digits;
  if (local.length !== 9) return phone;
  return `+998 (${local.slice(0, 2)}) ${local.slice(2, 5)}-${local.slice(5, 7)}-${local.slice(7, 9)}`;
}

/**
 * Telefon kiritish maydoni uchun avtomatik shablon (Input mask)
 * Foydalanuvchi yozganda faqat raqamlarni oladi va +998 (XX) XXX-XX-XX formatiga keltiradi
 */
export function formatUzbekPhoneInput(val: string): string {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');

  if (digits.startsWith('998')) {
    digits = digits.slice(3);
  }

  digits = digits.slice(0, 9);

  if (digits.length === 0) {
    return val.startsWith('+') ? '+998 ' : '';
  }

  let formatted = '+998 (';
  formatted += digits.slice(0, 2);
  if (digits.length >= 2) {
    formatted += ') ';
  }
  if (digits.length > 2) {
    formatted += digits.slice(2, 5);
  }
  if (digits.length > 5) {
    formatted += '-' + digits.slice(5, 7);
  }
  if (digits.length > 7) {
    formatted += '-' + digits.slice(7, 9);
  }

  return formatted;
}

/**
 * Telefon raqami O'zbekiston shabloniga to'liq mos kelishini tekshirish
 * Talab: +998 va 9 ta raqam (jami 12 ta raqam)
 */
export function isUzbekPhoneValid(val: string | null | undefined): boolean {
  if (!val) return false;
  const digits = val.replace(/\D/g, '');
  return (digits.startsWith('998') && digits.length === 12) || digits.length === 9;
}



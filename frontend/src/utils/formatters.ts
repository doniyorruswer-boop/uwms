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


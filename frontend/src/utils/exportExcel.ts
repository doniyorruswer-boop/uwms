import * as ExcelJS from 'exceljs';
import { Message } from '@arco-design/web-react';

export interface ExportExcelOptions {
  /** Hex color code for the header background (without '#'), default '165DFF' (Arco Blue) */
  headerColor?: string;
  /** Hex color code for the header font, default 'FFFFFF' */
  headerTextColor?: string;
  /** Whether to enable Excel auto-filter dropdowns on header, default true */
  enableAutoFilter?: boolean;
  /** Whether to add thin borders to every table cell, default true */
  showBorders?: boolean;
  /** Whether to alternate zebra background on rows, default true */
  zebraStriping?: boolean;
  /** Custom column width overrides by column key */
  columnWidths?: Record<string, number>;
}

/**
 * Universitet UWMS yagona standartlashtirilgan Excel eksport funksiyasi.
 * Barcha sahifalardagi ro'yxat va reestrlarni professional, to'liq ko'rinadigan
 * ustun kengliklari, sarlavha rangi (Arco Blue) va qat'iy katak chegaralari (Borders)
 * bilan eksport qiladi.
 *
 * @param data Eksport qilinadigan ob'ektlar massivlari
 * @param fileName Yaratiladigan fayl nomi (kengaytmasiz)
 * @param sheetName Excel varaqasi nomi (standart: 'Reestr')
 * @param options Qo'shimcha sozlamalar (ixtiyoriy)
 */
export async function exportToExcel(
  data: any[],
  fileName: string,
  sheetName: string = 'Reestr',
  options?: ExportExcelOptions,
): Promise<void> {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      Message.warning('Eksport qilish uchun ma’lumot topilmadi!');
      return;
    }

    // 1. Collect all unique keys from data rows in order
    const keySet = new Set<string>();
    for (const item of data) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach((k) => keySet.add(k));
      }
    }
    const keys = Array.from(keySet);

    if (keys.length === 0) {
      Message.warning('Eksport qilinadigan ustunlar topilmadi!');
      return;
    }

    // 2. Initialize ExcelJS workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'UWMS — Universitet Ombor va Inventar Tizimi';
    workbook.lastModifiedBy = 'UWMS Tizimi';
    workbook.created = new Date();
    workbook.modified = new Date();

    const safeSheetName =
      (sheetName || 'Reestr')
        .replace(/[\\/?*\[\]:]/g, ' ')
        .trim()
        .substring(0, 31) || 'Reestr';

    const worksheet = workbook.addWorksheet(safeSheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // 3. Calculate smart, non-overlapping column widths
    const customWidths = options?.columnWidths || {};
    const columns = keys.map((key) => {
      if (customWidths[key]) {
        return { header: key, key, width: customWidths[key] };
      }

      let maxLen = String(key).length;
      for (const row of data) {
        const val = row[key];
        if (val !== undefined && val !== null) {
          const strVal = String(val);
          if (strVal.length > maxLen) {
            maxLen = strVal.length;
          }
        }
      }

      const lower = key.toLowerCase();
      let minWidth = 15;

      // Smart semantic minimums to ensure text is NEVER clipped
      if (
        lower.includes('raqam') ||
        lower.includes('inv') ||
        lower.includes('kod') ||
        lower.includes('id') ||
        lower.includes('seriya') ||
        lower.includes('s/n')
      ) {
        minWidth = 20;
      } else if (
        lower.includes('nomi') ||
        lower.includes('name') ||
        lower.includes('jihoz') ||
        lower.includes('uskuna') ||
        lower.includes('mahsulot') ||
        lower.includes('izoh') ||
        lower.includes('tavsif') ||
        lower.includes('sabab')
      ) {
        minWidth = 32;
      } else if (
        lower.includes('joylashuv') ||
        lower.includes('xona') ||
        lower.includes('bino') ||
        lower.includes('kafedra') ||
        lower.includes('fakultet') ||
        lower.includes('bo‘lim') ||
        lower.includes('ombor')
      ) {
        minWidth = 32;
      } else if (
        lower.includes('shaxs') ||
        lower.includes('mas’ul') ||
        lower.includes('masul') ||
        lower.includes('xodim') ||
        lower.includes('user') ||
        lower.includes('fio')
      ) {
        minWidth = 24;
      } else if (
        lower.includes('narx') ||
        lower.includes('qiymat') ||
        lower.includes('balans') ||
        lower.includes('summa') ||
        lower.includes('mablag') ||
        lower.includes('price')
      ) {
        minWidth = 22;
      } else if (
        lower.includes('sana') ||
        lower.includes('date') ||
        lower.includes('vaqt') ||
        lower.includes('time')
      ) {
        minWidth = 18;
      } else if (lower.includes('manba') || lower.includes('funding')) {
        minWidth = 24;
      } else if (
        lower.includes('holati') ||
        lower.includes('status') ||
        lower.includes('turi') ||
        lower.includes('type')
      ) {
        minWidth = 18;
      }

      // Add generous +5 characters padding, cap at 60 characters
      const calculatedWidth = Math.min(Math.max(maxLen + 5, minWidth), 60);

      return {
        header: key,
        key,
        width: calculatedWidth,
      };
    });

    worksheet.columns = columns;

    // 4. Header Row Styling (Matching Image 2: Brand blue background, bold white text, height 28pt)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;

    const headerBgColor = options?.headerColor
      ? options.headerColor.startsWith('FF')
        ? options.headerColor
        : `FF${options.headerColor.replace('#', '')}`
      : 'FF165DFF'; // Official Arco Blue
    const headerTextColor = options?.headerTextColor
      ? options.headerTextColor.startsWith('FF')
        ? options.headerTextColor
        : `FF${options.headerTextColor.replace('#', '')}`
      : 'FFFFFFFF';

    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: headerTextColor },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerBgColor },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0E42D2' } },
        bottom: { style: 'thin', color: { argb: 'FF0E42D2' } },
        left: { style: 'thin', color: { argb: 'FF0E42D2' } },
        right: { style: 'thin', color: { argb: 'FF0E42D2' } },
      };
    });

    // 5. Data Rows Styling (Height 22pt, alternating subtle tint, crisp borders on all cells)
    const showBorders = options?.showBorders !== false;
    const zebra = options?.zebraStriping !== false;

    data.forEach((item, rIdx) => {
      const row = worksheet.addRow(item);
      row.height = 22;
      const isOdd = rIdx % 2 === 1;

      row.eachCell((cell, colNumber) => {
        const colKey = keys[colNumber - 1] || '';
        const lowerKey = colKey.toLowerCase();
        const rawVal = cell.value;

        cell.font = {
          name: 'Calibri',
          size: 10,
          color: { argb: 'FF1D2129' },
        };

        if (zebra && isOdd) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F8FA' }, // Light clean background for alternating rows
          };
        }

        if (showBorders) {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          };
        }

        // Alignments and number formats
        if (
          lowerKey.includes('narx') ||
          lowerKey.includes('qiymat') ||
          lowerKey.includes('balans') ||
          lowerKey.includes('summa') ||
          lowerKey.includes('mablag') ||
          lowerKey.includes('price')
        ) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (typeof rawVal === 'number') {
            cell.numFmt = '#,##0 "so‘m"';
          } else if (typeof rawVal === 'string' && !isNaN(Number(rawVal)) && rawVal.trim() !== '') {
            cell.value = Number(rawVal);
            cell.numFmt = '#,##0 "so‘m"';
          }
        } else if (
          lowerKey.includes('soni') ||
          lowerKey.includes('miqdor') ||
          lowerKey.includes('qoldiq') ||
          lowerKey.includes('limit') ||
          lowerKey.includes('kvota') ||
          lowerKey.includes('count') ||
          lowerKey.includes('quantity')
        ) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (typeof rawVal === 'number') {
            cell.numFmt = '#,##0';
          }
        } else if (
          lowerKey.includes('raqam') ||
          lowerKey.includes('inv') ||
          lowerKey.includes('sn') ||
          lowerKey.includes('kod') ||
          lowerKey.includes('sana') ||
          lowerKey.includes('date') ||
          lowerKey.includes('vaqt') ||
          lowerKey.includes('holati') ||
          lowerKey.includes('status') ||
          lowerKey.includes('manba') ||
          lowerKey.includes('turi')
        ) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          const strLength = String(rawVal || '').length;
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: strLength > 40,
          };
        }
      });
    });

    // 6. Excel AutoFilter (Adds filter dropdown to header row)
    if (options?.enableAutoFilter !== false && keys.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: keys.length },
      };
    }

    // 7. Write to buffer & trigger browser download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const cleanFileName = (fileName || 'Eksport').replace(/[\\/?*\[\]:]/g, '_');
    const today = new Date().toISOString().substring(0, 10);
    const finalDownloadName = `${cleanFileName}_${today}.xlsx`;

    const url = window.URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.setAttribute('download', finalDownloadName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('Excel eksportda xatolik:', err);
    Message.error('Excel faylini shakllantirishda xatolik yuz berdi!');
  }
}

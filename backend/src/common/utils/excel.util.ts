import * as ExcelJS from 'exceljs';

export interface StyledExcelWorkbookOptions {
  creator?: string;
  lastModifiedBy?: string;
}

export interface AddStyledWorksheetOptions {
  columnWidthOverrides?: Record<string, number>;
  headerBgColor?: string; // default FF165DFF (Arco Blue)
  headerTextColor?: string; // default FFFFFFFF (Bold White)
  enableZebra?: boolean; // default true
}

/**
 * Universitet UWMS yagona standartlashtirilgan backend ExcelJS utilitasi.
 * Barcha hisobotlar, reestrlar va UzASBO davlat integratsiyasi uchun
 * yagona korporativ shablon (Arco Blue sarlavha, oq qalin matn, muzlatilgan sarlavha,
 * to'liq katak chegaralari, zebra chiziqlari, avtomatik moslashuvchan kengliklar).
 */
export function createStyledWorkbook(options?: StyledExcelWorkbookOptions): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = options?.creator || 'UWMS — Universitet Ombor va Aktivlarni Boshqarish Tizimi';
  wb.lastModifiedBy = options?.lastModifiedBy || 'UWMS Tizimi';
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

export function addStyledWorksheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  dataRows: Record<string, any>[],
  options?: AddStyledWorksheetOptions,
): ExcelJS.Worksheet {
  const safeSheetName =
    (sheetName || 'Reestr')
      .replace(/[\\/?*\[\]:]/g, ' ')
      .trim()
      .substring(0, 31) || 'Reestr';

  const ws = wb.addWorksheet(safeSheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  if (!dataRows || dataRows.length === 0) {
    ws.addRow(['Ma’lumot topilmadi']);
    return ws;
  }

  // 1. Unique headers in original key order
  const keys = Object.keys(dataRows[0]);

  // 2. Dynamic column widths
  const columnWidthOverrides = options?.columnWidthOverrides || {};
  const columns = keys.map((key) => {
    if (columnWidthOverrides[key]) {
      return { header: key, key, width: columnWidthOverrides[key] };
    }

    let maxLen = String(key).length;
    for (const row of dataRows) {
      const val = row[key];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if (strVal.length > maxLen) {
          maxLen = strVal.length;
        }
      }
    }

    const lower = key.toLowerCase();
    let minWidth = 14;

    if (lower === '№' || lower === 'no' || lower === 'id') {
      minWidth = 8;
    } else if (lower.includes('sana') || lower.includes('date')) {
      minWidth = 16;
    } else if (
      lower.includes('raqam') ||
      lower.includes('kod') ||
      lower.includes('inn') ||
      lower.includes('stir') ||
      lower.includes('hisob') ||
      lower.includes('akt') ||
      lower.includes('nakladnoy')
    ) {
      minWidth = 24;
    } else if (
      lower.includes('nomi') ||
      lower.includes('tovar') ||
      lower.includes('jihoz') ||
      lower.includes('mahsulot') ||
      lower.includes('rekvizit') ||
      lower.includes('parametr') ||
      lower.includes('izoh')
    ) {
      minWidth = 36;
    } else if (
      lower.includes('kafedra') ||
      lower.includes('bo‘lim') ||
      lower.includes('ta’minotchi') ||
      lower.includes('kategoriya') ||
      lower.includes('yo‘nalish') ||
      lower.includes('manzil')
    ) {
      minWidth = 32;
    } else if (
      lower.includes('mas’ul') ||
      lower.includes('shaxs') ||
      lower.includes('bajaruvchi') ||
      lower.includes('qabul') ||
      lower.includes('mol')
    ) {
      minWidth = 26;
    } else if (
      lower.includes('qiymat') ||
      lower.includes('mablag') ||
      lower.includes('summa') ||
      lower.includes('narx') ||
      lower.includes('cost') ||
      lower.includes('price') ||
      lower.includes('zarar')
    ) {
      minWidth = 24;
    } else if (lower.includes('xesh') || lower.includes('hash') || lower.includes('kripto') || lower.includes('worm')) {
      minWidth = 36;
    } else if (lower.includes('holat') || lower.includes('manba') || lower.includes('standart')) {
      minWidth = 24;
    } else if (lower.includes('birlik') || lower.includes('unit') || lower.includes('turi') || lower.includes('type')) {
      minWidth = 16;
    } else if (lower.includes('miqdor') || lower.includes('soni') || lower.includes('count') || lower.includes('qty')) {
      minWidth = 16;
    }

    const calculatedWidth = Math.min(Math.max(maxLen + 5, minWidth), 65);
    return {
      header: key,
      key,
      width: calculatedWidth,
    };
  });

  ws.columns = columns;

  // 3. Header Row Styling (Arco Blue #165DFF, Bold White, 28pt height)
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  const headerBgColor = options?.headerBgColor || 'FF165DFF';
  const headerTextColor = options?.headerTextColor || 'FFFFFFFF';

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
      wrapText: false,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0E42D2' } },
      bottom: { style: 'medium', color: { argb: 'FF0E42D2' } },
      left: { style: 'thin', color: { argb: 'FF0E42D2' } },
      right: { style: 'thin', color: { argb: 'FF0E42D2' } },
    };
  });

  // 4. Data Rows Styling (Zebra striping, borders, numeric/currency/date alignment)
  const enableZebra = options?.enableZebra !== false;

  dataRows.forEach((item, index) => {
    const row = ws.addRow(item);
    row.height = 22;
    const isZebra = enableZebra && index % 2 === 1;

    // Check if this is a summary / total row
    const firstVal = String(item[keys[0]] || '');
    const isTotalRow = firstVal.toLowerCase() === 'jami' || firstVal.toLowerCase() === 'total';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = keys[colNumber - 1];
      const lowerKey = (key || '').toLowerCase();
      const cellVal = cell.value;

      if (isTotalRow) {
        row.height = 24;
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FF165DFF' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8F3FF' }, // Light Arco blue tint
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0E42D2' } },
          bottom: { style: 'double', color: { argb: 'FF0E42D2' } },
          left: { style: 'thin', color: { argb: 'FFE5E6EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E6EB' } },
        };
      } else {
        // Normal data row font
        cell.font = {
          name: 'Calibri',
          size: 10.5,
          color: { argb: 'FF1D2129' },
        };

        // Normal borders
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E6EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E6EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E6EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E6EB' } },
        };

        // Zebra fill
        if (isZebra) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F8FA' },
          };
        } else {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' },
          };
        }
      }

      // Alignments & Number formatting
      if (lowerKey === '№' || lowerKey === 'no') {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (lowerKey.includes('sana') || lowerKey.includes('date')) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (
        lowerKey.includes('kod') ||
        lowerKey.includes('sub-hisob') ||
        lowerKey.includes('inn') ||
        lowerKey.includes('stir') ||
        lowerKey.includes('telefon') ||
        lowerKey.includes('holat') ||
        lowerKey.includes('birlik') ||
        lowerKey.includes('turi')
      ) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (lowerKey.includes('worm') || lowerKey.includes('hash') || lowerKey.includes('muhr')) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Courier New', size: 9.5, color: { argb: 'FF4E5969' } };
      } else if (
        typeof cellVal === 'number' ||
        lowerKey.includes('qiymat') ||
        lowerKey.includes('mablag') ||
        lowerKey.includes('summa') ||
        lowerKey.includes('narx') ||
        lowerKey.includes('miqdor') ||
        lowerKey.includes('soni') ||
        lowerKey.includes('zarar')
      ) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cellVal === 'number') {
          if (lowerKey.includes('soni') || lowerKey.includes('count') || lowerKey.includes('miqdor')) {
            cell.numFmt = '#,##0';
          } else {
            cell.numFmt = '#,##0 "so‘m"';
          }
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  return ws;
}

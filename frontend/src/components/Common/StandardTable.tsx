import React, { useMemo } from 'react';
import { Card, Table, Empty } from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react/es/Table';
import type { ColumnProps } from '@arco-design/web-react/es/Table';

export interface StandardTableProps<T = any> extends Omit<TableProps<T>, 'columns' | 'data'> {
  columns: ColumnProps<T>[];
  data?: T[];
  loading?: boolean;
  emptyText?: string;
  scrollX?: number | string;
  onRowClick?: (record: T, e: React.MouseEvent) => void;
  cardStyle?: React.CSSProperties;
  /** Standart zichlik (default: 'small' - ixcham, zamonaviy va ortiqcha bo'sh joylarsiz) */
  density?: 'default' | 'small' | 'mini';
}

/**
 * Xavfsiz va aniq ustunlar muvozanati:
 * 1. Barcha ustunlarga qat'iy width berilgan jadvallarda (masalan /assets yoki /movements),
 *    haqiqiy matn/kontent ustuni (Nomi, Mahsulotlar, Tavsif, Nosozlik) aniqlanib,
 *    u elastik qilinadi (minWidth saqlanadi, width undefined bo'ladi).
 * 2. ID, Harakat turi, Moliyalashtirish, Holat, Sana kabi ixcham ustunlar o'z o'lchamida qat'iy
 *    turadi va sun'iy 2-3 barobar bo'shab ketmaydi. Bitta ustun tugashi bilan keyingisi keladi.
 * 3. 1-ustun (index 0) va Amallar ustunlarining kengligi HECH QACHON buzilmaydi.
 */
function findContentColumnIndex<T>(columns: ColumnProps<T>[]): number {
  const candidate = columns.findIndex((c, idx) => {
    if (idx === 0) return false;
    const title = String(c.title || '').toLowerCase();
    const key = String(c.dataIndex || '').toLowerCase();
    return (
      key.includes('name') ||
      key.includes('nomi') ||
      key.includes('title') ||
      key.includes('item') ||
      key.includes('mahsulot') ||
      key.includes('jihoz') ||
      key.includes('desc') ||
      key.includes('tavsif') ||
      key.includes('reason') ||
      key.includes('sabab') ||
      key.includes('nosozlik') ||
      key.includes('summary') ||
      title.includes('nomi') ||
      title.includes('mahsulot') ||
      title.includes('jihoz') ||
      title.includes('tavsif') ||
      title.includes('sabab') ||
      title.includes('nosozlik')
    );
  });

  if (candidate !== -1) return candidate;
  return columns.length > 2 ? 1 : -1;
}

function processTableColumns<T>(columns: ColumnProps<T>[]): {
  processedColumns: ColumnProps<T>[];
  calculatedScrollX: number;
} {
  if (!columns || columns.length === 0) {
    return { processedColumns: [], calculatedScrollX: 1100 };
  }

  // Jadvalda allaqachon elastik (width berilmagan) ustun bormi?
  const hasElasticColumn = columns.some((c, idx) => idx > 0 && c.width === undefined);

  // Agar BARCHA ustunlarga width berilgan bo'lsa, haqiqiy kontent ustunini elastik qilamiz
  const targetContentIndex = !hasElasticColumn ? findContentColumnIndex(columns) : -1;

  let totalWidth = 0;

  const processedColumns = columns.map((col, index) => {
    const isAction =
      col.fixed === 'right' ||
      String(col.title || '').toLowerCase().includes('amal') ||
      String(col.dataIndex || '').toLowerCase() === 'actions';

    let width = col.width;
    let minWidth = col.minWidth;
    let align = col.align;
    let fixed = col.fixed;

    if (isAction) {
      fixed = 'right';
      width = Math.max(typeof width === 'number' ? width : 160, 160);
      totalWidth += width;
    } else if (index === targetContentIndex) {
      minWidth = typeof col.width === 'number' ? col.width : 220;
      width = undefined;
      totalWidth += typeof minWidth === 'number' ? minWidth : 220;
    } else {
      totalWidth += typeof width === 'number' ? width : 160;
    }

    return {
      ...col,
      width,
      minWidth,
      align,
      fixed,
      className: `${col.className || ''} ${isAction ? 'uwms-col-actions' : ''}`.trim(),
    };
  });

  return { processedColumns, calculatedScrollX: Math.max(totalWidth, 1100) };
}


/**
 * UWMS Standart Jadval Komponenti (Universal Shablon).
 * Butun tizim bo'ylab barcha sahifalardagi jadvallar uchun yagona universal shablon:
 * - Standart Card konteyner (uwms-card, borderRadius: 0, padding: 0)
 * - Ixcham qatorlar (size="small") - ortiqcha bo'sh joylarsiz, zamonaviy ma'lumotlar zichligi
 * - Intellektual ustunlar muvozanati (bir-biriga to'qnashmaydigan, toza ustunlar)
 * - O'ng burchakka qotirilgan moslashuvchan "Amallar" ustuni
 * - Dinamik hisoblanuvchi qulay scroll (scroll.x)
 * - Standart UWMS sahifalash
 */
export function StandardTable<T = any>({
  columns,
  data = [],
  loading = false,
  emptyText = 'Ma’lumotlar topilmadi',
  scrollX,
  rowKey = 'id',
  onRowClick,
  pagination = true,
  cardStyle,
  style,
  noDataElement,
  onRow,
  density = 'small',
  size,
  ...restProps
}: StandardTableProps<T>) {
  const { processedColumns, calculatedScrollX } = useMemo(
    () => processTableColumns(columns),
    [columns]
  );

  const effectiveScrollX = scrollX !== undefined ? scrollX : calculatedScrollX;

  const defaultPagination =
    pagination === false
      ? false
      : {
          pageSize: 10,
          sizeCanChange: true,
          sizeOptions: [10, 20, 50, 100],
          showTotal: (total: number, range?: [number, number]) => {
            if (!total || total === 0) return '0/0';
            const to = range ? Math.min(range[1], total) : total;
            return `${to}/${total}`;
          },
          ...(typeof pagination === 'object' ? pagination : {}),
        };

  return (
    <Card className="uwms-card" style={{ borderRadius: 0, ...cardStyle }} bodyStyle={{ padding: 0 }}>
      <Table<T>
        rowKey={rowKey}
        size={size || density}
        loading={typeof loading === 'boolean' ? (loading ? { dot: true, size: 20 } : false) : loading}
        columns={processedColumns}
        data={data}
        scroll={{ x: effectiveScrollX }}
        pagination={defaultPagination}
        style={{ borderRadius: 0, ...style }}
        onRow={(record, index) => {
          const userOnRow = onRow ? onRow(record, index) : {};
          return {
            ...userOnRow,
            onClick: (e) => {
              userOnRow?.onClick?.(e);
              if (onRowClick) {
                onRowClick(record, e);
              }
            },
            style: {
              cursor: onRowClick ? 'pointer' : undefined,
              ...userOnRow?.style,
            },
          };
        }}
        noDataElement={
          noDataElement || (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Empty description={emptyText} />
            </div>
          )
        }
        {...restProps}
      />
    </Card>
  );
}

export default StandardTable;


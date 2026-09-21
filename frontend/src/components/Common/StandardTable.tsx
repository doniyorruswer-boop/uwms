import React from 'react';
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
}

/**
 * UWMS Standart Jadval Komponenti (Universal Shablon).
 * Butun tizim bo'ylab barcha sahifalardagi jadvallar uchun yagona universal shablon:
 * - Standart Card konteyner (uwms-card, borderRadius: 0, padding: 0)
 * - Standart ekranga moslashuvchan scroll (default: x=1200)
 * - Standart UWMS sahifalash (10, 20, 50, 100 va to/total formati)
 * - Standart qatordan bosish (onRowClick + cursor: pointer)
 * - Standart bo'sh holat (Empty state)
 */
export function StandardTable<T = any>({
  columns,
  data = [],
  loading = false,
  emptyText = 'Ma’lumotlar topilmadi',
  scrollX = 1300,
  rowKey = 'id',
  onRowClick,
  pagination = true,
  cardStyle,
  style,
  noDataElement,
  onRow,
  ...restProps
}: StandardTableProps<T>) {
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
        loading={typeof loading === 'boolean' ? (loading ? { dot: true, size: 20 } : false) : loading}
        columns={columns}
        data={data}
        scroll={{ x: scrollX }}
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

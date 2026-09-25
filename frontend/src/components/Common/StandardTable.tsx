import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Empty,
  Button,
  Tooltip,
  Dropdown,
  Menu,
  Popover,
  Checkbox,
  Tag,
  Space,
} from '@arco-design/web-react';
import {
  IconFullscreen,
  IconFullscreenExit,
  IconSettings,
  IconLineHeight,
  IconUndo,
  IconCheck,
  IconMenu,
} from '@arco-design/web-react/icon';
import type { TableProps, ColumnProps } from '@arco-design/web-react/es/Table';
import { getStatusMeta, type StatusDomain } from '../../constants/status.constants';

export interface StandardTableProps<T = any> extends Omit<TableProps<T>, 'columns' | 'data'> {
  columns: ColumnProps<T>[];
  data?: T[];
  loading?: boolean;
  emptyText?: string;
  scrollX?: number | string;
  onRowClick?: (record: T, e: React.MouseEvent) => void;
  cardStyle?: React.CSSProperties;
  /** Standart zichlik (default: 'small' - ixcham, zamonaviy va ortiqcha bo'sh joylarsiz) */
  density?: 'default' | 'middle' | 'small' | 'mini';
  /** Zebra (yo'l-yo'l qatorlar) rejimi (default: true) */
  stripe?: boolean;
  /** Holat ranglari uchun domen (default: 'auto') */
  statusDomain?: StatusDomain;

  /** Jadval yuqorisidagi ixtiyoriy sarlavha */
  title?: React.ReactNode;
  /** Toolbar chap qismiga qo'shimcha elementlar (tugmalar, filtrlar) */
  extra?: React.ReactNode;
  /** Asboblar panelini ko'rsatish/yashirish (default: true) */
  showToolbar?: boolean;
  /** 1. Zebra yo'l-yo'l qatorlar tugmasi (default: true) */
  showStripeToggle?: boolean;
  /** 2. Jadval zichligini o'zgartirish tugmasi (default: true) */
  showDensityToggle?: boolean;
  /** 3. Ustunlarni yashirish/ko'rsatish sozlamasi (default: true) */
  showColumnSelector?: boolean;
  /** 4. Butun ekranga yoyish (fullscreen) tugmasi (default: true) */
  showFullscreen?: boolean;
  /** Qayta yuklash funksiyasi (ixtiyoriy) */
  onRefresh?: () => void | Promise<void>;
  /** Qayta yuklash tugmasini ko'rsatish (default: false) */
  showRefresh?: boolean;
  /** Jami yozuvlar sonini ko'rsatish (agar berilsa tag ko'rinishida chiqadi) */
  totalCount?: number;
}

/**
 * Ustun uchun unikal va barqaror kalit hosil qilish
 */
function getColumnKey<T>(col: ColumnProps<T>, index: number): string {
  if (col.key !== undefined && col.key !== null && String(col.key).trim()) return String(col.key);
  if (col.dataIndex !== undefined && col.dataIndex !== null && String(col.dataIndex).trim()) return String(col.dataIndex);
  if (typeof col.title === 'string' && col.title.trim()) return col.title.trim();
  return `col_idx_${index}`;
}

/**
 * Ustunning sarlavhasini olish (sozlama ro'yxati uchun)
 */
function getColumnTitle<T>(col: ColumnProps<T>, index: number): string {
  if (typeof col.title === 'string' && col.title.trim()) return col.title.trim();
  if (col.dataIndex) return String(col.dataIndex);
  return `Ustun #${index + 1}`;
}

/**
 * Xavfsiz va aniq ustunlar muvozanati:
 * Kontent ustunini aniqlab, unga elastik minWidth berish
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

/**
 * Ustunlarni qayta ishlash va dinamik kenglikni hisoblash
 */
function processTableColumns<T>(
  columns: ColumnProps<T>[],
  hiddenKeys: string[]
): {
  processedColumns: ColumnProps<T>[];
  calculatedScrollX: number;
} {
  if (!columns || columns.length === 0) {
    return { processedColumns: [], calculatedScrollX: 1000 };
  }

  // Yashirilgan ustunlarni filtrlash
  const visibleColumns = columns.filter((col, index) => {
    const key = getColumnKey(col, index);
    return !hiddenKeys.includes(key);
  });

  const hasElasticColumn = visibleColumns.some((c, idx) => idx > 0 && c.width === undefined);
  const targetContentIndex = !hasElasticColumn ? findContentColumnIndex(visibleColumns) : -1;

  let totalWidth = 0;

  const processedColumns = visibleColumns.map((col, index) => {
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
      width = typeof width === 'number' ? width : 130;
      totalWidth += width;
    } else if (index === targetContentIndex) {
      minWidth = typeof col.width === 'number' ? col.width : 200;
      width = undefined;
      totalWidth += typeof minWidth === 'number' ? minWidth : 200;
    } else {
      totalWidth += typeof width === 'number' ? width : 140;
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

  return { processedColumns, calculatedScrollX: totalWidth };
}

/**
 * UWMS Standart Jadval Komponenti (Arco Pro Enterprise Shablon).
 * Butun tizim bo'ylab barcha sahifalardagi jadvallar uchun yagona universal,
 * moslashuvchan va professional Enterprise Data Grid shabloni:
 * - 8px yumshoq zamonaviy burchaklar (Arco Pro Standard)
 * - Zebra yo'l-yo'l qatorlar (ko'z toliqmasligi uchun)
 * - Yumshoq soft-fonli sarlavha va status indikatorlari
 * - 4 ta professional asbob: Zebra qator, Zichlik, Ustunlarni sozlash, To'liq ekran
 * - Moslashuvchan aqlli scroll (ortiqcha sun'iy gorizontal scrolls)
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
  stripe = true,
  title,
  extra,
  showToolbar = true,
  showRefresh = false,
  showStripeToggle = true,
  showDensityToggle = true,
  showColumnSelector = true,
  showFullscreen = true,
  statusDomain = 'auto',
  onRefresh,
  totalCount,
  ...restProps
}: StandardTableProps<T>) {
  // Foydalanuvchi boshqara oladigan parametrlar
  const [tableDensity, setTableDensity] = useState<'default' | 'middle' | 'small' | 'mini'>(
    size || density || 'small'
  );
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [isStriped, setIsStriped] = useState<boolean>(stripe);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isColSettingOpen, setIsColSettingOpen] = useState<boolean>(false);

  // Ustunlarni qayta ishlash
  const { processedColumns, calculatedScrollX } = useMemo(
    () => processTableColumns(columns, hiddenKeys),
    [columns, hiddenKeys]
  );

  // Moslashuvchan scroll.x hisobi: agar sig'sa sun'iy gorizontal scroll ochilmaydi
  const effectiveScrollX = useMemo(() => {
    if (scrollX !== undefined) return scrollX;
    if (calculatedScrollX > 880) return calculatedScrollX;
    return '100%';
  }, [scrollX, calculatedScrollX]);

  // Barcha ustunlarni tiklash
  const resetColumns = useCallback(() => {
    setHiddenKeys([]);
  }, []);

  // To'liq ekran rejimi (Fullscreen)
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Esc bosilganda fullscreendan chiqish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);



  // Zichlik (Density) menyusi
  const densityMenu = (
    <Menu
      selectedKeys={[tableDensity]}
      onClickMenuItem={(key) => setTableDensity(key as any)}
      style={{ minWidth: 130, borderRadius: 6 }}
    >
      <Menu.Item key="default">
        <Space>
          {tableDensity === 'default' ? (
            <IconCheck style={{ color: 'var(--color-primary-6)' }} />
          ) : (
            <span style={{ width: 14, display: 'inline-block' }} />
          )}
          <span>Keng (Default)</span>
        </Space>
      </Menu.Item>
      <Menu.Item key="small">
        <Space>
          {tableDensity === 'small' ? (
            <IconCheck style={{ color: 'var(--color-primary-6)' }} />
          ) : (
            <span style={{ width: 14, display: 'inline-block' }} />
          )}
          <span>Ixcham (Small)</span>
        </Space>
      </Menu.Item>
      <Menu.Item key="mini">
        <Space>
          {tableDensity === 'mini' ? (
            <IconCheck style={{ color: 'var(--color-primary-6)' }} />
          ) : (
            <span style={{ width: 14, display: 'inline-block' }} />
          )}
          <span>Juda ixcham (Mini)</span>
        </Space>
      </Menu.Item>
    </Menu>
  );

  // Ustunlar sozlamasi Popover kontenti
  const columnSettingsContent = (
    <div
      style={{ width: 240, padding: '4px 0' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2px 8px 8px 8px',
          borderBottom: '1px solid var(--color-border-2)',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>
          Ustunlar ({columns.length - hiddenKeys.length} / {columns.length})
        </span>
        <Space size="mini">
          <Button
            type="text"
            size="mini"
            onClick={() => setHiddenKeys([])}
            disabled={hiddenKeys.length === 0}
            style={{ padding: '0 4px', height: 22, fontSize: 11 }}
          >
            Barchasi
          </Button>
          <Button
            type="text"
            size="mini"
            icon={<IconUndo />}
            onClick={resetColumns}
            disabled={hiddenKeys.length === 0}
            style={{ padding: '0 4px', height: 22, fontSize: 11 }}
          >
            Tiklash
          </Button>
        </Space>
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '0 4px' }}>
        {columns.map((col, index) => {
          const key = getColumnKey(col, index);
          const colTitle = getColumnTitle(col, index);
          const isVisible = !hiddenKeys.includes(key);
          return (
            <div
              key={key}
              style={{
                padding: '4px 6px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                userSelect: 'none',
              }}
            >
              <Checkbox
                checked={isVisible}
                onChange={(checked) => {
                  setHiddenKeys((prev) => {
                    if (checked) {
                      return prev.filter((k) => k !== key);
                    } else {
                      return [...prev, key];
                    }
                  });
                }}
                style={{ width: '100%', fontSize: 12 }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    color: isVisible ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  }}
                >
                  {colTitle}
                </span>
              </Checkbox>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Sahifalash konfiguratsiyasi
  const defaultPagination =
    pagination === false
      ? false
      : {
          pageSize: 10,
          sizeCanChange: true,
          sizeOptions: [10, 20, 50, 100],
          showTotal: (total: number, range?: [number, number]) => {
            if (!total || total === 0) return '0 ta';
            const to = range ? Math.min(range[1], total) : total;
            return `${range ? `${range[0]}-${to}` : to} / ${total} ta`;
          },
          ...(typeof pagination === 'object' ? pagination : {}),
        };

  const displayTotal = totalCount !== undefined ? totalCount : data?.length;

  return (
    <div className={`uwms-standard-table-wrapper ${isFullscreen ? 'uwms-table-fullscreen' : ''}`}>
      <Card
        className={`uwms-standard-table-card ${isStriped ? 'uwms-standard-table-striped' : ''}`}
        style={cardStyle}
        bodyStyle={{ padding: 0 }}
      >
        {/* Yuqori Asboblar Paneli (Toolbar) */}
        {showToolbar && (
          <div className="uwms-table-toolbar">
            <div className="uwms-table-toolbar-left">
              {title && <div className="uwms-table-title">{title}</div>}
              {displayTotal !== undefined && (
                <Tag color="arcoblue" bordered={false} className="uwms-table-count-tag">
                  Jami: <b>{displayTotal}</b> ta
                </Tag>
              )}
              {extra}
            </div>

            <div className="uwms-table-toolbar-right">
              {/* 1. Zebra yo'l-yo'l qatorlar */}
              {showStripeToggle && (
                <Tooltip content={isStriped ? 'Zebra qatorlar: Yoqilgan' : 'Zebra qatorlar: O‘chirilgan'}>
                  <Button
                    type={isStriped ? 'secondary' : 'text'}
                    size="small"
                    icon={<IconMenu />}
                    onClick={() => setIsStriped(!isStriped)}
                    className="uwms-table-tool-btn"
                  />
                </Tooltip>
              )}

              {/* 3. Jadval zichligi */}
              {showDensityToggle && (
                <Tooltip content="Jadval zichligi">
                  <Dropdown droplist={densityMenu} trigger="click" position="br">
                    <Button
                      type="text"
                      size="small"
                      icon={<IconLineHeight />}
                      className="uwms-table-tool-btn"
                    />
                  </Dropdown>
                </Tooltip>
              )}

              {/* 4. Ustunlarni sozlash */}
              {showColumnSelector && (
                <Popover
                  content={columnSettingsContent}
                  trigger="click"
                  position="br"
                  popupVisible={isColSettingOpen}
                  onVisibleChange={setIsColSettingOpen}
                >
                  <Tooltip content="Ustunlarni sozlash">
                    <Button
                      type="text"
                      size="small"
                      icon={<IconSettings />}
                      className="uwms-table-tool-btn"
                    />
                  </Tooltip>
                </Popover>
              )}

              {/* 5. To'liq ekran */}
              {showFullscreen && (
                <Tooltip content={isFullscreen ? 'Kichraytirish (Esc)' : 'To‘liq ekran'}>
                  <Button
                    type="text"
                    size="small"
                    icon={isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
                    onClick={toggleFullscreen}
                    className="uwms-table-tool-btn"
                  />
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* Asosiy Arco Jadval */}
        <Table<T>
          className="uwms-standard-table"
          rowKey={rowKey}
          size={tableDensity}
          loading={typeof loading === 'boolean' ? (loading ? { dot: true, size: 20 } : false) : loading}
          columns={processedColumns}
          data={data}
          scroll={{ x: effectiveScrollX }}
          pagination={defaultPagination}
          style={style}
          onRow={(record, index) => {
            const userOnRow = onRow ? onRow(record, index) : {};
            const rawStatus = (record as any)?.status;
            const statusMeta = rawStatus ? getStatusMeta(rawStatus, statusDomain) : null;
            return {
              ...userOnRow,
              'data-status': rawStatus,
              'data-status-type': statusMeta?.badgeStatus,
              'data-status-color': statusMeta?.color,
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
    </div>
  );
}

export default StandardTable;

import React from 'react';
import { Button, Space, Tooltip, Popconfirm } from '@arco-design/web-react';
import { IconDelete } from '@arco-design/web-react/icon';

export interface TableActionItem {
  key?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  type?: 'primary' | 'secondary' | 'outline' | 'text' | 'dashed';
  status?: 'default' | 'success' | 'warning' | 'danger';
  tooltip?: string;
  onClick?: (e: any) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  hide?: boolean;
}

export interface TableActionsProps {
  /** Bolalar tugmalari (JSX orqali beriladigan tugmalar) */
  children?: React.ReactNode;
  /** Ro'yxat orqali beriladigan amallar (ixtiyoriy) */
  actions?: TableActionItem[];
  /** O'chirish funksiyasi (berilsa, /backups sahifasidagi standart qizil kvadrat tugma bilan Popconfirm chiqadi) */
  onDelete?: (e?: any) => void;
  /** O'chirish popconfirm sarlavhasi */
  deleteConfirmTitle?: string;
  /** O'chirish tasdiqlash matni */
  deleteOkText?: string;
  /** O'chirish bekor qilish matni */
  deleteCancelText?: string;
  /** O'chirish tooltip matni */
  deleteTooltip?: string;
  /** O'chirish tugmasi ko'rinishi yoki yo'qligi */
  showDelete?: boolean;
  /** O'ng tomondan beriladigan bo'shliq (default: 16px) */
  rightPadding?: number;
  /** Tugmalar orasidagi oraliq (default: 6px) */
  gap?: number;
  /** Tekislanish yo'nalishi (default: 'flex-start') */
  align?: 'flex-start' | 'center' | 'flex-end';
  /** Satr bosilganda hodisani to'xtatish (default: true) */
  stopPropagation?: boolean;
  /** Qo'shimcha inline stillar */
  style?: React.CSSProperties;
}

/**
 * UWMS Standart Jadval Amallari Komponenti (TableActions)
 * Butun tizimdagi barcha jadvallar uchun o'ng tomondagi 16px chekka bo'shliqni,
 * tugmalar bir xilligini va qizil kvadrat fonli standart Delete tugmasini kafolatlaydi.
 */
export const TableActions: React.FC<TableActionsProps> = ({
  children,
  actions,
  onDelete,
  deleteConfirmTitle = 'O‘chirishni tasdiqlaysizmi?',
  deleteOkText = 'Ha, o‘chirilsin',
  deleteCancelText = 'Bekor qilish',
  deleteTooltip = 'O‘chirish',
  showDelete = true,
  rightPadding = 16,
  gap = 6,
  align = 'flex-start',
  stopPropagation = true,
  style,
}) => {
  return (
    <div
      onClick={(e) => {
        if (stopPropagation) {
          e.stopPropagation();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : align === 'flex-end' ? 'flex-end' : 'flex-start',
        paddingRight: rightPadding,
        ...style,
      }}
    >
      <Space size={gap}>
        {/* 1. Declarative actions if provided */}
        {actions
          ?.filter((a) => !a.hide)
          .map((a, idx) => {
            const btn = (
              <Button
                key={a.key || idx}
                size="small"
                type={a.type || 'secondary'}
                status={a.status}
                icon={a.icon}
                disabled={a.disabled}
                onClick={a.onClick}
                style={{ borderRadius: 0, ...a.style }}
              >
                {a.label}
              </Button>
            );

            if (a.tooltip) {
              return (
                <Tooltip key={a.key || idx} content={a.tooltip}>
                  {btn}
                </Tooltip>
              );
            }
            return btn;
          })}

        {/* 2. JSX Children buttons */}
        {children}

        {/* 3. Standardized Backups-style Delete Button */}
        {onDelete && showDelete && (
          <Popconfirm
            title={deleteConfirmTitle}
            onOk={onDelete}
            okText={deleteOkText}
            cancelText={deleteCancelText}
          >
            <Tooltip content={deleteTooltip}>
              <Button
                size="small"
                status="danger"
                icon={<IconDelete />}
                style={{ borderRadius: 0 }}
              />
            </Tooltip>
          </Popconfirm>
        )}
      </Space>
    </div>
  );
};

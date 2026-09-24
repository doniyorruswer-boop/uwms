import React from 'react';
import { Button, Space, Tooltip, Popconfirm, Dropdown, Menu } from '@arco-design/web-react';
import { IconDelete, IconMore } from '@arco-design/web-react/icon';

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
  /** O'chirish funksiyasi (berilsa, standart qizil kvadrat tugma bilan Popconfirm chiqadi) */
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
  /** O'ng tomondan beriladigan bo'shliq (default: 4px) */
  rightPadding?: number;
  /** Tugmalar orasidagi oraliq (default: 6px) */
  gap?: number;
  /** Tekislanish yo'nalishi (default: 'flex-start') */
  align?: 'flex-start' | 'center' | 'flex-end';
  /** Satr bosilganda hodisani to'xtatish (default: true) */
  stopPropagation?: boolean;
  /** Qo'shimcha inline stillar */
  style?: React.CSSProperties;
  /** Maksimal ko'rsatiladigan to'liq tugmalar soni (qolgani More menyuga o'tadi, default: 2) */
  maxVisible?: number;
}

/**
 * Bolalar elementlarini tekis ro'yxatga aylantirish (Fragmentlar ichidagi tugmalarni ham hisobga oladi)
 */
const flattenChildren = (children: React.ReactNode): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      result.push(...flattenChildren((child.props as any).children));
    } else if (child !== null && child !== undefined && child !== false) {
      result.push(child);
    }
  });
  return result;
};

interface ParsedAction {
  key?: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  onClick?: (e: any) => void;
  disabled?: boolean;
  isDanger?: boolean;
  popconfirmProps?: {
    title?: string;
    onOk?: (e?: any) => void;
    okText?: string;
    cancelText?: string;
  };
}

/**
 * Dropdown menyu uchun elementdan ikonka, sarlavha va hodisalarni intellektual ajratib olish
 */
function parseActionElement(element: React.ReactNode, fallbackIndex: number): ParsedAction | null {
  if (!React.isValidElement(element)) {
    return null;
  }

  const el = element as React.ReactElement<any>;
  const key = el.key ? String(el.key) : `parsed-act-${fallbackIndex}`;

  // 1. Popconfirm orqali o'ralgan element (masalan, O'chirish)
  if (el.props && (el.props.onOk || el.props.title)) {
    const child = el.props.children;
    const childParsed = parseActionElement(child, fallbackIndex);
    return {
      key,
      icon: childParsed?.icon || <IconDelete style={{ color: '#F53F3F' }} />,
      label: childParsed?.label || el.props.title || 'O‘chirish',
      disabled: childParsed?.disabled,
      isDanger: true,
      popconfirmProps: {
        title: el.props.title,
        onOk: el.props.onOk,
        okText: el.props.okText || 'Ha',
        cancelText: el.props.cancelText || 'Bekor qilish',
      },
    };
  }

  // 2. Tooltip orqali o'ralgan element
  if (el.props && el.props.content && el.props.children) {
    const tooltipText = el.props.content;
    const child = el.props.children;
    const childParsed = parseActionElement(child, fallbackIndex);
    const resolvedLabel =
      tooltipText ||
      (childParsed?.label && typeof childParsed.label === 'string' && childParsed.label.trim().length > 0
        ? childParsed.label
        : 'Amal');

    return {
      key,
      icon: childParsed?.icon,
      label: resolvedLabel,
      onClick: childParsed?.onClick,
      disabled: childParsed?.disabled,
      isDanger: childParsed?.isDanger,
    };
  }

  // 3. To'g'ridan-to'g'ri Button yoki boshqa komponent
  if (el.props) {
    const buttonText = el.props.children;
    const icon = el.props.icon;
    const onClick = el.props.onClick;
    const disabled = el.props.disabled;
    const isDanger = el.props.status === 'danger';
    const label =
      typeof buttonText === 'string' && buttonText.trim().length > 0
        ? buttonText
        : buttonText || 'Amal';

    return {
      key,
      icon,
      label,
      onClick,
      disabled,
      isDanger,
    };
  }

  return {
    key,
    label: 'Amal',
  };
}

/**
 * UWMS Standart Jadval Amallari Komponenti (TableActions).
 * 1. 1-2 ta asosiy amalni qatorda to'liq ko'rsatadi;
 * 2. Qolgan barcha amallarni chiroyli, to'liq matnli Dropdown (...) menyusiga yig'adi;
 * 3. Amallar ustuni hech qachon chapdagi ustunlar ustiga chiqib ketmaydi (Zero Collision).
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
  rightPadding = 4,
  gap = 6,
  align = 'flex-start',
  stopPropagation = true,
  style,
  maxVisible = 2,
}) => {
  // 1. Declarative actions ro'yxati
  const declarativeElements = (actions?.filter((a) => !a.hide) || []).map((a, idx) => {
    const btn = (
      <Button
        key={a.key || `act-${idx}`}
        size="small"
        type={a.type || 'secondary'}
        status={a.status}
        icon={a.icon}
        disabled={a.disabled}
        onClick={(e) => {
          if (stopPropagation) e?.stopPropagation?.();
          a.onClick?.(e);
        }}
        style={{ borderRadius: 0, fontWeight: 500, ...a.style }}
      >
        {a.label}
      </Button>
    );

    if (a.tooltip) {
      return (
        <Tooltip key={a.key || `act-${idx}`} content={a.tooltip}>
          {btn}
        </Tooltip>
      );
    }
    return btn;
  });

  // 2. JSX orqali kelgan tugmalar
  const childElements = flattenChildren(children);

  // 3. Standart o'chirish tugmasi
  const deleteElement =
    onDelete && showDelete ? (
      <Popconfirm
        key="delete-action"
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
            onClick={(e) => {
              if (stopPropagation) e?.stopPropagation?.();
            }}
          />
        </Tooltip>
      </Popconfirm>
    ) : null;

  // Barcha amallarning umumiy to'plami
  const allElements = [...declarativeElements, ...childElements, ...(deleteElement ? [deleteElement] : [])];

  const totalCount = allElements.length;
  // Agar amallar soni maxVisible dan oshsa, qolgani dropdown menyuga o'tadi
  const isOverflow = totalCount > maxVisible;
  const visibleItems = isOverflow ? allElements.slice(0, maxVisible) : allElements;
  const overflowItems = isOverflow ? allElements.slice(maxVisible) : [];

  const renderMenuItem = (item: React.ReactNode, idx: number) => {
    const parsed = parseActionElement(item, idx);
    if (!parsed) {
      return (
        <Menu.Item key={`more-${idx}`} style={{ padding: '6px 12px' }}>
          {item}
        </Menu.Item>
      );
    }

    const content = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          fontSize: 13,
          fontWeight: 450,
          color: parsed.disabled ? 'var(--color-text-4)' : parsed.isDanger ? '#F53F3F' : 'var(--color-text-1)',
        }}
      >
        {parsed.icon && (
          <span style={{ display: 'inline-flex', fontSize: 14, flexShrink: 0 }}>
            {parsed.icon}
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {parsed.label}
        </span>
      </div>
    );

    if (parsed.popconfirmProps && !parsed.disabled) {
      return (
        <Popconfirm
          key={parsed.key || `pop-${idx}`}
          title={parsed.popconfirmProps.title || 'Tasdiqlaysizmi?'}
          onOk={parsed.popconfirmProps.onOk}
          okText={parsed.popconfirmProps.okText}
          cancelText={parsed.popconfirmProps.cancelText}
        >
          <Menu.Item
            key={parsed.key || `more-${idx}`}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
            onClick={(e) => {
              if (stopPropagation) e?.stopPropagation?.();
            }}
          >
            {content}
          </Menu.Item>
        </Popconfirm>
      );
    }

    return (
      <Menu.Item
        key={parsed.key || `more-${idx}`}
        disabled={parsed.disabled}
        onClick={(e) => {
          if (stopPropagation) e?.stopPropagation?.();
          if (!parsed.disabled && parsed.onClick) {
            parsed.onClick(e);
          }
        }}
        style={{
          padding: '8px 12px',
          cursor: parsed.disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {content}
      </Menu.Item>
    );
  };

  const dropdownMenu =
    overflowItems.length > 0 ? (
      <Menu
        style={{
          minWidth: 190,
          maxWidth: 290,
          borderRadius: 0,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
          padding: '4px 0',
        }}
      >
        {overflowItems.map((item, idx) => renderMenuItem(item, idx))}
      </Menu>
    ) : null;

  return (
    <div
      onClick={(e) => {
        if (stopPropagation) {
          e.stopPropagation();
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : align === 'flex-end' ? 'flex-end' : 'flex-start',
        paddingRight: rightPadding,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <Space size={gap} style={{ flexWrap: 'nowrap' }}>
        {visibleItems}

        {dropdownMenu && (
          <Dropdown droplist={dropdownMenu} position="br">
            <Button
              size="small"
              type="secondary"
              icon={<IconMore />}
              style={{
                borderRadius: 0,
                width: 28,
                height: 28,
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={(e) => {
                if (stopPropagation) e.stopPropagation();
              }}
            />
          </Dropdown>
        )}
      </Space>
    </div>
  );
};

export default TableActions;


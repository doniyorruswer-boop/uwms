import React from 'react';
import { Tag, Badge, Tooltip } from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconClockCircle,
  IconCloseCircle,
  IconExclamationCircle,
  IconSync,
  IconFile,
  IconLock,
  IconTool,
  IconArchive,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import {
  getStatusMeta,
  type StatusDomain,
  type StatusMeta,
} from '../../constants/status.constants';

export interface StatusTagProps {
  status: string | undefined | null;
  domain?: StatusDomain;
  mode?: 'tag' | 'badge' | 'text';
  size?: 'small' | 'medium' | 'large' | 'default';
  showIcon?: boolean;
  tooltip?: boolean | string;
  style?: React.CSSProperties;
  className?: string;
  label?: string;
  customLabel?: string;
}

const renderStatusIcon = (iconName?: StatusMeta['iconName']) => {
  switch (iconName) {
    case 'check':
      return <IconCheckCircle />;
    case 'clock':
      return <IconClockCircle />;
    case 'close':
      return <IconCloseCircle />;
    case 'exclamation':
      return <IconExclamationCircle />;
    case 'sync':
      return <IconSync />;
    case 'file':
      return <IconFile />;
    case 'lock':
      return <IconLock />;
    case 'tool':
      return <IconTool />;
    case 'box':
      return <IconArchive />;
    default:
      return null;
  }
};

/**
 * UWMS Standart Status va Holat Komponenti (Universal Shablon).
 * Butun tizim bo‘ylab barcha sahifalardagi status va teglar uchun yagona rasmiy komponent:
 * - Rasmiy Arco Design ranglari va teglari (borderRadius: 0);
 * - Markazlashtirilgan o‘zbekcha nomlar va tushuntirishlar;
 * - Tag, Badge yoki toza Text rejimlari.
 */
export const StatusTag: React.FC<StatusTagProps> = ({
  status,
  domain = 'auto',
  mode = 'tag',
  size = 'small',
  showIcon = true,
  tooltip,
  style,
  className,
  label,
  customLabel,
}) => {
  const meta = getStatusMeta(status, domain);
  const displayLabel = label || customLabel || meta.label;

  const tooltipContent =
    typeof tooltip === 'string'
      ? tooltip
      : tooltip === true || tooltip === undefined
      ? meta.description
      : undefined;

  // 1. BADGE MODE (Arco Badge dot with text)
  if (mode === 'badge') {
    const badgeElement = (
      <Badge
        status={meta.badgeStatus}
        text={displayLabel}
        style={style}
        className={className}
      />
    );

    if (tooltipContent) {
      return <Tooltip content={tooltipContent}>{badgeElement}</Tooltip>;
    }
    return badgeElement;
  }

  // 2. TEXT MODE (Clean colored text)
  if (mode === 'text') {
    const textElement = (
      <span
        style={{
          color:
            meta.color === 'green'
              ? '#00B42A'
              : meta.color === 'red'
              ? '#F53F3F'
              : meta.color === 'orange' || meta.color === 'gold'
              ? '#FF7D00'
              : meta.color === 'arcoblue' || meta.color === 'blue'
              ? '#165DFF'
              : meta.color === 'purple'
              ? '#722ED1'
              : meta.color === 'cyan'
              ? '#0FC6C2'
              : 'var(--color-text-2)',
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          ...style,
        }}
        className={className}
      >
        {showIcon && renderStatusIcon(meta.iconName)}
        <span>{displayLabel}</span>
      </span>
    );

    if (tooltipContent) {
      return <Tooltip content={tooltipContent}>{textElement}</Tooltip>;
    }
    return textElement;
  }

  // 3. TAG MODE (Standard Arco Tag, default)
  const tagSize = size === 'default' ? 'medium' : size;
  const tagElement = (
    <Tag
      color={meta.color === 'default' ? undefined : meta.color}
      size={tagSize}
      icon={showIcon ? renderStatusIcon(meta.iconName) : undefined}
      style={{
        borderRadius: 0,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...style,
      }}
      className={className}
    >
      {displayLabel}
    </Tag>
  );

  if (tooltipContent) {
    return <Tooltip content={tooltipContent}>{tagElement}</Tooltip>;
  }

  return tagElement;
};

export default StatusTag;

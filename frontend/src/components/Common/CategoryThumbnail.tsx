import React from 'react';
import { Tag } from '@arco-design/web-react';

export interface CategoryThumbnailProps {
  icon: React.ReactNode;
  name: string;
  subtitle?: string;
  tag?: string;
  color?: string;
  bg?: string;
}

/**
 * Standard reusable category thumbnail item for tables.
 * Eliminates ad-hoc div markup across pages.
 */
export const CategoryThumbnail: React.FC<CategoryThumbnailProps> = ({
  icon,
  name,
  subtitle,
  tag,
  color = '#165DFF',
  bg = '#E8F3FF',
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 38,
          height: 38,
          backgroundColor: bg,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
          borderRadius: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)', wordBreak: 'break-word' }}>{name}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--color-text-3)', wordBreak: 'break-word' }}>{subtitle}</div>
        )}
        {tag && (
          <Tag size="small" style={{ marginTop: 3, borderRadius: 0, fontSize: 11, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tag}
          </Tag>
        )}
      </div>
    </div>
  );
};

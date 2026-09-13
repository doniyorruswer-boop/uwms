import React from 'react';
import { IconStorage } from '@arco-design/web-react/icon';

interface AppLogoProps {
  size?: number;
  iconSize?: number;
  showText?: boolean;
  textTitle?: string;
  subtitle?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 36,
  iconSize,
  showText = false,
  textTitle = 'UWMS Tizimi',
  subtitle,
  style,
  className,
}) => {
  const calculatedIconSize = iconSize || Math.round(size * 0.52);

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: showText ? '12px' : 0,
        userSelect: 'none',
        ...style,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 0,
          backgroundColor: '#165DFF',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(22, 93, 255, 0.25)',
          flexShrink: 0,
        }}
      >
        <IconStorage style={{ fontSize: calculatedIconSize }} />
      </div>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: size > 40 ? '20px' : '16px',
              lineHeight: '22px',
              letterSpacing: '-0.3px',
              color: 'var(--text-main, #1d2129)',
            }}
          >
            {textTitle}
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted, #86909c)',
                whiteSpace: 'nowrap',
                marginTop: '2px',
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

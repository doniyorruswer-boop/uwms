import React from 'react';
import { IconRight } from '@arco-design/web-react/icon';

export interface StatHeroCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal';
  bgColor?: string;
  footerBgColor?: string;
  linkText?: string;
  onClick?: () => void;
}

const COLOR_MAP: Record<string, { bg: string; footer: string }> = {
  blue: { bg: '#165DFF', footer: '#0E42D2' },
  green: { bg: '#00B42A', footer: '#009A22' },
  orange: { bg: '#FF7D00', footer: '#D25F00' },
  purple: { bg: '#722ED1', footer: '#531DAB' },
  red: { bg: '#F53F3F', footer: '#CB272D' },
  teal: { bg: '#009A87', footer: '#007A6C' },
};

/**
 * Standard enterprise StatHeroCard component based on Snipe-IT / Arco Design.
 * Replaces ad-hoc custom markup with a strictly reusable corporate component.
 */
export const StatHeroCard: React.FC<StatHeroCardProps> = ({
  title,
  value,
  subtext,
  icon,
  color = 'blue',
  bgColor,
  footerBgColor,
  linkText,
  onClick,
}) => {
  const finalBg = bgColor || COLOR_MAP[color]?.bg || '#165DFF';
  const finalFooterBg = footerBgColor || COLOR_MAP[color]?.footer || '#0E42D2';

  return (
    <div
      style={{
        backgroundColor: finalBg,
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        minHeight: 120,
        borderRadius: 0,
      }}
    >
      <div style={{ padding: '16px 20px 12px 20px', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }}>
          {value}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, opacity: 0.95 }}>
          {title}
        </div>
        {subtext && (
          <div style={{ fontSize: 11, opacity: 0.82, marginTop: 2 }}>
            {subtext}
          </div>
        )}
      </div>

      {/* Watermark Background Icon */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          top: 6,
          fontSize: 64,
          color: 'rgba(255, 255, 255, 0.18)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {icon}
      </div>

      {/* Bottom Action Footer */}
      {linkText && (
        <div
          onClick={onClick}
          style={{
            backgroundColor: finalFooterBg,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: onClick ? 'pointer' : 'default',
            zIndex: 2,
            transition: 'background-color 0.2s',
          }}
        >
          <span>{linkText}</span>
          <IconRight style={{ fontSize: 12 }} />
        </div>
      )}
    </div>
  );
};

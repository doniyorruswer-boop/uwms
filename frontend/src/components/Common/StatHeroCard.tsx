import React from 'react';
import { IconRight } from '@arco-design/web-react/icon';

export type StatHeroChartType = 'wave' | 'bar' | 'decay-wave' | 'donut';

export interface StatHeroCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  chartType?: StatHeroChartType;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal';
  bgColor?: string;
  footerBgColor?: string;
  linkText?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
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
 * 1. White Wave Sparkline Chart (Dashed Sine Wave)
 */
const HeroWaveChart: React.FC = () => (
  <svg
    viewBox="0 0 95 44"
    style={{ width: '100%', maxWidth: 95, height: 42, overflow: 'visible' }}
  >
    <path
      d="M 2,24 C 8,6 14,38 21,16 C 29,4 34,36 42,18 C 50,6 55,34 63,16 C 71,4 76,38 84,20 C 90,8 94,30 98,18"
      fill="none"
      stroke="rgba(255, 255, 255, 0.92)"
      strokeWidth="2.2"
      strokeDasharray="4 3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 2. White Bar Sparkline Chart (Vertical Bars)
 */
const HeroBarChart: React.FC = () => {
  const bars = [32, 16, 12, 36, 20, 28, 14, 24];

  return (
    <svg
      viewBox="0 0 90 44"
      style={{ width: '100%', maxWidth: 90, height: 42, overflow: 'visible' }}
    >
      {bars.map((h, idx) => (
        <rect
          key={idx}
          x={3 + idx * 11}
          y={42 - h}
          width={4.5}
          height={h}
          rx={2}
          fill={idx % 2 === 0 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.52)'}
        />
      ))}
    </svg>
  );
};

/**
 * 3. White Decaying Wave Chart
 */
const HeroDecayingWaveChart: React.FC = () => (
  <svg
    viewBox="0 0 95 44"
    style={{ width: '100%', maxWidth: 95, height: 42, overflow: 'visible' }}
  >
    <path
      d="M 2,18 C 9,6 15,30 22,14 C 30,4 36,26 44,16 C 52,10 58,24 66,18 C 74,16 80,26 88,24 C 92,22 96,32 98,36"
      fill="none"
      stroke="rgba(255, 255, 255, 0.92)"
      strokeWidth="2.2"
      strokeDasharray="4 3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 4. White Donut Ring Chart with mini legend
 */
const HeroDonutChart: React.FC = () => {
  const r = 13;
  const c = 2 * Math.PI * r; // ≈ 81.68
  const seg1 = c * 0.45;
  const seg2 = c * 0.33;
  const seg3 = c * 0.18;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
      <svg width={36} height={36} viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth={4.5} />
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke="rgba(255, 255, 255, 0.95)"
          strokeWidth={4.5}
          strokeDasharray={`${seg1} ${c - seg1}`}
          strokeDashoffset={0}
        />
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke="rgba(255, 255, 255, 0.65)"
          strokeWidth={4.5}
          strokeDasharray={`${seg2} ${c - seg2}`}
          strokeDashoffset={-(seg1 + 2)}
        />
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke="rgba(255, 255, 255, 0.38)"
          strokeWidth={4.5}
          strokeDasharray={`${seg3} ${c - seg3}`}
          strokeDashoffset={-(seg1 + seg2 + 4)}
        />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 9.5, color: 'rgba(255, 255, 255, 0.9)' }}>
        <span style={{ whiteSpace: 'nowrap' }}>● Band</span>
        <span style={{ whiteSpace: 'nowrap', opacity: 0.75 }}>● Ombor</span>
        <span style={{ whiteSpace: 'nowrap', opacity: 0.55 }}>● Ta’mir</span>
      </div>
    </div>
  );
};

/**
 * Standard enterprise StatHeroCard component based on Snipe-IT / Arco Design.
 * Supports both traditional watermark icons and modern mini sparklines (wave, bar, decaying wave, donut).
 */
export const StatHeroCard: React.FC<StatHeroCardProps> = ({
  title,
  value,
  subtext,
  icon,
  chartType,
  color = 'blue',
  bgColor,
  footerBgColor,
  linkText,
  onClick,
  style,
}) => {
  const finalBg = bgColor || COLOR_MAP[color]?.bg || '#165DFF';
  const finalFooterBg = footerBgColor || COLOR_MAP[color]?.footer || '#0E42D2';

  const renderChart = () => {
    switch (chartType) {
      case 'wave':
        return <HeroWaveChart />;
      case 'bar':
        return <HeroBarChart />;
      case 'decay-wave':
        return <HeroDecayingWaveChart />;
      case 'donut':
        return <HeroDonutChart />;
      default:
        return null;
    }
  };

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
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        ...style,
      }}
    >
      {/* Top Body: Metrics & Chart */}
      <div
        style={{
          padding: '14px 16px 10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 2,
          minHeight: 84,
        }}
      >
        {/* Left Information */}
        <div style={{ minWidth: 0, flex: 1, paddingRight: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }}>
            {value}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginTop: 4,
              opacity: 0.95,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={typeof title === 'string' ? title : undefined}
          >
            {title}
          </div>
          {subtext && (
            <div
              style={{
                fontSize: 11,
                opacity: 0.82,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtext}
            </div>
          )}
        </div>

        {/* Right Side: Sparkline Chart OR Watermark Icon */}
        {chartType ? (
          <div
            style={{
              width: chartType === 'donut' ? 98 : 90,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {renderChart()}
          </div>
        ) : icon ? (
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
        ) : null}
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

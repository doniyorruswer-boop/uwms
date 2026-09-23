import React from 'react';
import { Typography } from '@arco-design/web-react';
import { IconArrowRise, IconArrowFall } from '@arco-design/web-react/icon';

export type AnalysisChartType = 'wave' | 'bar' | 'decay-wave' | 'donut';

export interface DonutLegendItem {
  label: string;
  value?: number | string;
  color: string;
}

export interface AnalysisStatCardProps {
  title: string;
  value: string | number;
  trendLabel?: string;
  trendValue?: string | number;
  trendDirection?: 'up' | 'down';
  trendColor?: string;
  theme?: 'blue' | 'green' | 'cyan' | 'purple';
  chartType: AnalysisChartType;
  donutLegend?: DonutLegendItem[];
  onClick?: () => void;
  style?: React.CSSProperties;
}

const THEME_STYLES: Record<
  string,
  {
    bg: string;
    border: string;
    darkBg: string;
    darkBorder: string;
    accent: string;
  }
> = {
  blue: {
    bg: 'linear-gradient(180deg, #F2F9FE 0%, #E6F4FE 100%)',
    border: '#D6E4FF',
    darkBg: 'rgba(22, 93, 255, 0.10)',
    darkBorder: 'rgba(22, 93, 255, 0.25)',
    accent: '#165DFF',
  },
  green: {
    bg: 'linear-gradient(180deg, #F6FDF9 0%, #E8F8F0 100%)',
    border: '#C9F0D9',
    darkBg: 'rgba(0, 180, 42, 0.10)',
    darkBorder: 'rgba(0, 180, 42, 0.25)',
    accent: '#00B42A',
  },
  cyan: {
    bg: 'linear-gradient(180deg, #F4F9FF 0%, #EBF4FE 100%)',
    border: '#D2E4FC',
    darkBg: 'rgba(22, 93, 255, 0.08)',
    darkBorder: 'rgba(22, 93, 255, 0.22)',
    accent: '#165DFF',
  },
  purple: {
    bg: 'linear-gradient(180deg, #F9F8FE 0%, #F1EEFD 100%)',
    border: '#E3D9FC',
    darkBg: 'rgba(114, 46, 209, 0.10)',
    darkBorder: 'rgba(114, 46, 209, 0.25)',
    accent: '#722ED1',
  },
};

/**
 * 1. Wave Sparkline Chart (Dashed Sine Wave from Arco Design Pro)
 */
const WaveChart: React.FC<{ color?: string }> = ({ color = '#165DFF' }) => (
  <svg
    viewBox="0 0 110 50"
    style={{ width: '100%', maxWidth: 110, height: 46, overflow: 'visible' }}
  >
    <path
      d="M 2,28 C 9,10 14,44 22,20 C 30,5 35,42 43,22 C 51,8 56,40 64,20 C 72,6 77,44 85,24 C 93,12 98,38 106,20"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeDasharray="4 3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 2. Bar Sparkline Chart (Vertical Green Bars with Varying Heights)
 */
const BarChart: React.FC<{ primaryColor?: string; secondaryColor?: string }> = ({
  primaryColor = '#00B42A',
  secondaryColor = '#52C41A',
}) => {
  const bars = [
    { height: 36, color: primaryColor },
    { height: 20, color: secondaryColor },
    { height: 16, color: primaryColor },
    { height: 38, color: primaryColor },
    { height: 24, color: secondaryColor },
    { height: 32, color: secondaryColor },
    { height: 18, color: primaryColor },
    { height: 28, color: primaryColor },
  ];

  return (
    <svg
      viewBox="0 0 110 50"
      style={{ width: '100%', maxWidth: 110, height: 46, overflow: 'visible' }}
    >
      {bars.map((bar, idx) => {
        const x = 6 + idx * 13;
        const y = 46 - bar.height;
        return (
          <rect
            key={idx}
            x={x}
            y={y}
            width={5}
            height={bar.height}
            rx={2}
            fill={bar.color}
          />
        );
      })}
    </svg>
  );
};

/**
 * 3. Decaying Wave Chart (Wave decaying towards right)
 */
const DecayingWaveChart: React.FC<{ color?: string }> = ({ color = '#165DFF' }) => (
  <svg
    viewBox="0 0 110 50"
    style={{ width: '100%', maxWidth: 110, height: 46, overflow: 'visible' }}
  >
    <path
      d="M 2,24 C 10,12 16,36 24,18 C 32,8 38,34 46,20 C 54,14 60,32 68,24 C 76,20 82,34 90,30 C 96,28 102,40 108,44"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeDasharray="4 3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 4. Donut Ring Chart with 3-item Legend
 */
const DonutChartWithLegend: React.FC<{
  legend?: DonutLegendItem[];
}> = ({
  legend = [
    { label: 'Band', color: '#722ED1' },
    { label: 'Ombor', color: '#165DFF' },
    { label: 'Ta’mir', color: '#00B42A' },
  ],
}) => {
  const r = 16;
  const c = 2 * Math.PI * r; // ≈ 100.53

  // 3 segments: 44%, 34%, 18%
  const seg1 = c * 0.44; // purple
  const seg2 = c * 0.34; // blue
  const seg3 = c * 0.18; // cyan/green

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
      <svg width={44} height={44} viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        {/* Background track */}
        <circle cx={22} cy={22} r={r} fill="none" stroke="rgba(0, 0, 0, 0.04)" strokeWidth={6} />

        {/* Segment 1: Purple */}
        <circle
          cx={22}
          cy={22}
          r={r}
          fill="none"
          stroke={legend[0]?.color || '#722ED1'}
          strokeWidth={6}
          strokeDasharray={`${seg1} ${c - seg1}`}
          strokeDashoffset={0}
        />

        {/* Segment 2: Blue */}
        <circle
          cx={22}
          cy={22}
          r={r}
          fill="none"
          stroke={legend[1]?.color || '#165DFF'}
          strokeWidth={6}
          strokeDasharray={`${seg2} ${c - seg2}`}
          strokeDashoffset={-(seg1 + 2)}
        />

        {/* Segment 3: Cyan/Green */}
        <circle
          cx={22}
          cy={22}
          r={r}
          fill="none"
          stroke={legend[2]?.color || '#00B42A'}
          strokeWidth={6}
          strokeDasharray={`${seg3} ${c - seg3}`}
          strokeDashoffset={-(seg1 + seg2 + 4)}
        />
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 54 }}>
        {legend.slice(0, 3).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-2)' }}>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: item.color,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 50,
                lineHeight: 1.2,
              }}
              title={item.label}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Standard Arco Design Pro Analysis Metric Card Component.
 * Implements the official ByteDance Arco Design Pro analytical dashboard card standard.
 */
export const AnalysisStatCard: React.FC<AnalysisStatCardProps> = ({
  title,
  value,
  trendLabel = 'O‘tgan davrga:',
  trendValue,
  trendDirection = 'up',
  trendColor,
  theme = 'blue',
  chartType,
  donutLegend,
  onClick,
  style,
}) => {
  const currentTheme = THEME_STYLES[theme] || THEME_STYLES.blue;

  const renderChart = () => {
    switch (chartType) {
      case 'wave':
        return <WaveChart color={currentTheme.accent} />;
      case 'bar':
        return <BarChart primaryColor={currentTheme.accent} secondaryColor="#52C41A" />;
      case 'decay-wave':
        return <DecayingWaveChart color={currentTheme.accent} />;
      case 'donut':
        return <DonutChartWithLegend legend={donutLegend} />;
      default:
        return <WaveChart color={currentTheme.accent} />;
    }
  };

  const finalTrendColor =
    trendColor || (trendDirection === 'up' ? '#F53F3F' : '#00B42A');

  return (
    <div
      onClick={onClick}
      className="uwms-analysis-card"
      data-theme={theme}
      style={{
        background: currentTheme.bg,
        border: `1px solid ${currentTheme.border}`,
        borderRadius: 4,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 118,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        ...style,
      }}
    >
      {/* Left Info Column */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 2, minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-text-2, #4E5969)',
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={title}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -0.5,
            color: 'var(--color-text-1, #1D2129)',
            marginBottom: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>

        {trendValue !== undefined && trendValue !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--color-text-3, #86909C)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{trendLabel}</span>
            <span style={{ color: finalTrendColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {trendValue}
              {trendDirection === 'up' ? (
                <IconArrowRise style={{ fontSize: 11 }} />
              ) : (
                <IconArrowFall style={{ fontSize: 11 }} />
              )}
            </span>
          </div>
        )}
      </div>

      {/* Right Sparkline / Donut Chart Column */}
      <div
        style={{
          width: chartType === 'donut' ? 115 : 105,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          zIndex: 1,
          marginLeft: 8,
        }}
      >
        {renderChart()}
      </div>
    </div>
  );
};

import React from 'react';
import { Progress } from '@arco-design/web-react';

export interface StockLevelGaugeProps {
  /** Mavjud miqdor (agar berilsa, zaxira/kvota rejimida hisoblanadi) */
  quantity?: number;
  /** Minimal limit yoki oylik reja chegarasi */
  minLimit?: number;
  /** O'lchov birligi (DONA, PACHKA, TOPLAM va h.k.) */
  unit?: string;

  /** To'g'ridan-to'g'ri foiz qiymati (0-100) */
  percent?: number;
  /** Chap tarafdagi sarlavha / ko'rsatkich (Custom node yoki matn) */
  label?: React.ReactNode;
  /** O'ng tarafdagi kichik ko'rsatkich (Min limit, umumiy miqdor yoki foiz) */
  subLabel?: React.ReactNode;

  /** Holat rangi yoki holat statusi */
  status?: 'LOW' | 'NORMAL' | 'EXCESS' | 'success' | 'warning' | 'error' | 'normal' | string;
  /** Aniq belgilangan rang (HEX yoki RGB) */
  color?: string;

  /** Shkala kengligi */
  width?: number | string;
  /** Shkala qalinligi (px) */
  strokeWidth?: number;
  /** Shkala turi: gorizontal chiziq yoki aylanma mini indikator */
  type?: 'line' | 'circle';
  /** O'lchami */
  size?: 'mini' | 'small' | 'default' | 'large';
  /** Min limit yozuvini avtomatik ko'rsatish */
  showMinLimit?: boolean;
  /** Shkala bo'ylab maksimal proporsiya ko'paytiruvchisi */
  maxScaleMultiplier?: number;
  /** Foiz matnini progress ichida/yonida ko'rsatish */
  showText?: boolean;
  /** Maxsus foiz formati */
  formatText?: (percent: number) => React.ReactNode;
  /** Qo'shimcha inline stillar */
  style?: React.CSSProperties;
}

/**
 * UWMS Standart Qoldiq, Kvota va Progress Shkalasi Komponenti (Stock & Progress Level Gauge)
 * Ombor, Kvotalar, Spisanie va Boshqaruv paneli jadvallarida yagona dizayn tizimini ta'minlaydi.
 */
export const StockLevelGauge: React.FC<StockLevelGaugeProps> = ({
  quantity,
  minLimit,
  unit = '',
  percent: propPercent,
  label,
  subLabel,
  width,
  strokeWidth = 6,
  status,
  color: propColor,
  maxScaleMultiplier = 1,
  type = 'line',
  size = 'small',
  showMinLimit = true,
  showText = false,
  formatText,
  style,
}) => {
  // 1. Foizni aniqlash
  let computedPercent = 0;
  if (propPercent !== undefined) {
    computedPercent = Math.min(100, Math.max(0, Math.round(propPercent)));
  } else if (quantity !== undefined && minLimit !== undefined) {
    const denominator = Math.max(1, minLimit * maxScaleMultiplier);
    computedPercent = Math.min(100, Math.round((quantity / denominator) * 100));
  }

  // 2. Status va rangni aniqlash
  const isLow =
    status === 'LOW' ||
    status === 'error' ||
    (quantity !== undefined && minLimit !== undefined && quantity <= minLimit);

  let determinedColor = propColor;
  let determinedStatus: 'success' | 'warning' | 'error' | 'normal' = 'normal';

  if (determinedColor) {
    determinedStatus = 'normal';
  } else if (isLow) {
    determinedColor = '#F53F3F';
    determinedStatus = 'error';
  } else if (status === 'warning' || status === 'EXCESS' || (status === undefined && computedPercent < 50)) {
    determinedColor = '#FF7D00';
    determinedStatus = 'warning';
  } else if (status === 'success' || computedPercent >= 50) {
    determinedColor = '#00B42A';
    determinedStatus = 'success';
  }

  // 3. Sarlavhalarni aniqlash
  const headerLeft =
    label !== undefined ? (
      label
    ) : quantity !== undefined ? (
      <span
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: isLow ? '#F53F3F' : 'var(--color-text-1)',
        }}
      >
        {quantity} {unit}
      </span>
    ) : null;

  const headerRight =
    subLabel !== undefined ? (
      subLabel
    ) : showMinLimit && minLimit !== undefined ? (
      <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
        Min: {minLimit}
      </span>
    ) : null;

  const hasHeader = headerLeft !== null || headerRight !== null;

  // Aylanma mini-progress (Circle rejimi)
  if (type === 'circle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: width || 'auto', ...style }}>
        {hasHeader && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {headerLeft}
            {headerRight}
          </div>
        )}
        <Progress
          type="circle"
          size={size === 'default' || size === 'large' ? 'small' : 'mini'}
          width={24}
          percent={computedPercent}
          status={determinedStatus}
          color={determinedColor}
          showText={showText}
          formatText={formatText}
        />
      </div>
    );
  }

  // Chiziqli progress (Line rejimi)
  return (
    <div style={{ width: width || '100%', ...style }}>
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          {headerLeft}
          {headerRight}
        </div>
      )}
      <Progress
        percent={computedPercent}
        strokeWidth={strokeWidth}
        showText={showText}
        formatText={formatText}
        status={determinedStatus}
        color={determinedColor}
        style={{ width: '100%' }}
      />
    </div>
  );
};

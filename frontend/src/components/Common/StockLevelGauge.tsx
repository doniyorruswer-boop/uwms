import React from 'react';
import { Progress } from '@arco-design/web-react';

export interface StockLevelGaugeProps {
  quantity: number;
  minLimit: number;
  unit: string;
  width?: number | string;
  strokeWidth?: number;
  status?: 'LOW' | 'NORMAL' | 'EXCESS' | string;
  maxScaleMultiplier?: number;
  type?: 'line' | 'circle';
  showMinLimit?: boolean;
}

/**
 * UWMS Standart Qoldiq va Zaxira Shkalasi Komponenti (Stock Level Gauge)
 * Ombor (line) va Boshqaruv paneli (circle) jadvallarida yagona dizayn tizimini ta'minlaydi.
 */
export const StockLevelGauge: React.FC<StockLevelGaugeProps> = ({
  quantity,
  minLimit,
  unit,
  width,
  strokeWidth = 6,
  status,
  maxScaleMultiplier = 1,
  type = 'line',
  showMinLimit = true,
}) => {
  const isLow = status === 'LOW' || quantity <= minLimit;
  const denominator = Math.max(1, minLimit * maxScaleMultiplier);
  const percent = Math.min(100, Math.round((quantity / denominator) * 100));

  if (type === 'circle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: width || 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: isLow ? '#F53F3F' : 'var(--color-text-1)',
            }}
          >
            {quantity} {unit}
          </span>
          {showMinLimit && (
            <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
              min: {minLimit}
            </span>
          )}
        </div>
        <Progress
          type="circle"
          size="mini"
          width={22}
          percent={percent}
          status={isLow ? 'error' : percent < 50 ? 'warning' : 'success'}
          color={isLow ? '#F53F3F' : percent < 50 ? '#FF7D00' : '#00B42A'}
        />
      </div>
    );
  }

  return (
    <div style={{ width: width || '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 13,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            color: isLow ? '#F53F3F' : 'var(--color-text-1)',
          }}
        >
          {quantity} {unit}
        </span>
        {showMinLimit && (
          <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
            Min: {minLimit}
          </span>
        )}
      </div>
      <Progress
        percent={percent}
        strokeWidth={strokeWidth}
        showText={false}
        status={isLow ? 'error' : percent < 50 ? 'warning' : 'success'}
        color={isLow ? '#F53F3F' : percent < 50 ? '#FF7D00' : '#00B42A'}
        style={{ width: '100%' }}
      />
    </div>
  );
};

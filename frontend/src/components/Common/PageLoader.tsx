import React from 'react';
import { Spin } from '@arco-design/web-react';

export interface PageLoaderProps {
  /**
   * Agar true bo'lsa, butun ekranni (100vh) egallaydi.
   * False bo'lsa, layout ichida (60vh) markazlashtiriladi.
   * @default false
   */
  fullScreen?: boolean;
  /**
   * Nuqtalar o'lchami (px)
   * @default 20
   */
  size?: number;
  /**
   * Spinner ostidagi izoh matni
   */
  tip?: string;
  /**
   * Qo'shimcha stillar
   */
  style?: React.CSSProperties;
  /**
   * Qo'shimcha CSS klass nomi
   */
  className?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  fullScreen = false,
  size = 20,
  tip,
  style,
  className,
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: fullScreen ? '100vh' : '60vh',
        width: '100%',
        ...style,
      }}
    >
      <Spin dot size={size} tip={tip} />
    </div>
  );
};

export default PageLoader;

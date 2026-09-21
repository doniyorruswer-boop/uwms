import React, { useState, useEffect } from 'react';
import { Result, Button, Space, Card, Typography } from '@arco-design/web-react';
import { IconDesktop, IconArrowLeft, IconClockCircle, IconEye } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

interface DesktopOnlyGuardProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export const DesktopOnlyGuard: React.FC<DesktopOnlyGuardProps> = ({ children, pageTitle }) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile && !forceShow) {
    return (
      <div style={{ padding: '16px 12px 70px 12px', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card
          style={{
            maxWidth: 480,
            width: '100%',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            textAlign: 'center',
          }}
        >
          <Result
            status="info"
            icon={<IconDesktop style={{ fontSize: 48, color: 'var(--color-primary-6, #165DFF)' }} />}
            title={pageTitle ? `${pageTitle} — Kompyuter Talab Qilinadi` : 'Kompyuter Orqali Kirish Tavsiya Etiladi'}
            subTitle="Ushbu modul ko‘p ustunli keng jadvallar, Excel eksporti va batafsil buxgalteriya hisobotlarini o‘z ichiga oladi. Ma’lumotlar to‘liq ko‘rinishi uchun kompyuter (desktop) orqali kirishingiz maqsadga muvofiq."
            extra={
              <Space direction="vertical" size="medium" style={{ width: '100%', marginTop: 12 }}>
                <Button
                  type="primary"
                  long
                  size="large"
                  icon={<IconClockCircle />}
                  onClick={() => navigate('/inbox')}
                  style={{ borderRadius: 6, height: 44 }}
                >
                  Vazifalarimga O‘tish
                </Button>
                <Button
                  long
                  size="large"
                  icon={<IconArrowLeft />}
                  onClick={() => navigate('/dashboard')}
                  style={{ borderRadius: 6, height: 44 }}
                >
                  Bosh Sahifaga Qaytish
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<IconEye />}
                  onClick={() => setForceShow(true)}
                  style={{ marginTop: 6, color: 'var(--color-text-3)' }}
                >
                  Mobil ekranda baribir ko‘rish (jadval)
                </Button>
              </Space>
            }
          />
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

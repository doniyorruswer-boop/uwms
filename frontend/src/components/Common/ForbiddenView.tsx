import React from 'react';
import { Result, Button, Typography, Space } from '@arco-design/web-react';
import { IconHome, IconLock } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

export interface ForbiddenViewProps {
  title?: string;
  subTitle?: string;
  onBack?: () => void;
  requiredRoles?: string[];
}

export const ForbiddenView: React.FC<ForbiddenViewProps> = ({
  title,
  subTitle,
  onBack,
  requiredRoles,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const handleBack = onBack || (() => navigate('/dashboard'));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '65vh',
        padding: '40px 16px',
        width: '100%',
      }}
    >
      <Result
        status="403"
        icon={<IconLock style={{ fontSize: 64, color: '#f53f3f' }} />}
        title={title || t('errors.forbiddenTitle', '403 — Ruxsat yo‘q')}
        subTitle={
          subTitle ||
          t(
            'errors.forbiddenDesc',
            'Ushbu sahifaga kirish uchun sizda yetarli ruxsat mavjud emas.',
          )
        }
        extra={
          <Space direction="vertical" align="center" size="medium">
            {user?.role && (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {t('common.user', 'Foydalanuvchi')}: <strong>{user.fullName || user.email}</strong> ({user.role})
              </Typography.Text>
            )}
            {requiredRoles && requiredRoles.length > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Talab etiladigan rol(lar): <strong>{requiredRoles.join(', ')}</strong>
              </Typography.Text>
            )}
            <Button
              type="primary"
              size="large"
              icon={<IconHome />}
              onClick={handleBack}
              style={{ marginTop: 8 }}
            >
              {t('errors.backToHome', 'Bosh sahifaga qaytish')}
            </Button>
          </Space>
        }
      />
    </div>
  );
};

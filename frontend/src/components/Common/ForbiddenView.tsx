import React from 'react';
import { Result, Button, Typography, Space, Tag } from '@arco-design/web-react';
import { IconHome, IconLock } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { formatRoleName } from '../../constants/roles.constants';

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
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const handleBack = onBack || (() => navigate('/dashboard'));
  const roleLabel = formatRoleName(user?.role);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '32px 16px',
        width: '100%',
      }}
    >
      <Result
        status="403"
        icon={<IconLock style={{ fontSize: 56, color: '#f53f3f' }} />}
        title={title || t('errors.forbiddenTitle', '403 — Ruxsat yo‘q')}
        subTitle={
          subTitle ||
          t(
            'errors.forbiddenDesc',
            'Ushbu sahifaga kirish uchun sizda yetarli ruxsat mavjud emas.',
          )
        }
        extra={
          <Space direction="vertical" align="center" size="small">
            {user && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {t('common.user', 'Foydalanuvchi')}: <strong>{user.fullName || user.username}</strong>
                </Typography.Text>
                {roleLabel && (
                  <Tag color="arcoblue" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>
                    {roleLabel}
                  </Tag>
                )}
              </div>
            )}
            <Button
              type="primary"
              size="large"
              icon={<IconHome />}
              onClick={handleBack}
              style={{ marginTop: 4, borderRadius: 0 }}
            >
              {t('errors.backToHome', 'Bosh sahifaga qaytish')}
            </Button>
          </Space>
        }
      />
    </div>
  );
};

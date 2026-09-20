import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Space, Message, Tag, Divider, Alert } from '@arco-design/web-react';
import { IconUser, IconLock } from '@arco-design/web-react/icon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { AppLogo } from '../../components/Common/AppLogo';
import { API_ENDPOINTS, APP_CONFIG } from '../../constants';

const FormItem = Form.Item;
const { Text } = Typography;

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true' || searchParams.get('reason') === 'expired';

  const { isAuthenticated, token, login } = useAuthStore();

  // Agar foydalanuvchi allaqachon avtorizatsiyadan o'tgan bo'lsa, /dashboard ga avtomatik yo'naltirish
  useEffect(() => {
    if (isAuthenticated && token) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, token, navigate]);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);
      const res = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        username: values.username,
        password: values.pass,
      });

      const { access_token, refresh_token, user } = res.data;
      login(access_token, user, refresh_token);
      Message.success(`Xush kelibsiz, ${user.fullName}!`);
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect') || '/dashboard';
      navigate(redirectUrl, { replace: true });
    } catch (err: any) {
      if (err.response?.data?.message) {
        Message.error(err.response.data.message);
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        Message.error('Server bilan bog‘lanishda xatolik yuz berdi (Backend server faol emas)!');
      } else if (!err.fields) {
        Message.error('Login yoki parol noto‘g‘ri!');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (username: string) => {
    form.setFieldsValue({ username, pass: 'admin123' });
  };

  return (
    <div
      className="login-container-no-radius"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-color)',
        padding: '24px',
      }}
    >
      <Card
        bordered
        style={{
          width: 440,
          borderRadius: 0,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--card-bg)',
        }}
      >
        {/* Brand Logo & Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, paddingTop: 8 }}>
          <AppLogo size={52} showText textTitle={`${APP_CONFIG.name} Tizimi`} subtitle={APP_CONFIG.fullName} />
        </div>

        {/* Sessiya tugaganligi haqida ogohlantirish */}
        {isExpired && (
          <Alert
            type="warning"
            showIcon
            title="Sessiya muddati tugadi"
            content="Xavfsizlik nuqtai nazaridan avvalgi sessiyangiz yakunlangan. Tizimdan foydalanishni davom ettirish uchun qayta kiring."
            style={{ marginBottom: 20, borderRadius: 0 }}
          />
        )}

        <Form form={form} layout="vertical" onSubmit={handleSubmit}>
          <FormItem
            label="Foydalanuvchi nomi (Login)"
            field="username"
            rules={[{ required: true, message: 'Loginingizni kiriting!' }]}
          >
            <Input
              prefix={<IconUser />}
              placeholder="Masalan: omborchi, admin"
              size="large"
              style={{ borderRadius: 0 }}
              onPressEnter={handleSubmit}
            />
          </FormItem>

          <FormItem
            label="Parol"
            field="pass"
            rules={[{ required: true, message: 'Parolingizni kiriting!' }]}
          >
            <Input.Password
              prefix={<IconLock />}
              placeholder="Parol"
              size="large"
              style={{ borderRadius: 0 }}
              onPressEnter={handleSubmit}
            />
          </FormItem>

          <FormItem style={{ marginTop: 12, marginBottom: 0 }}>
            <Button
              type="primary"
              long
              size="large"
              loading={loading}
              onClick={handleSubmit}
              style={{
                borderRadius: 0,
                height: 44,
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Tizimga Kirish
            </Button>
          </FormItem>
        </Form>

        {/* Sinov hisoblari: Faqat ishlab chiquvchi rejimida (Rule 3.1) */}
        {import.meta.env.DEV && (
          <>
            <Divider style={{ margin: '20px 0 16px', borderColor: 'var(--border-color)' }} />

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-color)',
                border: '1px solid var(--border-color)',
                borderRadius: 0,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
                Sinov hisoblari (Ishlab chiquvchi test rejimi):
              </div>
              <Space wrap size={6}>
                <Tag
                  color="cyan"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('prorektor_moliya')}
                >
                  Moliya Prorektori
                </Tag>
                <Tag
                  color="red"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('rektor')}
                >
                  Rektor
                </Tag>
                <Tag
                  color="purple"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('bosh_hisobchi')}
                >
                  Bosh Hisobchi
                </Tag>
                <Tag
                  color="orange"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('komendant')}
                >
                  Bino Komendanti
                </Tag>
                <Tag
                  color="arcoblue"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('omborchi')}
                >
                  Bosh Omborchi
                </Tag>
                <Tag
                  color="green"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('kafedra_mudiri')}
                >
                  Kafedra Mudiri
                </Tag>
                <Tag
                  color="gold"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('auditor')}
                >
                  Auditor
                </Tag>
                <Tag
                  color="magenta"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('oqituvchi1')}
                >
                  Xodim (O‘qituvchi)
                </Tag>
                <Tag
                  color="blue"
                  style={{ cursor: 'pointer', borderRadius: 0 }}
                  onClick={() => fillCredentials('admin')}
                >
                  Super Admin
                </Tag>
              </Space>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                Sinov paroli: <Text code style={{ borderRadius: 0 }}>admin123</Text>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default LoginPage;

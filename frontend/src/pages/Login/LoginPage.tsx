import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Space, Message, Tag, Divider } from '@arco-design/web-react';
import { IconUser, IconLock, IconStorage, IconSafe } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { AppLogo } from '../../components/Common/AppLogo';
import { API_ENDPOINTS, APP_CONFIG } from '../../constants';

const FormItem = Form.Item;
const { Title, Paragraph, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);
      const res = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        username: values.username,
        password: values.pass,
      });

      const { access_token, user } = res.data;
      login(access_token, user);
      Message.success(`Xush kelibsiz, ${user.fullName}!`);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err.response?.data?.message) {
        Message.error(err.response.data.message);
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
      <style>{`
        .login-container-no-radius * {
          border-radius: 0 !important;
        }
        .login-container-no-radius .arco-input-inner-wrapper,
        .login-container-no-radius .arco-input,
        .login-container-no-radius .arco-btn,
        .login-container-no-radius .arco-card,
        .login-container-no-radius .arco-tag {
          border-radius: 0 !important;
        }
      `}</style>

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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28, paddingTop: 8 }}>
          <AppLogo size={52} showText textTitle={`${APP_CONFIG.name} Tizimi`} subtitle={APP_CONFIG.fullName} />
        </div>

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
                backgroundColor: '#165DFF',
                borderColor: '#165DFF',
              }}
            >
              Tizimga Kirish
            </Button>
          </FormItem>
        </Form>

        <Divider style={{ margin: '20px 0 16px', borderColor: 'var(--border-color)' }} />

        {/* Sinov hisoblari */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 0,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
            Sinov hisoblari (bosing):
          </div>
          <Space wrap size={6}>
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
              color="red"
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
      </Card>
    </div>
  );
};

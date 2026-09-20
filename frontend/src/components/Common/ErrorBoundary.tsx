import { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Typography, Space } from '@arco-design/web-react';
import { IconRefresh, IconHome } from '@arco-design/web-react/icon';
import i18n from '../../locales/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('UWMS Application ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const title = i18n.t('errors.somethingWentWrong', 'Xatolik yuz berdi');
      const subTitle =
        this.state.error?.message ||
        i18n.t(
          'errors.unexpectedErrorDesc',
          'Tizimda kutilmagan xatolik yuz berdi. Iltimos, sahifani yangilang yoki administratorga murojaat qiling.',
        );
      const reloadText = i18n.t('errors.reloadPage', 'Sahifani yangilash');
      const homeText = i18n.t('errors.backToHome', 'Bosh sahifaga qaytish');

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            padding: '40px 16px',
            width: '100%',
          }}
        >
          <Result
            status="error"
            title={title}
            subTitle={subTitle}
            extra={
              <Space direction="vertical" align="center" size="medium">
                {this.state.error?.stack && (
                  <Typography.Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2, expandable: true }}
                    style={{
                      maxWidth: 600,
                      background: 'var(--color-fill-2, #f2f3f5)',
                      padding: 12,
                      fontSize: 12,
                      textAlign: 'left',
                      fontFamily: 'monospace',
                    }}
                  >
                    {this.state.error.stack}
                  </Typography.Paragraph>
                )}
                <Space size="medium">
                  <Button
                    type="primary"
                    size="large"
                    icon={<IconRefresh />}
                    onClick={this.handleReload}
                  >
                    {reloadText}
                  </Button>
                  <Button
                    size="large"
                    icon={<IconHome />}
                    onClick={this.handleGoHome}
                  >
                    {homeText}
                  </Button>
                </Space>
              </Space>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

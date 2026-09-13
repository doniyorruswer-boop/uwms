import React, { useState } from 'react';
import {
  Badge,
  Button,
  Dropdown,
  Tabs,
  List,
  Typography,
  Space,
  Empty,
  Tag,
} from '@arco-design/web-react';
import {
  IconNotification,
  IconCheck,
  IconFile,
  IconSwap,
  IconTool,
  IconDelete,
  IconExclamationCircle,
  IconInfoCircle,
  IconCheckCircle,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import {
  useNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '../../hooks/useNotificationsQuery';
import { NotificationItem, NotificationType } from '../../types';

const { TabPane } = Tabs;
const { Text } = Typography;

export const NotificationPopover: React.FC = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const { data, isLoading } = useNotificationsQuery();
  const markAsReadMutation = useMarkAsReadMutation();
  const markAllAsReadMutation = useMarkAllAsReadMutation();

  const unreadCount = data?.unreadCount || 0;
  const allItems = data?.items || [];
  const unreadItems = allItems.filter((i) => !i.isRead);

  const displayedItems = activeTab === 'unread' ? unreadItems : allItems;

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'REQUEST':
        return <IconFile style={{ color: '#165DFF', fontSize: 18 }} />;
      case 'TRANSFER':
        return <IconSwap style={{ color: '#00B42A', fontSize: 18 }} />;
      case 'REPAIR':
        return <IconTool style={{ color: '#FF7D00', fontSize: 18 }} />;
      case 'WRITE_OFF':
        return <IconDelete style={{ color: '#F53F3F', fontSize: 18 }} />;
      case 'WARNING':
      case 'QUOTA':
        return <IconExclamationCircle style={{ color: '#F7BA1E', fontSize: 18 }} />;
      case 'SUCCESS':
        return <IconCheckCircle style={{ color: '#00B42A', fontSize: 18 }} />;
      case 'ERROR':
        return <IconExclamationCircle style={{ color: '#F53F3F', fontSize: 18 }} />;
      default:
        return <IconInfoCircle style={{ color: '#165DFF', fontSize: 18 }} />;
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markAsReadMutation.mutate(item.id);
    }
    if (item.link) {
      setVisible(false);
      navigate(item.link);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsReadMutation.mutate();
  };

  const dropdownContent = (
    <div
      style={{
        width: 380,
        maxWidth: '92vw',
        backgroundColor: 'var(--color-bg-popup, #ffffff)',
        border: '1px solid var(--color-border-2, #e5e6eb)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        borderRadius: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-2)',
          backgroundColor: 'var(--color-bg-2, #f7f8fa)',
        }}
      >
        <Space size="small">
          <IconNotification style={{ color: 'var(--color-primary-light-4)', fontSize: 16 }} />
          <Text bold style={{ fontSize: 14 }}>
            Bildirishnomalar
          </Text>
        </Space>
        {unreadCount > 0 && (
          <Button
            size="mini"
            type="text"
            icon={<IconCheck />}
            loading={markAllAsReadMutation.isPending}
            onClick={handleMarkAllRead}
            style={{ borderRadius: 0 }}
          >
            Barchasini o‘qilgan qilish
          </Button>
        )}
      </div>

      <div style={{ padding: '0 8px', backgroundColor: 'var(--color-bg-2, #f7f8fa)' }}>
        <Tabs activeTab={activeTab} onChange={setActiveTab} size="small" type="line">
          <TabPane key="all" title={`Hammasi (${allItems.length})`} />
          <TabPane key="unread" title={`O‘qilmagan (${unreadCount})`} />
        </Tabs>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {displayedItems.length === 0 ? (
          <Empty
            description={activeTab === 'unread' ? 'Yangi o‘qilmagan xabarlar yo‘q' : 'Bildirishnomalar mavjud emas'}
            style={{ padding: '36px 0' }}
          />
        ) : (
          <List
            size="small"
            bordered={false}
            dataSource={displayedItems}
            render={(item: NotificationItem) => (
              <List.Item
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 16px',
                  backgroundColor: item.isRead ? 'transparent' : 'var(--color-fill-1)',
                  borderBottom: '1px solid var(--color-border-1)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}>{getNotificationIcon(item.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <Text bold style={{ fontSize: 13, color: item.isRead ? 'var(--color-text-2)' : 'var(--color-text-1)' }}>
                        {item.title}
                      </Text>
                      {!item.isRead && (
                        <Tag size="small" color="arcoblue" style={{ borderRadius: 0, flexShrink: 0 }}>Yangi</Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4, wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {item.message}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 6 }}>
                      {new Date(item.createdAt).toLocaleString('uz-UZ', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      trigger="click"
      position="br"
      popupVisible={visible}
      onVisibleChange={setVisible}
      droplist={dropdownContent}
      unmountOnExit={false}
    >
      <Badge count={unreadCount} dot={false} maxCount={99}>
        <Button
          type="secondary"
          shape="square"
          icon={<IconNotification />}
          style={{
            borderRadius: 0,
            color: unreadCount > 0 ? '#165DFF' : 'inherit',
          }}
        />
      </Badge>
    </Dropdown>
  );
};

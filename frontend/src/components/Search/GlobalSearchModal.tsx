import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  Input,
  Tag,
  Spin,
  Empty,
  Typography,
  Space,
  Radio,
} from '@arco-design/web-react';
import {
  IconSearch,
  IconDesktop,
  IconBranch,
  IconUser,
  IconFile,
  IconRight,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearchQuery, SearchResultType, SearchResultItem } from '../../hooks/useGlobalSearchQuery';

const { Text } = Typography;

export interface GlobalSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  visible,
  onClose,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<any>(null);

  const [inputValue, setInputValue] = useState<string>('');
  const [debouncedTerm, setDebouncedTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<SearchResultType | 'ALL'>('ALL');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Focus input on open
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setSelectedIndex(0);
    } else {
      setInputValue('');
      setDebouncedTerm('');
      setSelectedType('ALL');
    }
  }, [visible]);

  // Query backend
  const { data: rawResults, isLoading } = useGlobalSearchQuery(debouncedTerm, 25);

  // Filter results by selected type
  const filteredResults = React.useMemo(() => {
    if (!rawResults) return [];
    if (selectedType === 'ALL') return rawResults;
    return rawResults.filter((item) => item.type === selectedType);
  }, [rawResults, selectedType]);

  // Navigate to item
  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      onClose();
      navigate(item.href);
    },
    [navigate, onClose],
  );

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      }
    }
  };

  // Helper to render icon by type
  const renderItemIcon = (type: SearchResultType) => {
    switch (type) {
      case 'ASSET':
        return (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: 'rgba(22, 93, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#165DFF',
              flexShrink: 0,
            }}
          >
            <IconDesktop style={{ fontSize: 16 }} />
          </div>
        );
      case 'ROOM':
        return (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: 'rgba(0, 180, 42, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00B42A',
              flexShrink: 0,
            }}
          >
            <IconBranch style={{ fontSize: 16 }} />
          </div>
        );
      case 'REQUEST':
        return (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: 'rgba(255, 125, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FF7D00',
              flexShrink: 0,
            }}
          >
            <IconFile style={{ fontSize: 16 }} />
          </div>
        );
      case 'USER':
        return (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: 'rgba(114, 46, 209, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#722ED1',
              flexShrink: 0,
            }}
          >
            <IconUser style={{ fontSize: 16 }} />
          </div>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      style={{ width: 620, top: '12vh', padding: 0, overflow: 'hidden' }}
      maskClosable
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Search Input Box */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <IconSearch style={{ fontSize: 20, color: 'var(--color-text-3)' }} />
          <Input
            ref={inputRef}
            placeholder="Aktivlar, xonalar, xodimlar yoki talabnomalarni qidirish..."
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={handleKeyDown}
            allowClear
            style={{ fontSize: 16, padding: 0, flex: 1, border: 'none' }}
          />
          <Tag size="small" style={{ backgroundColor: 'var(--color-fill-3)' }}>
            ESC
          </Tag>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--color-border-1)',
            backgroundColor: 'var(--color-fill-1)',
          }}
        >
          <Radio.Group
            type="button"
            size="small"
            value={selectedType}
            onChange={(val) => {
              setSelectedType(val);
              setSelectedIndex(0);
            }}
          >
            <Radio value="ALL">Barchasi</Radio>
            <Radio value="ASSET">Aktivlar</Radio>
            <Radio value="ROOM">Xonalar</Radio>
            <Radio value="REQUEST">Talabnomalar</Radio>
            <Radio value="USER">Xodimlar</Radio>
          </Radio.Group>
        </div>

        {/* Results Area */}
        <div
          style={{
            maxHeight: 380,
            minHeight: 180,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {inputValue.trim().length < 2 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                Qidiruv uchun kamida 2 ta belgi kiriting
              </Text>
              <Space size="small">
                <Tag size="small">INV-2026-0001</Tag>
                <Tag size="small">Kompyuter Dell</Tag>
                <Tag size="small">101-xona</Tag>
                <Tag size="small">Xodim F.I.Sh.</Tag>
              </Space>
            </div>
          ) : isLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spin tip="Tizim bo‘ylab qidirilmoqda..." />
            </div>
          ) : filteredResults.length === 0 ? (
            <div style={{ padding: '40px 0' }}>
              <Empty description={`"${debouncedTerm}" bo‘yicha hech narsa topilmadi`} />
            </div>
          ) : (
            <div>
              {filteredResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 20px',
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? 'var(--color-fill-2)'
                        : 'transparent',
                      transition: 'background-color 0.15s ease',
                      borderLeft: isSelected ? '3px solid #165DFF' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                      {renderItemIcon(item.type)}
                      <div style={{ overflow: 'hidden' }}>
                        <Text bold style={{ fontSize: 14, display: 'block' }} ellipsis>
                          {item.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                          {item.subtitle}
                        </Text>
                      </div>
                    </div>

                    <Space size="small" style={{ flexShrink: 0 }}>
                      {item.badge && (
                        <Tag size="small" color="arcoblue">
                          {item.badge}
                        </Tag>
                      )}
                      <IconRight style={{ color: 'var(--color-text-4)', fontSize: 14 }} />
                    </Space>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Helper Bar */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--color-border-1)',
            backgroundColor: 'var(--color-fill-1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--color-text-3)',
          }}
        >
          <Space size="medium">
            <span>
              <Tag size="small" style={{ marginRight: 4 }}>↑↓</Tag> Harakatlanish
            </span>
            <span>
              <Tag size="small" style={{ marginRight: 4 }}>↵ Enter</Tag> O‘tish
            </span>
            <span>
              <Tag size="small" style={{ marginRight: 4 }}>ESC</Tag> Yopish
            </span>
          </Space>

          <span>
            Jami: <strong>{filteredResults.length} ta</strong> natija
          </span>
        </div>
      </div>
    </Modal>
  );
};

import React from 'react';
import { Dropdown, Menu, Button } from '@arco-design/web-react';
import { IconLanguage, IconDown, IconCheck } from '@arco-design/web-react/icon';
import { useLanguageStore, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../store/languageStore';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguageStore();

  const currentOption = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const dropList = (
    <Menu
      selectedKeys={[language]}
      onClickMenuItem={(key) => setLanguage(key as SupportedLanguage)}
      style={{ borderRadius: 0, minWidth: 140 }}
    >
      {SUPPORTED_LANGUAGES.map((opt) => (
        <Menu.Item
          key={opt.code}
          style={{
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
          }}
        >
          <span style={{ fontWeight: opt.code === language ? 600 : 400 }}>
            {opt.label}
          </span>
          {opt.code === language && (
            <IconCheck style={{ color: '#165DFF', fontSize: 14, marginLeft: 8 }} />
          )}
        </Menu.Item>
      ))}
    </Menu>
  );

  return (
    <Dropdown droplist={dropList} trigger="click" position="br">
      <Button
        type="secondary"
        size="small"
        style={{
          borderRadius: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        <IconLanguage style={{ fontSize: 14 }} />
        <span>{currentOption.shortLabel}</span>
        <IconDown style={{ fontSize: 10 }} />
      </Button>
    </Dropdown>
  );
};

import React from 'react';
import { Tabs } from '@arco-design/web-react';

const TabPane = Tabs.TabPane;

export interface PageTabItem {
  key: string;
  title: string | React.ReactNode;
  count?: number;
  disabled?: boolean;
  children?: React.ReactNode;
}

export interface PageTabsProps {
  activeTab: string;
  onChange: (key: string) => void;
  tabs: PageTabItem[];
  style?: React.CSSProperties;
  extra?: React.ReactNode;
  size?: 'small' | 'default' | 'large';
  children?: React.ReactNode;
}

/**
 * UWMS Standart Sahifa Tablari Komponenti.
 * Sof Arco Design Tabs type="line" (Rasmiy chiziqli tablar).
 * Hech qanday Card o'rovisiz va custom CSS siz toza standart ko'rinish.
 */
export const PageTabs: React.FC<PageTabsProps> = ({
  activeTab,
  onChange,
  tabs,
  style,
  extra,
  size = 'default',
  children,
}) => {
  return (
    <Tabs
      activeTab={activeTab}
      onChange={onChange}
      extra={extra}
      size={size}
      type="line"
      style={{ marginBottom: -16, ...style }}
    >
      {tabs.map((tab) => {
        const displayTitle =
          typeof tab.title === 'string' && tab.count !== undefined
            ? `${tab.title} (${tab.count})`
            : tab.title;

        return (
          <TabPane key={tab.key} title={displayTitle} disabled={tab.disabled}>
            {tab.children}
          </TabPane>
        );
      })}
    </Tabs>
  );
};

export default PageTabs;

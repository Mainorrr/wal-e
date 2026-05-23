import { useState } from 'react';

export type TabId = 'query' | 'transaction' | 'recovery';

interface NavTabsProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'query', label: 'Query Editor' },
  { id: 'transaction', label: 'Transaction Manager' },
  { id: 'recovery', label: 'Recovery Logs' },
];

export function NavTabs({ activeTab: controlledTab, onTabChange }: NavTabsProps) {
  const [internalTab, setInternalTab] = useState<TabId>('query');
  const activeTab = controlledTab ?? internalTab;

  const handleClick = (tab: TabId) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <nav className="flex items-center gap-6">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleClick(tab.id)}
          className={`font-label-caps text-label-caps pb-2 transition-all duration-150 ${
            activeTab === tab.id
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
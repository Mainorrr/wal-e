import { TidInput } from './TidInput';
import { NavTabs } from './NavTabs';
import { ActionButtons } from './ActionButtons';
import { useTransaction } from '../../context/TransactionContext';

export function TopBar() {
  const { activeView, setActiveView } = useTransaction();

  return (
    <header className="flex justify-between items-center px-margin h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant z-50">
      <div className="flex items-center gap-gutter">
        <TidInput />
        <div className="h-6 w-px bg-outline-variant" />
        <NavTabs activeTab={activeView} onTabChange={(tab) => setActiveView(tab)} />
      </div>
      <ActionButtons />
    </header>
  );
}
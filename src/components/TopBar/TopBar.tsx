import { TidInput } from './TidInput';
import { NavTabs } from './NavTabs';
import { ActionButtons } from './ActionButtons';

export function TopBar() {
  return (
    <header className="flex justify-between items-center px-margin h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant z-50">
      <div className="flex items-center gap-gutter">
        <TidInput />
        <div className="h-6 w-px bg-outline-variant" />
        <NavTabs />
      </div>
      <ActionButtons />
    </header>
  );
}
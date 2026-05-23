import { useEngine } from '../../context/EngineContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import type { EngineType, EngineConfig } from '../../../electron/types';

interface NodeButtonProps {
  id: string;
  label: string;
  icon: string;
  type: EngineType;
  config: EngineConfig;
  isActive: boolean;
  isCustom?: boolean;
}

export function NodeButton({ id, label, icon, type, config, isActive, isCustom }: NodeButtonProps) {
  const { connect, disconnect, setActive, engines, removeConfiguredNode } = useEngine();
  const isConnected = engines.some((e) => e.id === id);

  const handleClick = async () => {
    if (isConnected) {
      if (isActive) {
        await disconnect(id);
      } else {
        setActive(id);
      }
    } else {
      await connect(id, type, config);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the node connection "${label}"?`)) {
      await removeConfiguredNode(id);
    }
  };

  const activeClasses = isActive
    ? 'text-primary bg-primary-container/10'
    : 'text-on-surface-variant hover:bg-surface-container-high';

  return (
    <div className="relative group w-full">
      <button
        onClick={handleClick}
        className={`relative w-full flex items-center justify-between px-3 py-2 rounded transition-colors duration-200 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary ${activeClasses}`}
      >
        {isActive && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-primary rounded-r-sm"
          />
        )}
        <div className="flex items-center gap-3">
          <MaterialSymbol icon={icon} size={20} />
          <span className="font-body-md text-body-md text-left truncate max-w-[140px]">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isCustom && (
            <span
              onClick={handleDelete}
              className="p-0.5 hover:text-error text-on-surface-variant/60 cursor-pointer rounded transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center"
              title="Delete Connection"
            >
              <MaterialSymbol icon="delete" size={16} />
            </span>
          )}
          {isConnected && (
            <div className={`w-2 h-2 rounded-full bg-secondary ${isActive ? 'animate-pulse shadow-[0_0_8px_rgba(78,222,163,0.6)]' : 'shadow-[0_0_4px_rgba(78,222,163,0.4)]'}`} />
          )}
        </div>
      </button>
    </div>
  );
}
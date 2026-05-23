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
}

export function NodeButton({ id, label, icon, type, config, isActive }: NodeButtonProps) {
  const { connect, disconnect, setActive, engines } = useEngine();
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

  const activeClasses = isActive
    ? 'text-primary border-l-2 border-primary bg-primary-container/10'
    : 'text-on-surface-variant hover:bg-surface-container-high';

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded transition-colors duration-200 ${activeClasses}`}
    >
      <div className="flex items-center gap-3">
        <MaterialSymbol icon={icon} size={20} />
        <span className="font-body-md text-body-md">{label}</span>
      </div>
      {isConnected && (
        <div className={`w-2 h-2 rounded-full bg-secondary ${isActive ? 'animate-pulse shadow-[0_0_8px_rgba(78,222,163,0.6)]' : 'shadow-[0_0_4px_rgba(78,222,163,0.4)]'}`} />
      )}
    </button>
  );
}
import { useState } from 'react';
import { useTransaction } from '../../context/TransactionContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import { QueryLabModal } from '../QueryLab/QueryLabModal';

export function ActionButtons() {
  const { triggerCrash, triggerRecovery, setActiveView } = useTransaction();
  const [showLab, setShowLab] = useState(false);

  const handleCrash = async () => {
    await triggerCrash();
    setActiveView('recovery');
  };

  const handleRecovery = async () => {
    await triggerRecovery();
    setActiveView('recovery');
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCrash}
        className="px-3 py-1.5 bg-error-container text-error text-[11px] font-bold rounded flex items-center gap-2 hover:brightness-110 transition-all"
        title="Vacía el buffer de páginas sucias y navega a Recovery"
      >
        <MaterialSymbol icon="warning" size={14} />
        INJECT CRASH
      </button>
      <button
        onClick={handleRecovery}
        className="px-3 py-1.5 bg-tertiary-container text-on-tertiary-container text-[11px] font-bold rounded flex items-center gap-2 hover:brightness-110 transition-all"
        title="Ejecuta el procedimiento de recuperación según el protocolo activo"
      >
        <MaterialSymbol icon="bolt" size={14} />
        RUN RECOVERY
      </button>
      <button
        onClick={() => setShowLab(true)}
        className="px-3 py-1.5 bg-purple-600 text-white text-[11px] font-bold rounded flex items-center gap-2 hover:bg-purple-500 transition-all"
        title="Abre el Query Lab con ejemplos para demostrar el sistema"
      >
        <MaterialSymbol icon="science" size={14} />
        QUERY LAB
      </button>

      {showLab && <QueryLabModal onClose={() => setShowLab(false)} />}
    </div>
  );
}

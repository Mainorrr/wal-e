import { useTransaction } from '../../context/TransactionContext';
import { useEngine } from '../../context/EngineContext';
import { useRef } from 'react';
import { MaterialSymbol } from '../shared/MaterialSymbol';

export function ActionButtons() {
  const { currentTid, setTid, begin, commit, rollback, triggerCrash, triggerRecovery, loadDemo } = useTransaction();
  const { activeEngineId } = useEngine();
  const tidCounter = useRef(0);

  const handleBegin = async () => {
    if (!activeEngineId) return;
    let tid = currentTid;
    if (!tid) {
      tidCounter.current += 1;
      tid = `TXN-${String(tidCounter.current).padStart(4, '0')}`;
      setTid(tid);
    }
    await begin(tid, activeEngineId);
  };

  const handleCommit = async () => {
    if (!currentTid) return;
    await commit(currentTid);
  };

  const handleRollback = async () => {
    if (!currentTid) return;
    await rollback(currentTid);
  };

  const handleCrash = async () => {
    await triggerCrash();
  };

  const handleRecovery = async () => {
    await triggerRecovery();
  };

  const handleDemo = async () => {
    await loadDemo();
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center bg-surface-container-high rounded p-1">
        <button
          onClick={handleBegin}
          className="px-4 py-1.5 text-[11px] font-bold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity rounded-sm"
        >
          BEGIN
        </button>
        <button
          onClick={handleCommit}
          className="px-4 py-1.5 text-[11px] font-bold text-secondary hover:bg-secondary-container/20 transition-all rounded-sm"
        >
          COMMIT
        </button>
        <button
          onClick={handleRollback}
          className="px-4 py-1.5 text-[11px] font-bold text-on-surface-variant hover:bg-outline-variant transition-all rounded-sm"
        >
          ROLLBACK
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCrash}
          className="px-3 py-1.5 bg-error-container text-error text-[11px] font-bold rounded flex items-center gap-2 hover:brightness-110 transition-all"
        >
          <MaterialSymbol icon="warning" size={14} />
          INJECT CRASH
        </button>
        <button
          onClick={handleRecovery}
          className="px-3 py-1.5 bg-tertiary-container text-on-tertiary-container text-[11px] font-bold rounded flex items-center gap-2 hover:brightness-110 transition-all"
        >
          <MaterialSymbol icon="bolt" size={14} />
          RUN RECOVERY
        </button>
      </div>

      <button
        onClick={handleDemo}
        className="px-3 py-1.5 bg-surface-container-high text-on-surface-variant text-[11px] font-bold rounded border border-outline-variant hover:bg-surface-container-highest transition-all"
      >
        LOAD DEMO
      </button>
    </div>
  );
}
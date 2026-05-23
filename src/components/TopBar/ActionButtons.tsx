import { useTransaction } from '../../context/TransactionContext';
import { useState } from 'react';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import { CreateTransactionModal } from './CreateTransactionModal';

export function ActionButtons() {
  const { selectedTid, setSelectedTid, commit, rollback, triggerCrash, triggerRecovery, loadDemo, allTransactions } = useTransaction();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const selectedTx = allTransactions.find((t) => t.tid === selectedTid);
  const isSelectedTxActive = selectedTx?.status === 'ACTIVE';

  const handleBegin = () => {
    setShowCreateModal(true);
  };

  const handleCommit = async () => {
    if (!selectedTid || !isSelectedTxActive) return;
    await commit(selectedTid);
    setSelectedTid(null);
  };

  const handleRollback = async () => {
    if (!selectedTid || !isSelectedTxActive) return;
    await rollback(selectedTid);
    setSelectedTid(null);
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
          disabled={!selectedTid || !isSelectedTxActive}
          className={`px-4 py-1.5 text-[11px] font-bold rounded transition-all ${isSelectedTxActive && selectedTid ? 'text-secondary hover:bg-secondary-container/20' : 'text-outline opacity-40 cursor-not-allowed'}`}
        >
          COMMIT
        </button>
        <button
          onClick={handleRollback}
          disabled={!selectedTid || !isSelectedTxActive}
          className={`px-4 py-1.5 text-[11px] font-bold rounded transition-all ${isSelectedTxActive && selectedTid ? 'text-on-surface-variant hover:bg-outline-variant' : 'text-outline opacity-40 cursor-not-allowed'}`}
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

      {showCreateModal && (
        <CreateTransactionModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
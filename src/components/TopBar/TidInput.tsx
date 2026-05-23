import { useState, useRef, useEffect } from 'react';
import { useTransaction } from '../../context/TransactionContext';
import { useEngine } from '../../context/EngineContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import { CreateTransactionModal } from './CreateTransactionModal';

export function TidInput() {
  const { allTransactions, selectedTid, setSelectedTid, activeView, setActiveView } = useTransaction();
  const { activeEngineId, setActive } = useEngine();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter transactions for the current engine
  const currentEngineTxs = activeEngineId
    ? allTransactions.filter((t) => t.engineId === activeEngineId)
    : [];

  const activeTxs = currentEngineTxs.filter((t) => t.status === 'ACTIVE');
  const historyTxs = currentEngineTxs.filter((t) => t.status !== 'ACTIVE');
  
  const selectedTx = allTransactions.find((t) => t.tid === selectedTid);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (tid: string, engineId: string) => {
    setSelectedTid(tid);
    setActive(engineId);
    setIsOpen(false);
    // Switch to query editor or keep transaction view
    if (activeView !== 'query' && activeView !== 'transaction') {
      setActiveView('query');
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_6px_rgba(78,222,163,0.5)]" />;
      case 'COMMITTED':
        return <span className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'ABORTED':
        return <span className="w-2 h-2 bg-red-500 rounded-full" />;
      default:
        return <span className="w-2 h-2 bg-yellow-500 rounded-full" />;
    }
  };

  if (!activeEngineId) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container border border-outline-variant text-[11px] font-bold text-outline rounded select-none">
        <MaterialSymbol icon="dns" size={16} />
        <span>No Node Selected</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant hover:border-primary text-body-md text-on-surface rounded cursor-pointer select-none min-w-[200px] transition-all"
      >
        <div className="flex items-center gap-2 truncate">
          {selectedTx ? (
            <>
              {getStatusDot(selectedTx.status)}
              <span className="font-code-md text-code-md text-primary font-semibold">{selectedTx.tid}</span>
              <span className="text-[10px] text-outline uppercase">({selectedTx.status})</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 bg-outline/40 rounded-full" />
              <span className="text-on-surface-variant font-medium text-xs">Select Transaction</span>
            </>
          )}
        </div>
        <MaterialSymbol icon="keyboard_arrow_down" size={16} className={`text-outline transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-64 bg-surface-container-high border border-outline-variant rounded-lg shadow-2xl py-2 z-50 flex flex-col max-h-[300px]">
          <div className="px-3 pb-1 border-b border-outline-variant mb-1 flex items-center justify-between">
            <span className="text-[9px] text-outline uppercase font-label-caps tracking-wider">Node: {activeEngineId}</span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 py-1 space-y-2">
            {/* Active Transactions */}
            <div>
              <div className="px-3 text-[9px] text-secondary font-bold uppercase tracking-tighter mb-1">Active ({activeTxs.length})</div>
              {activeTxs.length === 0 ? (
                <div className="px-3 py-1 text-[10px] text-outline-variant italic">No active transactions</div>
              ) : (
                activeTxs.map((t) => (
                  <div
                    key={t.tid}
                    onClick={() => handleSelect(t.tid, t.engineId)}
                    className={`px-3 py-1.5 text-xs font-code-md cursor-pointer flex items-center justify-between hover:bg-primary-container/10 transition-colors ${
                      selectedTid === t.tid ? 'bg-primary-container/20 border-l-2 border-primary' : ''
                    }`}
                  >
                    <span className="font-semibold text-primary font-code-md">{t.tid}</span>
                    {getStatusDot(t.status)}
                  </div>
                ))
              )}
            </div>

            {/* History Transactions */}
            {historyTxs.length > 0 && (
              <div>
                <div className="px-3 text-[9px] text-outline font-bold uppercase tracking-tighter mb-1">History ({historyTxs.length})</div>
                <div className="space-y-0.5">
                  {historyTxs.map((t) => (
                    <div
                      key={t.tid}
                      onClick={() => handleSelect(t.tid, t.engineId)}
                      className={`px-3 py-1 text-xs font-code-md cursor-pointer flex items-center justify-between hover:bg-surface-container-highest transition-colors ${
                        selectedTid === t.tid ? 'bg-surface-container-highest border-l-2 border-outline' : ''
                      }`}
                    >
                      <span className="text-on-surface-variant font-code-md">{t.tid}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-outline-variant uppercase">{t.status.slice(0, 4)}</span>
                        {getStatusDot(t.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-outline-variant mt-2 pt-2 px-2">
            <button
              onClick={() => {
                setIsOpen(false);
                setShowCreateModal(true);
              }}
              className="w-full py-1.5 bg-primary-container/20 hover:bg-primary-container/30 text-primary text-[10px] font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <MaterialSymbol icon="add" size={14} />
              NEW TRANSACTION
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateTransactionModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
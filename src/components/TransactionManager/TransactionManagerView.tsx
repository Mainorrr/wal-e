import { useTransaction } from '../../context/TransactionContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';

function getOpColor(op: string): string {
  switch (op) {
    case 'BEGIN': return 'text-primary-container';
    case 'COMMIT': return 'text-secondary';
    case 'ABORT': return 'text-error';
    case 'INSERT': return 'text-secondary-fixed-dim';
    case 'UPDATE':
    case 'DELETE': return 'text-tertiary-fixed-dim';
    default: return 'text-outline-variant';
  }
}

export function TransactionManagerView() {
  const { selectedTid, allTransactions, walEntries, dirtyPages, protocol, commit, rollback, setActiveView, setSelectedTid } = useTransaction();

  const tx = allTransactions.find((t) => t.tid === selectedTid);
  const txWalEntries = walEntries.filter((e) => e.tid === selectedTid);
  const txDirtyPages = dirtyPages.filter(([key]) => key.startsWith(`${selectedTid}:`));
  const isTxActive = tx?.status === 'ACTIVE';

  if (!selectedTid) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-container-low rounded-lg border border-outline-variant">
        <div className="text-center">
          <MaterialSymbol icon="search" size={48} className="text-outline mb-4" />
          <p className="text-on-surface-variant font-body-md">Select a transaction from the sidebar</p>
        </div>
      </div>
    );
  }

  const handleCommit = async () => {
    if (!selectedTid) return;
    await commit(selectedTid);
    setSelectedTid(null);
    setActiveView('query');
  };

  const handleRollback = async () => {
    if (!selectedTid) return;
    await rollback(selectedTid);
    setSelectedTid(null);
    setActiveView('query');
  };

  return (
    <div className="flex-1 flex flex-col gap-gutter">
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 bg-surface-container-highest border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-label-caps text-label-caps text-primary">TRANSACTION MANAGER</span>
          </div>
        </div>

        <div className="p-4 grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-outline font-label-caps uppercase">TID</span>
            <p className="font-code-md text-primary text-lg">{selectedTid}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-outline font-label-caps uppercase">Status</span>
            <p className={`font-code-md text-lg ${tx?.status === 'ACTIVE' ? 'text-secondary' : tx?.status === 'COMMITTED' ? 'text-secondary' : tx?.status === 'ABORTED' ? 'text-error' : 'text-yellow-600'}`}>{tx?.status ?? 'UNKNOWN'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-outline font-label-caps uppercase">Engine</span>
            <p className="font-code-md text-on-surface-variant text-lg">{tx?.engineId ?? 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-outline font-label-caps uppercase">Protocol</span>
            <p className="font-code-md text-tertiary text-lg">{protocol}</p>
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={handleCommit}
            disabled={!isTxActive}
            className={`px-4 py-2 text-[11px] font-bold rounded transition-all ${
              isTxActive
                ? 'bg-secondary text-on-secondary hover:opacity-90'
                : 'bg-surface-container-high text-outline cursor-not-allowed'
            }`}
          >
            COMMIT
          </button>
          <button
            onClick={handleRollback}
            disabled={!isTxActive}
            className={`px-4 py-2 text-[11px] font-bold rounded transition-all ${
              isTxActive
                ? 'bg-error-container text-error hover:opacity-90'
                : 'bg-surface-container-high text-outline cursor-not-allowed'
            }`}
          >
            ROLLBACK
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-gutter overflow-hidden">
        <div className="flex-1 bg-black rounded-lg border border-outline-variant overflow-hidden flex flex-col">
          <div className="px-4 py-2 bg-surface-container-highest border-b border-outline-variant">
            <span className="font-label-caps text-label-caps text-on-surface">WAL ENTRIES ({txWalEntries.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-code-sm text-code-sm space-y-1">
            {txWalEntries.length === 0 ? (
              <p className="text-outline-variant italic">No WAL entries for this transaction</p>
            ) : (
              txWalEntries.map((entry, i) => (
                <div key={`${entry.tid}-${entry.timestamp}-${i}`} className={`wal-line ${getOpColor(entry.op)}`}>
                  <span>{JSON.stringify(entry)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="w-72 bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden flex flex-col">
          <div className="px-4 py-2 bg-surface-container-highest border-b border-outline-variant">
            <span className="font-label-caps text-label-caps text-on-surface">DIRTY PAGES ({txDirtyPages.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-code-sm text-code-sm space-y-2">
            {txDirtyPages.length === 0 ? (
              <p className="text-outline-variant italic">No dirty pages for this transaction</p>
            ) : (
              txDirtyPages.map(([key, mutation]) => (
                <div key={key} className="bg-surface-container-highest p-2 rounded text-on-surface-variant">
                  <div className="text-primary text-[10px] font-bold mb-1">{mutation.op}</div>
                  <div className="text-[10px]">{mutation.table_or_collection ?? 'N/A'}</div>
                  {mutation.after_image && (
                    <div className="text-[10px] text-secondary mt-1">→ {JSON.stringify(mutation.after_image)}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
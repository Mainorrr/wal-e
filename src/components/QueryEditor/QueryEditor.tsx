import { useState } from 'react';
import { CodeDisplay } from './CodeDisplay';
import { ResultsTable } from './ResultsTable';
import { useEngine } from '../../context/EngineContext';
import { useTransaction } from '../../context/TransactionContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import { CreateTransactionModal } from '../TopBar/CreateTransactionModal';

export function QueryEditor() {
  const { activeEngineId, engines } = useEngine();
  const { allTransactions, selectedTid, setSelectedTid } = useTransaction();
  const [queryResult, setQueryResult] = useState<{ data: unknown; isMutation: boolean } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const activeEngine = engines.find((e) => e.id === activeEngineId);
  const isMongo = activeEngine?.type === 'nosql';

  const selectedTx = allTransactions.find((t) => t.tid === selectedTid);
  const isTxActive = selectedTx?.status === 'ACTIVE';

  if (!activeEngineId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-container-low border border-outline-variant rounded-lg p-8 text-center min-h-[400px]">
        <div className="w-16 h-16 bg-surface-container-high border border-outline-variant text-outline rounded-full flex items-center justify-center mb-4">
          <MaterialSymbol icon="dns" size={32} />
        </div>
        <h3 className="text-lg font-bold text-primary mb-2">No Database Node Selected</h3>
        <p className="text-sm text-on-surface-variant max-w-sm mb-6 font-body-md">
          Connect to a PostgreSQL or MongoDB node from the sidebar to start running transactions and queries.
        </p>
      </div>
    );
  }

  if (!selectedTid || !isTxActive) {
    const activeTxs = allTransactions.filter(
      (t) => t.engineId === activeEngineId && t.status === 'ACTIVE'
    );

    return (
      <div className="flex-1 flex flex-col bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-surface-container border-b border-outline-variant">
          <span className="text-code-sm font-code-md text-on-surface-variant">
            {isMongo ? 'aggregate_metrics.js' : 'query_active_node_01.sql'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] text-secondary font-bold tracking-tighter uppercase">Connected</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-surface-container-high border border-outline-variant text-primary rounded-full flex items-center justify-center mb-4">
            <MaterialSymbol icon="history_edu" size={32} />
          </div>
          <h3 className="text-lg font-bold text-primary mb-2">
            {!selectedTid ? 'Transaction Selection Required' : 'Selected Transaction is Closed'}
          </h3>
          <p className="text-sm text-on-surface-variant max-w-md mb-6 font-body-md">
            {!selectedTid
              ? 'Queries in WAL-E must run inside a transaction to simulate Write-Ahead Logging. Start a new transaction or select an active one to write queries.'
              : `The transaction "${selectedTid}" is already ${selectedTx?.status.toLowerCase()}. You cannot run queries in a finished transaction. Start a new one to continue.`}
          </p>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-primary-container text-on-primary-container hover:opacity-90 font-bold rounded flex items-center gap-2 transition-all shadow-md text-xs"
          >
            <MaterialSymbol icon="add" size={18} />
            Start New Transaction
          </button>

          {activeTxs.length > 0 && (
            <div className="mt-8 w-full max-w-sm">
              <div className="h-px bg-outline-variant w-full mb-4" />
              <p className="text-[10px] text-outline font-label-caps uppercase mb-2">Or select an active transaction on this node:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {activeTxs.map((tx) => (
                  <button
                    key={tx.tid}
                    onClick={() => setSelectedTid(tx.tid)}
                    className="px-3 py-1 bg-surface-container-highest border border-outline-variant hover:border-primary text-xs font-code-md text-primary font-semibold rounded flex items-center gap-1.5 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    {tx.tid}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showCreateModal && (
          <CreateTransactionModal onClose={() => setShowCreateModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container border-b border-outline-variant">
        <div className="flex items-center gap-4">
          <span className="text-code-sm font-code-md text-on-surface-variant">
            {isMongo ? 'aggregate_metrics.js' : 'query_active_node_01.sql'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] text-secondary font-bold tracking-tighter uppercase">Connected</span>
          </div>
        </div>
      </div>
      <CodeDisplay onResult={(data, isMutation) => setQueryResult({ data, isMutation })} />
      <ResultsTable isMongo={isMongo} queryResult={queryResult} />
    </div>
  );
}
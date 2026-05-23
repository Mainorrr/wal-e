import { useEngine } from '../../context/EngineContext';
import { useTransaction } from '../../context/TransactionContext';
import type { DisplayTransaction } from '../../context/TransactionContext';
import { NodeButton } from './NodeButton';
import { ProtocolSelect } from './ProtocolSelect';
import { MaterialSymbol } from '../shared/MaterialSymbol';

function getStatusDotColor(status: TxStatus): string {
  switch (status) {
    case 'ACTIVE': return 'bg-secondary animate-pulse';
    case 'COMMITTED': return 'bg-green-500';
    case 'ABORTED': return 'bg-red-400';
    case 'PENDIENTE': return 'bg-yellow-500';
  }
}

function getStatusTextColor(status: TxStatus): string {
  switch (status) {
    case 'ACTIVE': return 'text-primary';
    case 'COMMITTED': return 'text-secondary';
    case 'ABORTED': return 'text-error';
    case 'PENDIENTE': return 'text-yellow-600';
  }
}

export function Sidebar() {
  const { engines, activeEngineId, setActive } = useEngine();
  const { protocol, setProtocol, allTransactions, selectedTid, setSelectedTid, setActiveView } = useTransaction();

  const activeEngine = engines.find((e) => e.id === activeEngineId);

  const handleTxClick = (tx: DisplayTransaction) => {
    if (selectedTid === tx.tid) {
      setSelectedTid(null);
      setActiveView('query');
    } else {
      setSelectedTid(tx.tid);
      setActiveView('transaction');
      setActive(tx.engineId);
    }
  };

  return (
    <aside className="fixed h-full flex flex-col z-40 bg-surface-container w-[240px] left-0 top-0 border-r border-outline-variant transition-colors duration-200">
      <div className="p-panel-padding flex items-center gap-3 mb-8">
        <div className="w-10 h-10 flex items-center justify-center bg-primary-container rounded">
          <MaterialSymbol icon="smart_toy" filled size={24} className="text-on-primary-container" />
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">WAL-E Client</h1>
          <p className="text-[10px] text-on-surface-variant tracking-widest uppercase">Database Management</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <div className="px-3 mb-2">
          <span className="font-label-caps text-label-caps text-outline uppercase">Distributed Nodes</span>
        </div>

        <NodeButton
          id="postgresql-nodo-01"
          label="PostgreSQL Nodes"
          icon="database"
          type="relational"
          config={{ host: 'localhost', port: 5432, database: 'wal_e', user: 'postgres', password: 'postgres' }}
          isActive={activeEngine?.id === 'postgresql-nodo-01'}
        />

        <NodeButton
          id="mongodb-nodo-01"
          label="MongoDB Nodes"
          icon="storage"
          type="nosql"
          config={{ uri: 'mongodb://localhost:27017', database: 'wal_e_demo' }}
          isActive={activeEngine?.id === 'mongodb-nodo-01'}
        />

        <div className="mt-8 px-3">
          <ProtocolSelect value={protocol} onChange={setProtocol} />
        </div>

        {allTransactions.length > 0 && (
          <div className="mt-8 px-3">
            <span className="font-label-caps text-label-caps text-outline uppercase block mb-2">
              Transactions ({allTransactions.length})
            </span>
            {allTransactions.map((tx) => (
              <div
                key={tx.tid}
                onClick={() => handleTxClick(tx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-code-sm cursor-pointer transition-colors ${
                  selectedTid === tx.tid
                    ? 'bg-primary-container/20 border border-primary'
                    : 'hover:bg-surface-container-high'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(tx.status)}`} />
                <span className={`font-code-md ${getStatusTextColor(tx.status)}`}>{tx.tid}</span>
                <span className="text-on-surface-variant text-[10px] ml-auto">
                  {tx.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-outline-variant space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
          <MaterialSymbol icon="analytics" size={20} />
          <span className="font-body-md text-body-md">System Health</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
          <MaterialSymbol icon="settings" size={20} />
          <span className="font-body-md text-body-md">Settings</span>
        </div>
      </div>
    </aside>
  );
}
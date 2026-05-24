import { useState } from 'react';
import { useEngine } from '../../context/EngineContext';
import { useTransaction } from '../../context/TransactionContext';
import type { DisplayTransaction, TxStatus } from '../../context/TransactionContext';
import { NodeButton } from './NodeButton';
import { ProtocolSelect } from './ProtocolSelect';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import { AddNodeModal } from './AddNodeModal';

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
  const { configuredNodes, activeEngineId, setActive } = useEngine();
  const { protocol, setProtocol, allTransactions, selectedTid, setSelectedTid, activeView, setActiveView } = useTransaction();
  const [showAddModal, setShowAddModal] = useState(false);

  const handleTxClick = (tx: DisplayTransaction) => {
    if (selectedTid === tx.tid) {
      setSelectedTid(null);
    } else {
      setSelectedTid(tx.tid);
      setActive(tx.engineId);
      if (activeView !== 'query') {
        setActiveView('transaction');
      }
    }
  };

  const filteredTransactions = activeEngineId
    ? allTransactions.filter((tx) => tx.engineId === activeEngineId)
    : [];

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

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-outline uppercase">Distributed Nodes</span>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 hover:text-primary text-on-surface-variant transition-colors flex items-center justify-center rounded-full hover:bg-surface-container-high"
            title="Add Database Node"
          >
            <MaterialSymbol icon="add" size={18} />
          </button>
        </div>

        {configuredNodes.map((node) => (
          <NodeButton
            key={node.id}
            id={node.id}
            label={node.label}
            icon={node.icon}
            type={node.type}
            config={node.config}
            isActive={activeEngineId === node.id}
            isCustom={node.id !== 'postgresql-nodo-01' && node.id !== 'mongodb-nodo-01'}
          />
        ))}

        <div className="mt-8 px-3">
          <ProtocolSelect value={protocol} onChange={setProtocol} />
        </div>

        {activeEngineId && filteredTransactions.length > 0 && (
          <div className="mt-8 px-3">
            <span className="font-label-caps text-label-caps text-outline uppercase block mb-2">
              Transactions ({filteredTransactions.length})
            </span>
            {filteredTransactions.map((tx) => (
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

      {showAddModal && <AddNodeModal onClose={() => setShowAddModal(false)} />}
    </aside>
  );
}
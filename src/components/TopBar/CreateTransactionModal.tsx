import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTransaction, type DisplayTransaction } from '../../context/TransactionContext';
import { useEngine } from '../../context/EngineContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import type { RecoveryProtocol } from '../../../electron/types';

interface CreateTransactionModalProps {
  onClose: () => void;
}

export function CreateTransactionModal({ onClose }: CreateTransactionModalProps) {
  const { allTransactions, begin, setProtocol, protocol: currentProtocol, setActiveView } = useTransaction();
  const { engines, activeEngineId, setActive } = useEngine();

  const [tid, setTid] = useState('');
  const [selectedEngineId, setSelectedEngineId] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState<RecoveryProtocol>('No-Undo/Redo');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Helper to generate next logical TID to prevent clashes
  const generateSafeTid = (existingTxs: DisplayTransaction[]) => {
    const numbers = existingTxs
      .map((t) => {
        const match = t.tid.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `TXN-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const handleRegenerateTid = () => {
    setTid(generateSafeTid(allTransactions));
  };

  // Initialize form options
  useEffect(() => {
    setTid(generateSafeTid(allTransactions));
    setSelectedProtocol(currentProtocol);

    if (activeEngineId && engines.some((e) => e.id === activeEngineId)) {
      setSelectedEngineId(activeEngineId);
    } else if (engines.length > 0) {
      setSelectedEngineId(engines[0].id);
    }
  }, [allTransactions, currentProtocol, activeEngineId, engines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tid.trim()) {
      setError('Transaction ID (TID) is required.');
      return;
    }

    if (!selectedEngineId) {
      setError('Please select a connected node first. Connect to a node in the sidebar.');
      return;
    }

    const trimmedTid = tid.trim().toUpperCase();

    // Verify it doesn't already exist and is active
    const existing = allTransactions.find((t) => t.tid === trimmedTid);
    if (existing && existing.status === 'ACTIVE') {
      setError(`Transaction ${trimmedTid} is already active.`);
      return;
    }

    setIsStarting(true);

    try {
      // Set the protocol first
      await setProtocol(selectedProtocol);
      
      // Start the transaction
      const result = await begin(trimmedTid, selectedEngineId);
      if (!result.success) {
        setError(result.error || 'Failed to start transaction.');
        setIsStarting(false);
        return;
      }

      // Synchronize active engine and redirect to editor
      setActive(selectedEngineId);
      setActiveView('query');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStarting(false);
    }
  };

  const connectedEngines = engines;

  return createPortal((
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
      <div 
        className="bg-surface-container border border-outline-variant p-6 rounded-xl w-[400px] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <MaterialSymbol icon="play_arrow" filled size={22} className="text-primary" />
            Start Transaction
          </h2>
          <button 
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-surface-container-high"
          >
            <MaterialSymbol icon="close" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Transaction ID (TID)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tid}
                onChange={(e) => setTid(e.target.value)}
                placeholder="TXN-0001"
                className="flex-1 bg-surface-container-lowest border border-outline-variant text-code-sm font-code-md text-primary px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary rounded outline-none uppercase"
                required
              />
              <button
                type="button"
                onClick={handleRegenerateTid}
                className="px-3 bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors rounded flex items-center justify-center"
                title="Auto-generate ID"
              >
                <MaterialSymbol icon="refresh" size={18} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Target Engine Node</label>
            {connectedEngines.length === 0 ? (
              <div className="bg-surface-container-lowest border border-error-container text-error text-xs p-2 rounded flex items-center gap-2">
                <MaterialSymbol icon="warning" size={16} />
                <span>No active connections. Please connect to a node first in the sidebar.</span>
              </div>
            ) : (
              <select
                value={selectedEngineId}
                onChange={(e) => setSelectedEngineId(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-2 focus:border-primary rounded outline-none"
              >
                {connectedEngines.map((engine) => (
                  <option key={engine.id} value={engine.id}>
                    {engine.id} ({engine.type === 'relational' ? 'PostgreSQL' : 'MongoDB'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Recovery Protocol</label>
            <select
              value={selectedProtocol}
              onChange={(e) => setSelectedProtocol(e.target.value as RecoveryProtocol)}
              className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-2 focus:border-primary rounded outline-none"
            >
              <option value="No-Undo/No-Redo">No-Undo/No-Redo</option>
              <option value="No-Undo/Redo">No-Undo/Redo</option>
              <option value="Undo/No-Redo">Undo/No-Redo</option>
              <option value="Undo/Redo">Undo/Redo</option>
            </select>
          </div>

          {error && (
            <div className="bg-error-container/20 border border-error text-error text-xs p-3 rounded flex items-center gap-2">
              <MaterialSymbol icon="error" size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high rounded transition-all"
              disabled={isStarting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-primary-container text-on-primary-container hover:opacity-90 rounded transition-all flex items-center gap-1.5"
              disabled={isStarting || connectedEngines.length === 0}
            >
              {isStarting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-on-primary-container/30 border-t-on-primary-container rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <MaterialSymbol icon="play_arrow" size={14} />
                  Begin Transaction
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
}

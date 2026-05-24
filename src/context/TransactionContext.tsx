import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { RecoveryProtocol, MutationData } from '../../electron/types';
import type { WalEntry } from '../types/window';

export type TxStatus = 'ACTIVE' | 'COMMITTED' | 'ABORTED' | 'PENDIENTE';

export interface DisplayTransaction {
  tid: string;
  engineId: string;
  status: TxStatus;
}

export interface RecoveryResult {
  beforeState: Array<{ tid: string; engineId: string; status: string }>;
  afterState: Array<{ tid: string; engineId: string; status: string }>;
  undoneTids: string[];
  redoneTids: string[];
  walEntriesProcessed: number;
  protocol: RecoveryProtocol;
  dataBefore: Array<{ key: string; engineId: string; table: string; rows: unknown[] }>;
  dataAfter: Array<{ key: string; engineId: string; table: string; rows: unknown[] }>;
  ranAt: number;
}

interface TransactionContextValue {
  currentTid: string;
  protocol: RecoveryProtocol;
  allTransactions: DisplayTransaction[];
  dirtyPages: Array<[string, MutationData]>;
  walEntries: WalEntry[];
  selectedTid: string | null;
  activeView: 'query' | 'transaction' | 'recovery';
  setTid: (tid: string) => void;
  setSelectedTid: (tid: string | null) => void;
  setActiveView: (view: 'query' | 'transaction' | 'recovery') => void;
  begin: (tid: string, engineId: string) => Promise<{ success: boolean; error?: string }>;
  execute: (tid: string, mutationData: MutationData) => Promise<{ success: boolean; error?: string }>;
  commit: (tid: string) => Promise<{ success: boolean; error?: string }>;
  rollback: (tid: string) => Promise<{ success: boolean; error?: string }>;
  setProtocol: (p: RecoveryProtocol) => Promise<void>;
  triggerCrash: () => Promise<{ droppedPages: number; activeTids: string[] }>;
  triggerRecovery: () => Promise<RecoveryResult | null>;
  lastCrash: { droppedPages: number; activeTids: string[]; at: number } | null;
  clearLastCrash: () => void;
  pendingQuery: string | null;
  setPendingQuery: (q: string | null) => void;
  recoveryResult: RecoveryResult | null;
  clearRecoveryResult: () => void;
  clearWal: () => Promise<void>;
  loadDemo: () => Promise<void>;
  executeQuery: (engineId: string, query: string, tid?: string) => Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
    isMutation?: boolean;
  }>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [currentTid, setCurrentTid] = useState('');
  const [protocol, setProtocolState] = useState<RecoveryProtocol>('No-Undo/Redo');
  const [activeTransactions, setActiveTransactions] = useState<Array<{ tid: string; engineId: string; status: string }>>([]);
  const [dirtyPages, setDirtyPages] = useState<Array<[string, MutationData]>>([]);
  const [walEntries, setWalEntries] = useState<WalEntry[]>([]);
  const [selectedTid, setSelectedTid] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'query' | 'transaction' | 'recovery'>('query');
  const [allTransactions, setAllTransactions] = useState<DisplayTransaction[]>([]);
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null);
  const [lastCrash, setLastCrash] = useState<{ droppedPages: number; activeTids: string[]; at: number } | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  function reconstructTransactions(entries: WalEntry[]): DisplayTransaction[] {
    const grouped = new Map<string, WalEntry[]>();
    for (const entry of entries) {
      const existing = grouped.get(entry.tid) ?? [];
      existing.push(entry);
      grouped.set(entry.tid, existing);
    }
    const result: DisplayTransaction[] = [];
    for (const [tid, txEntries] of grouped) {
      const hasCommit = txEntries.some((e) => e.op === 'COMMIT');
      const hasAbort = txEntries.some((e) => e.op === 'ABORT');
      let status: TxStatus;
      if (hasCommit) status = 'COMMITTED';
      else if (hasAbort) status = 'ABORTED';
      else status = 'PENDIENTE';
      result.push({
        tid,
        engineId: txEntries[0]?.engine_id ?? 'unknown',
        status,
      });
    }
    return result;
  }

  const refreshStatus = useCallback(async () => {
    const status = await window.api.getTransactionStatus();
    setProtocolState(status.protocol);
    setActiveTransactions(status.activeTransactions);
    setDirtyPages(status.dirtyPages as Array<[string, MutationData]>);
  }, []);

  useEffect(() => {
    const unsub = window.api.onWalEntry((entry: WalEntry) => {
      setWalEntries((prev) => [...prev, entry]);
    });
    window.api.getWalLogs().then((entries) => {
      setWalEntries(entries as WalEntry[]);
    });
    refreshStatus();
    return () => {
      unsub();
    };
  }, [refreshStatus]);

  useEffect(() => {
    const reconstructed = reconstructTransactions(walEntries);
    const merged: DisplayTransaction[] = reconstructed.map((r) => {
      const active = activeTransactions.find((a) => a.tid === r.tid);
      if (active) {
        return { ...r, status: active.status as TxStatus };
      }
      return r;
    });
    setAllTransactions(merged);
  }, [walEntries, activeTransactions]);

  const begin = useCallback(async (tid: string, engineId: string) => {
    const result = await window.api.beginTransaction(tid, engineId);
    if (result.success) {
      setSelectedTid(tid);
    }
    await refreshStatus();
    return result;
  }, [refreshStatus]);

  const execute = useCallback(async (tid: string, mutationData: MutationData) => {
    const result = await window.api.executeTx(tid, mutationData);
    await refreshStatus();
    return result;
  }, [refreshStatus]);

  const commit = useCallback(async (tid: string) => {
    const result = await window.api.commitTransaction(tid);
    await refreshStatus();
    return result;
  }, [refreshStatus]);

  const rollback = useCallback(async (tid: string) => {
    const result = await window.api.rollbackTransaction(tid);
    await refreshStatus();
    return result;
  }, [refreshStatus]);

  const setProtocol = useCallback(async (p: RecoveryProtocol) => {
    await window.api.setProtocol(p);
    setProtocolState(p);
  }, []);

  const triggerCrash = useCallback(async () => {
    const result = await window.api.triggerCrash();
    setLastCrash({ droppedPages: result.droppedPages, activeTids: result.activeTids, at: Date.now() });
    setSelectedTid(null);
    await refreshStatus();
    return { droppedPages: result.droppedPages, activeTids: result.activeTids };
  }, [refreshStatus]);

  const clearLastCrash = useCallback(() => setLastCrash(null), []);

  const triggerRecovery = useCallback(async () => {
    const result = await window.api.triggerRecovery();
    const stamped: RecoveryResult = { ...result, ranAt: Date.now() };
    setRecoveryResult(stamped);
    await refreshStatus();
    const entries = await window.api.getWalLogs();
    setWalEntries(entries as WalEntry[]);
    return stamped;
  }, [refreshStatus]);

  const clearRecoveryResult = useCallback(() => setRecoveryResult(null), []);

  const clearWal = useCallback(async () => {
    await window.api.clearWal();
    setWalEntries([]);
    setAllTransactions([]);
  }, []);

  const loadDemo = useCallback(async () => {
    await window.api.loadDemo();
    await refreshStatus();
    const entries = await window.api.getWalLogs();
    setWalEntries(entries as WalEntry[]);
  }, [refreshStatus]);

  const executeQuery = useCallback(async (engineId: string, query: string, tid?: string) => {
    const result = await window.api.executeQuery(engineId, query, tid);
    await refreshStatus();
    return result;
  }, [refreshStatus]);

  return (
    <TransactionContext.Provider value={{
      currentTid,
      protocol,
      allTransactions,
      dirtyPages,
      walEntries,
      selectedTid,
      activeView,
      setTid: setCurrentTid,
      setSelectedTid,
      setActiveView,
      begin,
      execute,
      commit,
      rollback,
      setProtocol,
      triggerCrash,
      lastCrash,
      clearLastCrash,
      pendingQuery,
      setPendingQuery,
      triggerRecovery,
      recoveryResult,
      clearRecoveryResult,
      clearWal,
      loadDemo,
      executeQuery,
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error('useTransaction must be used within TransactionProvider');
  return ctx;
}
import type { EngineConfig, EngineType, MutationData, RecoveryProtocol } from '../../../electron/types';

export interface WalEntry {
  tid: string;
  op: 'BEGIN' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COMMIT' | 'ABORT';
  table_or_collection?: string;
  before_image: Record<string, unknown> | null;
  after_image: Record<string, unknown> | null;
  timestamp: number;
  engine_id: string;
}

export interface IElectronAPI {
  connectEngine(engineId: string, type: EngineType, config: EngineConfig): Promise<{ success: boolean; engineId: string }>;
  disconnectEngine(engineId: string): Promise<{ success: boolean }>;
  listEngines(): Promise<Array<{ id: string; type: EngineType; status: string; config: EngineConfig }>>;
  beginTransaction(tid: string, engineId: string): Promise<{ success: boolean; tid?: string; error?: string }>;
  executeTx(tid: string, mutationData: MutationData): Promise<{ success: boolean; error?: string }>;
  commitTransaction(tid: string): Promise<{ success: boolean; tid?: string; error?: string }>;
  rollbackTransaction(tid: string): Promise<{ success: boolean; tid?: string; error?: string }>;
  setProtocol(protocol: RecoveryProtocol): Promise<{ success: boolean; protocol: string }>;
  getTransactionStatus(): Promise<{
    protocol: RecoveryProtocol;
    activeTransactions: Array<{ tid: string; engineId: string; status: string }>;
    dirtyPages: Array<[string, MutationData]>;
  }>;
  getWalLogs(filters?: { tid?: string; startTime?: number; endTime?: number }): Promise<WalEntry[]>;
  clearWal(): Promise<{ success: boolean }>;
  triggerCrash(): Promise<{ success: boolean }>;
  triggerRecovery(): Promise<{ beforeState: unknown; afterState: unknown }>;
  onWalEntry(callback: (entry: WalEntry) => void): () => void;
  loadDemo(): Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
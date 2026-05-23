import { WalManager, LogEntry } from './WalManager';
import { ConnectionManager } from '../engines/ConnectionManager';
import type { RecoveryProtocol as RecoveryProtocolType, DataSnapshot, MutationData } from '../types';

export type RecoveryProtocol = RecoveryProtocolType;

interface TransactionState {
  tid: string;
  engineId: string;
  status: 'ACTIVE' | 'COMMITTED' | 'ABORTED';
}

export class TransactionManager {
  private wal: WalManager;
  private connectionManager: ConnectionManager;
  private currentProtocol: RecoveryProtocol = 'No-Undo/Redo';
  private dirtyPagesBuffer: Map<string, MutationData> = new Map();
  private activeTransactions: Map<string, TransactionState> = new Map();

  constructor(wal: WalManager, connectionManager: ConnectionManager) {
    this.wal = wal;
    this.connectionManager = connectionManager;
  }

  public setProtocol(protocol: RecoveryProtocol): void {
    this.currentProtocol = protocol;
  }

  public getProtocol(): RecoveryProtocol {
    return this.currentProtocol;
  }

  public beginTransaction(tid: string, engineId: string): void {
    this.wal.writeEntry({
      tid,
      op: 'BEGIN',
      engine_id: engineId,
      before_image: null,
      after_image: null,
      protocol: this.currentProtocol,
    });
    this.activeTransactions.set(tid, {
      tid,
      engineId,
      status: 'ACTIVE',
    });
  }

  public executeMutationSimulated(tid: string, mutationData: MutationData): void {
    const txState = this.activeTransactions.get(tid);
    if (!txState) {
      throw new Error(`Transaction ${tid} not found. Begin a transaction first.`);
    }

    this.wal.writeEntry({
      tid,
      op: mutationData.op,
      table_or_collection: mutationData.table_or_collection,
      before_image: mutationData.before_image,
      after_image: mutationData.after_image,
      engine_id: txState.engineId,
    });

    const protocol = this.currentProtocol;
    const bufferKey = `${tid}:${mutationData.op}:${Date.now()}`;

    if (protocol === 'No-Undo/No-Redo') {
      this.flushToDisk(tid, mutationData);
    } else if (protocol === 'No-Undo/Redo') {
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    } else if (protocol === 'Undo/No-Redo') {
      this.flushToDisk(tid, mutationData);
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    } else if (protocol === 'Undo/Redo') {
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    }
  }

  public commitTransaction(tid: string): void {
    const txState = this.activeTransactions.get(tid);
    if (!txState) {
      throw new Error(`Transaction ${tid} not found. Begin a transaction first.`);
    }

    this.wal.writeEntry({
      tid,
      op: 'COMMIT',
      engine_id: txState.engineId,
      before_image: null,
      after_image: null,
    });

    const protocol = this.currentProtocol;

    if (protocol === 'No-Undo/Redo' || protocol === 'Undo/Redo') {
      this.flushDirtyPages(tid);
    }

    this.activeTransactions.set(tid, { ...txState, status: 'COMMITTED' });
    this.clearDirtyPagesForTransaction(tid);
  }

  public rollbackTransaction(tid: string): void {
    const txState = this.activeTransactions.get(tid);
    if (!txState) {
      throw new Error(`Transaction ${tid} not found. Begin a transaction first.`);
    }

    this.wal.writeEntry({
      tid,
      op: 'ABORT',
      engine_id: txState.engineId,
      before_image: null,
      after_image: null,
    });

    const protocol = this.currentProtocol;

    if (protocol === 'Undo/No-Redo' || protocol === 'Undo/Redo') {
      this.undoCommittedWrites(tid);
    }

    this.activeTransactions.set(tid, { ...txState, status: 'ABORTED' });
    this.clearDirtyPagesForTransaction(tid);
  }

  public injectControlledCrash(): void {
    this.dirtyPagesBuffer.clear();
  }

  public runRecoveryProcedure(): { beforeState: TransactionState[]; afterState: TransactionState[] } {
    const allEntries = this.wal.getEntries({});
    const beforeState = this.captureCurrentState();

    const committedTids = new Set<string>();
    const activeTids = new Set<string>();

    for (const entry of allEntries) {
      if (entry.op === 'BEGIN') {
        activeTids.add(entry.tid);
      }
      if (entry.op === 'COMMIT') {
        committedTids.add(entry.tid);
        activeTids.delete(entry.tid);
      }
      if (entry.op === 'ABORT') {
        activeTids.delete(entry.tid);
      }
    }

    const undoList = new Set(activeTids);
    const redoList = new Set(committedTids);

    const protocol = this.currentProtocol;
    const needsUndo = protocol === 'Undo/No-Redo' || protocol === 'Undo/Redo';
    const needsRedo = protocol === 'No-Undo/Redo' || protocol === 'Undo/Redo';

    if (needsUndo) {
      const undoEntries = allEntries
        .filter((e) => undoList.has(e.tid) && e.before_image !== null)
        .reverse();

      for (const entry of undoEntries) {
        this.applyChange(entry.engine_id, entry.table_or_collection, entry.before_image);
      }
    }

    if (needsRedo) {
      const redoEntries = allEntries
        .filter((e) => redoList.has(e.tid) && e.after_image !== null);

      for (const entry of redoEntries) {
        this.applyChange(entry.engine_id, entry.table_or_collection, entry.after_image);
      }
    }

    for (const tid of undoList) {
      this.activeTransactions.delete(tid);
    }

    const afterState = this.captureCurrentState();
    return { beforeState, afterState };
  }

  public getActiveTransactions(): TransactionState[] {
    return Array.from(this.activeTransactions.values());
  }

  public getDirtyPages(): Map<string, MutationData> {
    return new Map(this.dirtyPagesBuffer);
  }

  private flushToDisk(tid: string, mutationData: MutationData): void {
    const txState = this.activeTransactions.get(tid);
    if (!txState) return;
    const engine = this.connectionManager.getEngine(txState.engineId);
    if (engine) {
      // TODO: Build actual SQL/operation from mutationData and execute via engine
      void engine;
      void mutationData;
    }
  }

  private flushDirtyPages(tid: string): void {
    for (const [key, value] of this.dirtyPagesBuffer) {
      if (key.startsWith(`${tid}:`)) {
        this.flushToDisk(tid, value);
      }
    }
  }

  private clearDirtyPagesForTransaction(tid: string): void {
    for (const key of this.dirtyPagesBuffer.keys()) {
      if (key.startsWith(`${tid}:`)) {
        this.dirtyPagesBuffer.delete(key);
      }
    }
  }

  private undoCommittedWrites(tid: string): void {
    const entries = this.wal.getEntries({ tid });
    const mutationEntries = entries
      .filter((e: LogEntry) =>
        (e.op === 'INSERT' || e.op === 'UPDATE' || e.op === 'DELETE') &&
        e.before_image !== null
      )
      .reverse();

    for (const entry of mutationEntries) {
      this.applyChange(entry.engine_id, entry.table_or_collection, entry.before_image);
    }
  }

  private applyChange(_engineId: string, _tableOrCollection: string | undefined, _data: DataSnapshot): void {
    // TODO: Build and execute the appropriate inverse or reapply operation via the engine
  }

  private captureCurrentState(): TransactionState[] {
    return Array.from(this.activeTransactions.values());
  }
}
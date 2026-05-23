import { WalManager, LogEntry } from './WalManager';
import { ConnectionManager } from '../engines/ConnectionManager';
import type { RecoveryProtocol as RecoveryProtocolType, DataSnapshot, MutationData } from '../types';
import { parseMutationQuery, buildBeforeImageQuery, buildAfterImage, buildMutationSql } from './QueryParser';

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

    if (protocol === 'No-Undo/Redo' || protocol === 'Undo/Redo') {
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    }
  }

  public async executeMutationFromQuery(tid: string, engineId: string, query: string): Promise<MutationData> {
    const txState = this.activeTransactions.get(tid);
    if (!txState) {
      throw new Error(`Transaction ${tid} not found. Begin a transaction first.`);
    }

    const engine = this.connectionManager.getEngine(engineId);
    if (!engine) {
      throw new Error(`Engine ${engineId} not connected`);
    }

    const parsed = parseMutationQuery(query);
    if (!parsed) {
      throw new Error(`Invalid mutation query: ${query}`);
    }

    let beforeImage: DataSnapshot = null;
    if (parsed.op !== 'INSERT') {
      const beforeQuery = buildBeforeImageQuery(parsed);
      if (beforeQuery) {
        const result = await engine.executeQuery(beforeQuery);
        if (result.success && result.data) {
          if (Array.isArray(result.data) && result.data.length > 0) {
            beforeImage = result.data[0] as DataSnapshot;
          } else if (result.data && typeof result.data === 'object') {
            beforeImage = result.data as DataSnapshot;
          }
        }
      }
    }

    const afterImage = buildAfterImage(beforeImage, parsed);

    const mutationData: MutationData = {
      op: parsed.op,
      table_or_collection: parsed.tableOrCollection,
      before_image: beforeImage,
      after_image: afterImage,
    };

    this.wal.writeEntry({
      tid,
      op: mutationData.op,
      table_or_collection: mutationData.table_or_collection,
      before_image: mutationData.before_image,
      after_image: mutationData.after_image,
      engine_id: engineId,
    });

    const protocol = this.currentProtocol;
    const bufferKey = `${tid}:${mutationData.op}:${Date.now()}`;

    if (protocol === 'No-Undo/No-Redo') {
      await this.flushToDisk(tid, mutationData, parsed);
    } else if (protocol === 'No-Undo/Redo') {
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    } else if (protocol === 'Undo/No-Redo') {
      await this.flushToDisk(tid, mutationData, parsed);
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    } else if (protocol === 'Undo/Redo') {
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    }

    return mutationData;
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

  public reconstructFromWal(): void {
    const entries = this.wal.getEntries({});
    const grouped = new Map<string, LogEntry[]>();
    for (const entry of entries) {
      const existing = grouped.get(entry.tid) ?? [];
      existing.push(entry);
      grouped.set(entry.tid, existing);
    }
    this.activeTransactions.clear();
    for (const [tid, txEntries] of grouped) {
      const hasCommit = txEntries.some((e) => e.op === 'COMMIT');
      const hasAbort = txEntries.some((e) => e.op === 'ABORT');
      const status: 'ACTIVE' | 'COMMITTED' | 'ABORTED' =
        hasCommit ? 'COMMITTED' : hasAbort ? 'ABORTED' : 'ACTIVE';
      const engineId = txEntries[0]?.engine_id ?? 'unknown';
      this.activeTransactions.set(tid, { tid, engineId, status });
    }
  }

  public getProtocolFromWal(): RecoveryProtocol | null {
    const entries = this.wal.getEntries({});
    const beginEntries = entries.filter((e) => e.op === 'BEGIN');
    if (beginEntries.length === 0) return null;
    const mostRecent = beginEntries.sort((a, b) => b.timestamp - a.timestamp)[0];
    return (mostRecent.protocol as RecoveryProtocol) ?? null;
  }

  private async flushToDisk(tid: string, mutationData: MutationData, parsed?: ReturnType<typeof parseMutationQuery>): Promise<void> {
    const txState = this.activeTransactions.get(tid);
    if (!txState) return;
    const engine = this.connectionManager.getEngine(txState.engineId);
    if (!engine) return;

    if (parsed) {
      const sql = buildMutationSql(parsed);
      if (sql) {
        await engine.executeQuery(sql);
      }
    } else {
      const sql = buildMutationSql({
        op: mutationData.op,
        tableOrCollection: mutationData.table_or_collection || '',
        setClause: mutationData.after_image as Record<string, unknown>,
        filter: mutationData.before_image as Record<string, unknown>,
        isMongo: false,
      });
      if (sql) {
        await engine.executeQuery(sql);
      }
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
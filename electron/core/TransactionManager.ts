import { WalManager, LogEntry } from './WalManager';
import { ConnectionManager } from '../engines/ConnectionManager';
import type { RecoveryProtocol as RecoveryProtocolType, DataSnapshot, MutationData, DirtyPageEntry } from '../types';
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
  private dirtyPagesBuffer: Map<string, DirtyPageEntry> = new Map();
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
      this.dirtyPagesBuffer.set(bufferKey, {
        op: mutationData.op,
        table_or_collection: mutationData.table_or_collection || '',
        before_image: mutationData.before_image,
        after_image: mutationData.after_image,
        parsedSql: buildMutationSql(this.synthesizeParsedFromMutation(mutationData)),
        isMongo: false,
      });
    }
  }

  private synthesizeParsedFromMutation(mutationData: MutationData) {
    const table = mutationData.table_or_collection || '';
    if (mutationData.op === 'INSERT') {
      const values = (mutationData.after_image as Record<string, unknown> | null) || {};
      return {
        op: 'INSERT' as const,
        tableOrCollection: table,
        insertValues: values,
        insertColumns: Object.keys(values),
        isMongo: false,
      };
    }
    if (mutationData.op === 'DELETE') {
      return {
        op: 'DELETE' as const,
        tableOrCollection: table,
        filter: (mutationData.before_image as Record<string, unknown> | null) || {},
        isMongo: false,
      };
    }
    return {
      op: 'UPDATE' as const,
      tableOrCollection: table,
      setClause: (mutationData.after_image as Record<string, unknown> | null) || {},
      filter: (mutationData.before_image as Record<string, unknown> | null) || {},
      isMongo: false,
    };
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
      await this.flushToDisk(tid, {
        op: parsed.op,
        table_or_collection: parsed.tableOrCollection,
        before_image: mutationData.before_image,
        after_image: mutationData.after_image,
        parsedSql: buildMutationSql(parsed),
        isMongo: parsed.isMongo,
      });
    } else if (protocol === 'No-Undo/Redo') {
      this.dirtyPagesBuffer.set(bufferKey, {
        op: mutationData.op,
        table_or_collection: mutationData.table_or_collection || '',
        before_image: mutationData.before_image,
        after_image: mutationData.after_image,
        parsedSql: buildMutationSql(parsed),
        isMongo: parsed.isMongo,
      });
    } else if (protocol === 'Undo/No-Redo') {
      await this.flushToDisk(tid, {
        op: parsed.op,
        table_or_collection: parsed.tableOrCollection,
        before_image: mutationData.before_image,
        after_image: mutationData.after_image,
        parsedSql: buildMutationSql(parsed),
        isMongo: parsed.isMongo,
      });
      this.dirtyPagesBuffer.set(bufferKey, {
        op: mutationData.op,
        table_or_collection: mutationData.table_or_collection || '',
        before_image: mutationData.before_image,
        after_image: mutationData.after_image,
        parsedSql: buildMutationSql(parsed),
        isMongo: parsed.isMongo,
      });
    } else if (protocol === 'Undo/Redo') {
      this.dirtyPagesBuffer.set(bufferKey, {
        op: mutationData.op,
        table_or_collection: mutationData.table_or_collection || '',
        before_image: mutationData.before_image,
        after_image: mutationData.after_image,
        parsedSql: buildMutationSql(parsed),
        isMongo: parsed.isMongo,
      });
    }

    return mutationData;
  }

  public async commitTransaction(tid: string): Promise<void> {
    const txState = this.activeTransactions.get(tid);
    if (!txState) {
      throw new Error(`Transaction ${tid} not found. Begin a transaction first.`);
    }

    const protocol = this.currentProtocol;

    if (protocol === 'No-Undo/Redo' || protocol === 'Undo/Redo') {
      console.debug(`Flushing dirty pages for transaction ${tid} before commit...`);
      await this.flushDirtyPages(tid);
    }

    this.wal.writeEntry({
      tid,
      op: 'COMMIT',
      engine_id: txState.engineId,
      before_image: null,
      after_image: null,
      protocol: this.currentProtocol,
    });

    this.activeTransactions.set(tid, { ...txState, status: 'COMMITTED' });
    this.clearDirtyPagesForTransaction(tid);
  }

  public async rollbackTransaction(tid: string): Promise<void> {
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
      await this.undoCommittedWrites(tid);
    }

    this.activeTransactions.set(tid, { ...txState, status: 'ABORTED' });
    this.clearDirtyPagesForTransaction(tid);
  }

  public injectControlledCrash(): { droppedPages: number; activeTids: string[] } {
    const droppedPages = this.dirtyPagesBuffer.size;
    const activeTids = Array.from(this.activeTransactions.values())
      .filter((t) => t.status === 'ACTIVE')
      .map((t) => t.tid);
    this.dirtyPagesBuffer.clear();
    return { droppedPages, activeTids };
  }

  public async runRecoveryProcedure(): Promise<{
    beforeState: TransactionState[];
    afterState: TransactionState[];
    undoneTids: string[];
    redoneTids: string[];
    walEntriesProcessed: number;
    protocol: RecoveryProtocol;
    dataBefore: Array<{ key: string; engineId: string; table: string; rows: unknown[] }>;
    dataAfter: Array<{ key: string; engineId: string; table: string; rows: unknown[] }>;
  }> {
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

    const isMutation = (e: LogEntry) =>
      e.op === 'INSERT' || e.op === 'UPDATE' || e.op === 'DELETE';

    // Snapshot de tablas/colecciones afectadas antes de aplicar UNDO/REDO
    const affectedTargets = new Map<string, { engineId: string; table: string }>();
    for (const e of allEntries) {
      if (!isMutation(e) || !e.table_or_collection) continue;
      if (undoList.has(e.tid) || redoList.has(e.tid)) {
        const key = `${e.engine_id}::${e.table_or_collection}`;
        affectedTargets.set(key, { engineId: e.engine_id, table: e.table_or_collection });
      }
    }

    const snapshotAll = async () => {
      const out: Array<{ key: string; engineId: string; table: string; rows: unknown[] }> = [];
      for (const [key, { engineId, table }] of affectedTargets) {
        const rows = await this.snapshotTarget(engineId, table);
        out.push({ key, engineId, table, rows });
      }
      return out;
    };

    const dataBefore = await snapshotAll();

    if (needsUndo) {
      const undoEntries = allEntries
        .filter((e) => undoList.has(e.tid) && isMutation(e))
        .reverse();
      for (const entry of undoEntries) {
        await this.applyChange(entry, 'before');
      }
    }

    if (needsRedo) {
      const redoEntries = allEntries
        .filter((e) => redoList.has(e.tid) && isMutation(e));
      for (const entry of redoEntries) {
        await this.applyChange(entry, 'after');
      }
    }

    for (const tid of undoList) {
      this.activeTransactions.delete(tid);
    }

    const afterState = this.captureCurrentState();
    const dataAfter = await snapshotAll();

    return {
      beforeState,
      afterState,
      undoneTids: needsUndo ? Array.from(undoList) : [],
      redoneTids: needsRedo ? Array.from(redoList) : [],
      walEntriesProcessed: allEntries.length,
      protocol,
      dataBefore,
      dataAfter,
    };
  }

  private async snapshotTarget(engineId: string, table: string): Promise<unknown[]> {
    const engine = this.connectionManager.getEngine(engineId);
    if (!engine) return [];
    const conn = this.connectionManager.getConnection(engineId);
    const isMongo = conn?.type === 'nosql';
    const query = isMongo
      ? `db.${table}.find({})`
      : `SELECT * FROM ${table} LIMIT 100`;
    try {
      const result = await engine.executeQuery(query);
      if (!result.success || !result.data) return [];
      if (Array.isArray(result.data)) return result.data;
      return [result.data];
    } catch {
      return [];
    }
  }

  public getActiveTransactions(): TransactionState[] {
    return Array.from(this.activeTransactions.values());
  }

  public getDirtyPages(): Map<string, DirtyPageEntry> {
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

  private async flushToDisk(tid: string, entry: DirtyPageEntry): Promise<void> {
    const txState = this.activeTransactions.get(tid);
    if (!txState) return;
    const engine = this.connectionManager.getEngine(txState.engineId);
    if (!engine) return;

    if (entry.parsedSql) {
      await engine.executeQuery(entry.parsedSql);
    }
  }

  private async flushDirtyPages(tid: string): Promise<void> {
    for (const [key, value] of this.dirtyPagesBuffer) {
      if (key.startsWith(`${tid}:`)) {
        await this.flushToDisk(tid, value);
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

  private async undoCommittedWrites(tid: string): Promise<void> {
    const entries = this.wal.getEntries({ tid });
    const mutationEntries = entries
      .filter((e: LogEntry) =>
        e.op === 'INSERT' || e.op === 'UPDATE' || e.op === 'DELETE'
      )
      .reverse();

    for (const entry of mutationEntries) {
      await this.applyChange(entry, 'before');
    }
  }

  private pickFilter(snapshot: Record<string, unknown>, isMongo = false): Record<string, unknown> {
    // En Mongo evitamos _id porque al round-tripear por IPC pierde el tipo ObjectId.
    const preferred = isMongo
      ? ['carne', 'codigo', 'pk', 'uuid', 'id']
      : ['id', '_id', 'carne', 'codigo', 'pk', 'uuid'];
    for (const k of preferred) {
      if (k in snapshot && snapshot[k] !== undefined && snapshot[k] !== null) {
        return { [k]: snapshot[k] };
      }
    }
    for (const k of Object.keys(snapshot)) {
      if (k === '_id') continue;
      const v = snapshot[k];
      if (v !== undefined && v !== null) return { [k]: v };
    }
    return {};
  }

  private stripImmutableKeys(row: Record<string, unknown>, isMongo: boolean): Record<string, unknown> {
    if (!isMongo) return row;
    const { _id, ...rest } = row;
    void _id;
    return rest;
  }

  private async applyChange(entry: LogEntry, target: 'before' | 'after'): Promise<void> {
    if (!entry.table_or_collection) return;
    const engine = this.connectionManager.getEngine(entry.engine_id);
    if (!engine) return;
    const conn = this.connectionManager.getConnection(entry.engine_id);
    const isMongo = conn?.type === 'nosql';
    const table = entry.table_or_collection;

    let sql = '';

    if (target === 'after') {
      if (entry.op === 'INSERT' && entry.after_image) {
        const row = entry.after_image as Record<string, unknown>;
        sql = buildMutationSql({
          op: 'INSERT',
          tableOrCollection: table,
          insertValues: row,
          insertColumns: Object.keys(row),
          isMongo,
        });
      } else if (entry.op === 'UPDATE' && entry.after_image && entry.before_image) {
        sql = buildMutationSql({
          op: 'UPDATE',
          tableOrCollection: table,
          setClause: this.stripImmutableKeys(entry.after_image as Record<string, unknown>, isMongo),
          filter: this.pickFilter(entry.before_image as Record<string, unknown>, isMongo),
          isMongo,
        });
      } else if (entry.op === 'DELETE' && entry.before_image) {
        sql = buildMutationSql({
          op: 'DELETE',
          tableOrCollection: table,
          filter: this.pickFilter(entry.before_image as Record<string, unknown>, isMongo),
          isMongo,
        });
      }
    } else {
      if (entry.op === 'INSERT' && entry.after_image) {
        sql = buildMutationSql({
          op: 'DELETE',
          tableOrCollection: table,
          filter: this.pickFilter(entry.after_image as Record<string, unknown>, isMongo),
          isMongo,
        });
      } else if (entry.op === 'UPDATE' && entry.before_image && entry.after_image) {
        sql = buildMutationSql({
          op: 'UPDATE',
          tableOrCollection: table,
          setClause: this.stripImmutableKeys(entry.before_image as Record<string, unknown>, isMongo),
          filter: this.pickFilter(entry.after_image as Record<string, unknown>, isMongo),
          isMongo,
        });
      } else if (entry.op === 'DELETE' && entry.before_image) {
        const row = this.stripImmutableKeys(entry.before_image as Record<string, unknown>, isMongo);
        sql = buildMutationSql({
          op: 'INSERT',
          tableOrCollection: table,
          insertValues: row,
          insertColumns: Object.keys(row),
          isMongo,
        });
      }
    }

    if (sql) {
      const result = await engine.executeQuery(sql);
      if (!result.success) {
        console.warn(`Recovery applyChange failed for ${entry.op} (${target}) on ${table}: ${result.error}`);
      } else {
        console.debug(`Recovery applyChange ok [${target}] [${entry.op}]: ${sql}`);
      }
    }
  }

  private captureCurrentState(): TransactionState[] {
    return Array.from(this.activeTransactions.values());
  }
}
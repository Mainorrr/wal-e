import { ipcMain, BrowserWindow } from 'electron';
import { ConnectionManager } from './engines/ConnectionManager';
import { WalManager, LogEntry } from './core/WalManager';
import { TransactionManager } from './core/TransactionManager';
import { isMutationQuery } from './core/QueryParser';
import type { EngineConfig, EngineType, RecoveryProtocol, MutationData } from './types';

let connectionManager: ConnectionManager;
let walManager: WalManager;
let transactionManager: TransactionManager;
let mainWindow: BrowserWindow | null = null;

export function initServices(): void {
  connectionManager = new ConnectionManager();
  walManager = new WalManager();
  transactionManager = new TransactionManager(walManager, connectionManager);

  transactionManager.reconstructFromWal();
  const lastProtocol = transactionManager.getProtocolFromWal();
  if (lastProtocol) transactionManager.setProtocol(lastProtocol);

  walManager.onEntry((entry: LogEntry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wal:entry', entry);
    }
  });
}

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

export { connectionManager, walManager, transactionManager };

export function setupIPCHandlers(): void {
  ipcMain.handle('engine:connect', async (_event, args: { engineId: string; type: EngineType; config: EngineConfig }) => {
    const { engineId, type, config } = args;
    const success = await connectionManager.connect(engineId, type, config);
    return { success, engineId };
  });

  ipcMain.handle('engine:disconnect', async (_event, args: { engineId: string }) => {
    const { engineId } = args;
    await connectionManager.disconnect(engineId);
    return { success: true };
  });

  ipcMain.handle('engine:list', async () => {
    return connectionManager.getAllConnections();
  });

  ipcMain.handle('tx:begin', async (_event, args: { tid: string; engineId: string }) => {
    const { tid, engineId } = args;
    try {
      transactionManager.beginTransaction(tid, engineId);
      return { success: true, tid };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('tx:execute', async (_event, args: { tid: string; mutationData: MutationData }) => {
    const { tid, mutationData } = args;
    try {
      console.log(`Executing mutation in transaction ${tid}: ${JSON.stringify(mutationData)}`);
      transactionManager.executeMutationSimulated(tid, mutationData);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('tx:commit', async (_event, args: { tid: string }) => {
    const { tid } = args;
    try {
      await transactionManager.commitTransaction(tid);
      return { success: true, tid };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('tx:rollback', async (_event, args: { tid: string }) => {
    const { tid } = args;
    try {
      await transactionManager.rollbackTransaction(tid);
      return { success: true, tid };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('tx:set-protocol', async (_event, args: { protocol: RecoveryProtocol }) => {
    const { protocol } = args;
    transactionManager.setProtocol(protocol);
    return { success: true, protocol };
  });

  ipcMain.handle('tx:status', async () => {
    return {
      protocol: transactionManager.getProtocol(),
      activeTransactions: transactionManager.getActiveTransactions(),
      dirtyPages: Array.from(transactionManager.getDirtyPages().entries()),
    };
  });

  ipcMain.handle('tx:reconstruct', async () => {
    transactionManager.reconstructFromWal();
    return { success: true, activeTransactions: transactionManager.getActiveTransactions() };
  });

  ipcMain.handle('wal:get-logs', async (_event, filters: { tid?: string; startTime?: number; endTime?: number }) => {
    return walManager.getEntries(filters ?? {});
  });

  ipcMain.handle('wal:clear', async () => {
    walManager.clearLog();
    return { success: true };
  });

  ipcMain.handle('query:execute', async (_event, args: { engineId: string; query: string; tid?: string }) => {
    const { engineId, query, tid } = args;
    const engine = connectionManager.getEngine(engineId);
    if (!engine) {
      return { success: false, error: `Engine ${engineId} not connected` };
    }

    console.log(`Received query execution request for engine ${engineId}: ${query} (tid: ${tid})`);

    const statements = splitSqlStatements(query);

    if (statements.length > 1) {
      const results: unknown[] = [];
      let anyMutation = false;
      let lastCommand: string | undefined;
      let lastRowCount: number | undefined;
      for (const stmt of statements) {
        const isMut = isMutationQuery(stmt);
        console.log(`Statement (${isMut ? 'mutation' : 'non-mutation'}): ${stmt}`);
        if (isMut && tid) {
          try {
            const mutationData = await transactionManager.executeMutationFromQuery(tid, engineId, stmt);
            results.push(mutationData);
            anyMutation = true;
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Statement failed: ${stmt}\n${message}` };
          }
        } else {
          const r = await engine.executeQuery(stmt);
          if (!r.success) {
            return { success: false, error: `Statement failed: ${stmt}\n${r.error}` };
          }
          results.push(r.data);
          lastCommand = r.command;
          lastRowCount = r.rowCount;
        }
      }
      return {
        success: true,
        data: results[results.length - 1],
        isMutation: anyMutation,
        command: lastCommand,
        rowCount: lastRowCount,
      };
    }

    const single = statements[0] ?? query;
    console.log(isMutationQuery(single) ? 'Identified as mutation query' : 'Identified as non-mutation query');
    if (isMutationQuery(single) && tid) {
      try {
        const mutationData = await transactionManager.executeMutationFromQuery(tid, engineId, single);
        return { success: true, data: mutationData, isMutation: true };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    }
    return engine.executeQuery(single);
  });

  ipcMain.handle('system:crash', async () => {
    const result = transactionManager.injectControlledCrash();
    return { success: true, ...result };
  });

  ipcMain.handle('system:recover', async () => {
    const result = await transactionManager.runRecoveryProcedure();
    return result;
  });

  ipcMain.handle('demo:seed', async () => {
    const engineId = 'postgresql-nodo-01';
    await connectionManager.connect(engineId, 'relational', {
      host: 'localhost',
      port: 5432,
      database: 'wal_e',
      user: 'postgres',
      password: 'postgres',
    });

    transactionManager.setProtocol('Undo/Redo');

    const tid1 = 'TX-DEMO-001';
    transactionManager.beginTransaction(tid1, engineId);
    transactionManager.executeMutationSimulated(tid1, {
      op: 'INSERT',
      table_or_collection: 'estudiantes',
      before_image: null,
      after_image: { id: 1, nombre: 'Maria Lopez', nota: 92 },
    });
    transactionManager.executeMutationSimulated(tid1, {
      op: 'UPDATE',
      table_or_collection: 'estudiantes',
      before_image: { id: 1, nota: 88 },
      after_image: { id: 1, nota: 95 },
    });
    transactionManager.commitTransaction(tid1);

    const tid2 = 'TX-DEMO-002';
    transactionManager.beginTransaction(tid2, engineId);
    transactionManager.executeMutationSimulated(tid2, {
      op: 'INSERT',
      table_or_collection: 'estudiantes',
      before_image: null,
      after_image: { id: 2, nombre: 'Carlos Perez', nota: 78 },
    });

    return { success: true };
  });
}
function splitSqlStatements(query: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  const isMongoLike = /^\s*db\./.test(query);
  if (isMongoLike) return [query.trim()].filter(Boolean);
  for (let i = 0; i < query.length; i++) {
    const c = query[i];
    if (!inQuote && (c === "'" || c === `"`)) {
      inQuote = true;
      quoteChar = c;
      current += c;
    } else if (inQuote && c === quoteChar) {
      inQuote = false;
      quoteChar = "";
      current += c;
    } else if (!inQuote && c === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
    } else {
      current += c;
    }
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

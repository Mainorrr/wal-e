import { ipcMain, BrowserWindow } from 'electron';
import { ConnectionManager } from './engines/ConnectionManager';
import { WalManager, LogEntry } from './core/WalManager';
import { TransactionManager } from './core/TransactionManager';
import type { EngineConfig, EngineType, RecoveryProtocol, MutationData } from './types';

let connectionManager: ConnectionManager;
let walManager: WalManager;
let transactionManager: TransactionManager;
let mainWindow: BrowserWindow | null = null;

export function initServices(): void {
  connectionManager = new ConnectionManager();
  walManager = new WalManager();
  transactionManager = new TransactionManager(walManager, connectionManager);

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
      transactionManager.commitTransaction(tid);
      return { success: true, tid };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('tx:rollback', async (_event, args: { tid: string }) => {
    const { tid } = args;
    try {
      transactionManager.rollbackTransaction(tid);
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

  ipcMain.handle('wal:get-logs', async (_event, filters: { tid?: string; startTime?: number; endTime?: number }) => {
    return walManager.getEntries(filters ?? {});
  });

  ipcMain.handle('wal:clear', async () => {
    walManager.clearLog();
    return { success: true };
  });

  ipcMain.handle('system:crash', async () => {
    transactionManager.injectControlledCrash();
    return { success: true };
  });

  ipcMain.handle('system:recover', async () => {
    const result = transactionManager.runRecoveryProcedure();
    return result;
  });

  ipcMain.handle('demo:seed', async () => {
    const engineId = 'postgresql-nodo-01';
    await connectionManager.connect(engineId, 'relational', {
      host: 'localhost',
      port: 5432,
      database: 'wal_e_demo',
      user: 'demo',
      password: 'demo',
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
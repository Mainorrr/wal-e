import { contextBridge, ipcRenderer } from 'electron'
import type { EngineType, EngineConfig, MutationData, RecoveryProtocol } from '../electron/types'

contextBridge.exposeInMainWorld('api', {
  connectEngine: (engineId: string, type: EngineType, config: EngineConfig) =>
    ipcRenderer.invoke('engine:connect', { engineId, type, config }),

  disconnectEngine: (engineId: string) =>
    ipcRenderer.invoke('engine:disconnect', { engineId }),

  listEngines: () =>
    ipcRenderer.invoke('engine:list'),

  beginTransaction: (tid: string, engineId: string) =>
    ipcRenderer.invoke('tx:begin', { tid, engineId }),

  executeTx: (tid: string, mutationData: MutationData) =>
    ipcRenderer.invoke('tx:execute', { tid, mutationData }),

  commitTransaction: (tid: string) =>
    ipcRenderer.invoke('tx:commit', { tid }),

  rollbackTransaction: (tid: string) =>
    ipcRenderer.invoke('tx:rollback', { tid }),

  setProtocol: (protocol: RecoveryProtocol) =>
    ipcRenderer.invoke('tx:set-protocol', { protocol }),

  getTransactionStatus: () =>
    ipcRenderer.invoke('tx:status'),

  getWalLogs: (filters?: { tid?: string; startTime?: number; endTime?: number }) =>
    ipcRenderer.invoke('wal:get-logs', filters),

  clearWal: () =>
    ipcRenderer.invoke('wal:clear'),

  triggerCrash: () =>
    ipcRenderer.invoke('system:crash'),

  triggerRecovery: () =>
    ipcRenderer.invoke('system:recover'),

  onWalEntry: (callback: (entry: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: unknown) => callback(entry);
    ipcRenderer.on('wal:entry', handler);
    return () => {
      ipcRenderer.removeListener('wal:entry', handler);
    };
  },

  loadDemo: () =>
    ipcRenderer.invoke('demo:seed'),
})
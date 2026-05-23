"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  connectEngine: (engineId, type, config) => electron.ipcRenderer.invoke("engine:connect", { engineId, type, config }),
  disconnectEngine: (engineId) => electron.ipcRenderer.invoke("engine:disconnect", { engineId }),
  listEngines: () => electron.ipcRenderer.invoke("engine:list"),
  beginTransaction: (tid, engineId) => electron.ipcRenderer.invoke("tx:begin", { tid, engineId }),
  executeTx: (tid, mutationData) => electron.ipcRenderer.invoke("tx:execute", { tid, mutationData }),
  commitTransaction: (tid) => electron.ipcRenderer.invoke("tx:commit", { tid }),
  rollbackTransaction: (tid) => electron.ipcRenderer.invoke("tx:rollback", { tid }),
  setProtocol: (protocol) => electron.ipcRenderer.invoke("tx:set-protocol", { protocol }),
  getTransactionStatus: () => electron.ipcRenderer.invoke("tx:status"),
  getWalLogs: (filters) => electron.ipcRenderer.invoke("wal:get-logs", filters),
  clearWal: () => electron.ipcRenderer.invoke("wal:clear"),
  triggerCrash: () => electron.ipcRenderer.invoke("system:crash"),
  triggerRecovery: () => electron.ipcRenderer.invoke("system:recover"),
  onWalEntry: (callback) => {
    const handler = (_event, entry) => callback(entry);
    electron.ipcRenderer.on("wal:entry", handler);
    return () => {
      electron.ipcRenderer.removeListener("wal:entry", handler);
    };
  },
  loadDemo: () => electron.ipcRenderer.invoke("demo:seed")
});

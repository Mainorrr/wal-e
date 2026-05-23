var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
class PostgresEngine {
  constructor() {
    __publicField(this, "connected", false);
  }
  async connect(_config) {
    this.connected = true;
    return true;
  }
  async disconnect() {
    this.connected = false;
  }
  async executeQuery(_query) {
    if (!this.connected) {
      return { success: false, data: null, error: "PostgresEngine: not connected" };
    }
    return { success: true, data: [] };
  }
}
class MongoEngine {
  constructor() {
    __publicField(this, "connected", false);
  }
  async connect(_config) {
    this.connected = true;
    return true;
  }
  async disconnect() {
    this.connected = false;
  }
  async executeQuery(_query) {
    if (!this.connected) {
      return { success: false, data: null, error: "MongoEngine: not connected" };
    }
    return { success: true, data: {} };
  }
}
class ConnectionManager {
  constructor() {
    __publicField(this, "engines", /* @__PURE__ */ new Map());
    __publicField(this, "connections", /* @__PURE__ */ new Map());
  }
  async connect(engineId, type, config) {
    let engine;
    if (type === "relational") {
      engine = new PostgresEngine();
    } else {
      engine = new MongoEngine();
    }
    const success = await engine.connect(config);
    if (!success) {
      return false;
    }
    this.engines.set(engineId, engine);
    this.connections.set(engineId, {
      id: engineId,
      type,
      status: "active",
      config
    });
    return true;
  }
  async disconnect(engineId) {
    const engine = this.engines.get(engineId);
    if (engine) {
      await engine.disconnect();
      this.engines.delete(engineId);
      this.connections.delete(engineId);
    }
  }
  getEngine(engineId) {
    return this.engines.get(engineId);
  }
  getConnection(engineId) {
    return this.connections.get(engineId);
  }
  getAllConnections() {
    return Array.from(this.connections.values());
  }
  async disconnectAll() {
    for (const [id, engine] of this.engines) {
      await engine.disconnect();
      this.connections.delete(id);
    }
    this.engines.clear();
  }
}
class WalManager {
  constructor(logPath) {
    __publicField(this, "logPath");
    __publicField(this, "subscribers", /* @__PURE__ */ new Set());
    this.logPath = logPath ?? path.join(app.getPath("userData"), "bitacora.log");
  }
  onEntry(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
  writeEntry(entry) {
    const fullEntry = {
      ...entry,
      timestamp: Date.now()
    };
    const line = JSON.stringify(fullEntry) + "\n";
    fs.appendFileSync(this.logPath, line, "utf-8");
    for (const cb of this.subscribers) {
      cb(fullEntry);
    }
  }
  getEntries(filters) {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }
    const content = fs.readFileSync(this.logPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    let entries = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter((e) => e !== null);
    if (filters.tid) {
      entries = entries.filter((e) => e.tid === filters.tid);
    }
    if (filters.startTime !== void 0) {
      entries = entries.filter((e) => e.timestamp >= filters.startTime);
    }
    if (filters.endTime !== void 0) {
      entries = entries.filter((e) => e.timestamp <= filters.endTime);
    }
    return entries;
  }
  clearLog() {
    if (fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, "", "utf-8");
    }
  }
  getLogPath() {
    return this.logPath;
  }
}
class TransactionManager {
  constructor(wal, connectionManager2) {
    __publicField(this, "wal");
    __publicField(this, "connectionManager");
    __publicField(this, "currentProtocol", "No-Undo/Redo");
    __publicField(this, "dirtyPagesBuffer", /* @__PURE__ */ new Map());
    __publicField(this, "activeTransactions", /* @__PURE__ */ new Map());
    this.wal = wal;
    this.connectionManager = connectionManager2;
  }
  setProtocol(protocol) {
    this.currentProtocol = protocol;
  }
  getProtocol() {
    return this.currentProtocol;
  }
  beginTransaction(tid, engineId) {
    this.wal.writeEntry({
      tid,
      op: "BEGIN",
      engine_id: engineId,
      before_image: null,
      after_image: null
    });
    this.activeTransactions.set(tid, {
      tid,
      engineId,
      status: "ACTIVE"
    });
  }
  executeMutationSimulated(tid, mutationData) {
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
      engine_id: txState.engineId
    });
    const protocol = this.currentProtocol;
    const bufferKey = `${tid}:${mutationData.op}:${Date.now()}`;
    if (protocol === "No-Undo/No-Redo") {
      this.flushToDisk(tid, mutationData);
    } else if (protocol === "No-Undo/Redo") {
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    } else if (protocol === "Undo/No-Redo") {
      this.flushToDisk(tid, mutationData);
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    } else if (protocol === "Undo/Redo") {
      this.dirtyPagesBuffer.set(bufferKey, mutationData);
    }
  }
  commitTransaction(tid) {
    const txState = this.activeTransactions.get(tid);
    if (!txState) {
      throw new Error(`Transaction ${tid} not found. Begin a transaction first.`);
    }
    this.wal.writeEntry({
      tid,
      op: "COMMIT",
      engine_id: txState.engineId,
      before_image: null,
      after_image: null
    });
    const protocol = this.currentProtocol;
    if (protocol === "No-Undo/Redo" || protocol === "Undo/Redo") {
      this.flushDirtyPages(tid);
    }
    this.activeTransactions.set(tid, { ...txState, status: "COMMITTED" });
    this.clearDirtyPagesForTransaction(tid);
  }
  rollbackTransaction(tid) {
    const txState = this.activeTransactions.get(tid);
    if (!txState) {
      throw new Error(`Transaction ${tid} not found. Begin a transaction first.`);
    }
    this.wal.writeEntry({
      tid,
      op: "ABORT",
      engine_id: txState.engineId,
      before_image: null,
      after_image: null
    });
    const protocol = this.currentProtocol;
    if (protocol === "Undo/No-Redo" || protocol === "Undo/Redo") {
      this.undoCommittedWrites(tid);
    }
    this.activeTransactions.set(tid, { ...txState, status: "ABORTED" });
    this.clearDirtyPagesForTransaction(tid);
  }
  injectControlledCrash() {
    this.dirtyPagesBuffer.clear();
  }
  runRecoveryProcedure() {
    const allEntries = this.wal.getEntries({});
    const beforeState = this.captureCurrentState();
    const committedTids = /* @__PURE__ */ new Set();
    const activeTids = /* @__PURE__ */ new Set();
    for (const entry of allEntries) {
      if (entry.op === "BEGIN") {
        activeTids.add(entry.tid);
      }
      if (entry.op === "COMMIT") {
        committedTids.add(entry.tid);
        activeTids.delete(entry.tid);
      }
      if (entry.op === "ABORT") {
        activeTids.delete(entry.tid);
      }
    }
    const undoList = new Set(activeTids);
    const redoList = new Set(committedTids);
    const protocol = this.currentProtocol;
    const needsUndo = protocol === "Undo/No-Redo" || protocol === "Undo/Redo";
    const needsRedo = protocol === "No-Undo/Redo" || protocol === "Undo/Redo";
    if (needsUndo) {
      const undoEntries = allEntries.filter((e) => undoList.has(e.tid) && e.before_image !== null).reverse();
      for (const entry of undoEntries) {
        this.applyChange(entry.engine_id, entry.table_or_collection, entry.before_image);
      }
    }
    if (needsRedo) {
      const redoEntries = allEntries.filter((e) => redoList.has(e.tid) && e.after_image !== null);
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
  getActiveTransactions() {
    return Array.from(this.activeTransactions.values());
  }
  getDirtyPages() {
    return new Map(this.dirtyPagesBuffer);
  }
  flushToDisk(tid, mutationData) {
    const txState = this.activeTransactions.get(tid);
    if (!txState) return;
    this.connectionManager.getEngine(txState.engineId);
  }
  flushDirtyPages(tid) {
    for (const [key, value] of this.dirtyPagesBuffer) {
      if (key.startsWith(`${tid}:`)) {
        this.flushToDisk(tid, value);
      }
    }
  }
  clearDirtyPagesForTransaction(tid) {
    for (const key of this.dirtyPagesBuffer.keys()) {
      if (key.startsWith(`${tid}:`)) {
        this.dirtyPagesBuffer.delete(key);
      }
    }
  }
  undoCommittedWrites(tid) {
    const entries = this.wal.getEntries({ tid });
    const mutationEntries = entries.filter(
      (e) => (e.op === "INSERT" || e.op === "UPDATE" || e.op === "DELETE") && e.before_image !== null
    ).reverse();
    for (const entry of mutationEntries) {
      this.applyChange(entry.engine_id, entry.table_or_collection, entry.before_image);
    }
  }
  applyChange(_engineId, _tableOrCollection, _data) {
  }
  captureCurrentState() {
    return Array.from(this.activeTransactions.values());
  }
}
let connectionManager;
let walManager;
let transactionManager;
let mainWindow = null;
function initServices() {
  connectionManager = new ConnectionManager();
  walManager = new WalManager();
  transactionManager = new TransactionManager(walManager, connectionManager);
  walManager.onEntry((entry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("wal:entry", entry);
    }
  });
}
function setMainWindow(win2) {
  mainWindow = win2;
}
function setupIPCHandlers() {
  ipcMain.handle("engine:connect", async (_event, args) => {
    const { engineId, type, config } = args;
    const success = await connectionManager.connect(engineId, type, config);
    return { success, engineId };
  });
  ipcMain.handle("engine:disconnect", async (_event, args) => {
    const { engineId } = args;
    await connectionManager.disconnect(engineId);
    return { success: true };
  });
  ipcMain.handle("engine:list", async () => {
    return connectionManager.getAllConnections();
  });
  ipcMain.handle("tx:begin", async (_event, args) => {
    const { tid, engineId } = args;
    try {
      transactionManager.beginTransaction(tid, engineId);
      return { success: true, tid };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });
  ipcMain.handle("tx:execute", async (_event, args) => {
    const { tid, mutationData } = args;
    try {
      transactionManager.executeMutationSimulated(tid, mutationData);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });
  ipcMain.handle("tx:commit", async (_event, args) => {
    const { tid } = args;
    try {
      transactionManager.commitTransaction(tid);
      return { success: true, tid };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });
  ipcMain.handle("tx:rollback", async (_event, args) => {
    const { tid } = args;
    try {
      transactionManager.rollbackTransaction(tid);
      return { success: true, tid };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });
  ipcMain.handle("tx:set-protocol", async (_event, args) => {
    const { protocol } = args;
    transactionManager.setProtocol(protocol);
    return { success: true, protocol };
  });
  ipcMain.handle("tx:status", async () => {
    return {
      protocol: transactionManager.getProtocol(),
      activeTransactions: transactionManager.getActiveTransactions(),
      dirtyPages: Array.from(transactionManager.getDirtyPages().entries())
    };
  });
  ipcMain.handle("wal:get-logs", async (_event, filters) => {
    return walManager.getEntries(filters ?? {});
  });
  ipcMain.handle("wal:clear", async () => {
    walManager.clearLog();
    return { success: true };
  });
  ipcMain.handle("system:crash", async () => {
    transactionManager.injectControlledCrash();
    return { success: true };
  });
  ipcMain.handle("system:recover", async () => {
    const result = transactionManager.runRecoveryProcedure();
    return result;
  });
  ipcMain.handle("demo:seed", async () => {
    const engineId = "postgresql-nodo-01";
    await connectionManager.connect(engineId, "relational", {
      host: "localhost",
      port: 5432,
      database: "wal_e_demo",
      user: "demo",
      password: "demo"
    });
    transactionManager.setProtocol("Undo/Redo");
    const tid1 = "TX-DEMO-001";
    transactionManager.beginTransaction(tid1, engineId);
    transactionManager.executeMutationSimulated(tid1, {
      op: "INSERT",
      table_or_collection: "estudiantes",
      before_image: null,
      after_image: { id: 1, nombre: "Maria Lopez", nota: 92 }
    });
    transactionManager.executeMutationSimulated(tid1, {
      op: "UPDATE",
      table_or_collection: "estudiantes",
      before_image: { id: 1, nota: 88 },
      after_image: { id: 1, nota: 95 }
    });
    transactionManager.commitTransaction(tid1);
    const tid2 = "TX-DEMO-002";
    transactionManager.beginTransaction(tid2, engineId);
    transactionManager.executeMutationSimulated(tid2, {
      op: "INSERT",
      table_or_collection: "estudiantes",
      before_image: null,
      after_image: { id: 2, nombre: "Carlos Perez", nota: 78 }
    });
    return { success: true };
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  setMainWindow(win);
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("before-quit", async () => {
  await connectionManager.disconnectAll();
});
app.whenReady().then(() => {
  initServices();
  setupIPCHandlers();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};

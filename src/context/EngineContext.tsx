import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { EngineType, EngineConfig } from '../../electron/types';

export interface EngineInfo {
  id: string;
  type: EngineType;
  status: string;
  config: EngineConfig;
}

export interface ConfiguredNode {
  id: string;
  label: string;
  type: EngineType;
  icon: string;
  config: EngineConfig;
}

const DEFAULT_NODES: ConfiguredNode[] = [
  {
    id: 'postgresql-nodo-01',
    label: 'PostgreSQL Nodes',
    type: 'relational',
    icon: 'database',
    config: { host: 'localhost', port: 5432, database: 'wal_e', user: 'postgres', password: 'postgres' }
  },
  {
    id: 'mongodb-nodo-01',
    label: 'MongoDB Nodes',
    type: 'nosql',
    icon: 'data_object',
    config: { uri: 'mongodb://mongo:mongo@localhost:27017', database: 'wal_e' }
  }
];

interface EngineContextValue {
  engines: EngineInfo[];
  activeEngineId: string | null;
  configuredNodes: ConfiguredNode[];
  connect: (engineId: string, type: EngineType, config: EngineConfig) => Promise<boolean>;
  disconnect: (engineId: string) => Promise<void>;
  setActive: (engineId: string | null) => void;
  refresh: () => Promise<void>;
  addConfiguredNode: (node: Omit<ConfiguredNode, 'id'>) => void;
  removeConfiguredNode: (id: string) => Promise<void>;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [activeEngineId, setActiveEngineId] = useState<string | null>(null);
  const [configuredNodes, setConfiguredNodes] = useState<ConfiguredNode[]>(() => {
    const saved = localStorage.getItem('wal_e_configured_nodes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ConfiguredNode[];
        // Migrate default nodes' metadata (icons/labels) in case the code defaults changed
        const merged = parsed.map((n) => {
          const def = DEFAULT_NODES.find((d) => d.id === n.id);
          return def ? { ...n, icon: def.icon, label: def.label } : n;
        });
        localStorage.setItem('wal_e_configured_nodes', JSON.stringify(merged));
        return merged;
      } catch {
        return DEFAULT_NODES;
      }
    }
    return DEFAULT_NODES;
  });

  const connect = useCallback(async (engineId: string, type: EngineType, config: EngineConfig) => {
    const result = await window.api.connectEngine(engineId, type, config);
    if (result.success) {
       const list = await window.api.listEngines();
       setEngines(list as EngineInfo[]);
       setActiveEngineId(engineId);
       return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(async (engineId: string) => {
    await window.api.disconnectEngine(engineId);
    const list = await window.api.listEngines();
    setEngines(list as EngineInfo[]);
    if (activeEngineId === engineId) {
      setActiveEngineId(list.length > 0 ? (list[0] as EngineInfo).id : null);
    }
  }, [activeEngineId]);

  const setActive = useCallback((engineId: string | null) => {
    setActiveEngineId(engineId);
  }, []);

  const refresh = useCallback(async () => {
    const list = await window.api.listEngines();
    setEngines(list as EngineInfo[]);
    if (list.length > 0 && !activeEngineId) {
      setActiveEngineId((list[0] as EngineInfo).id);
    }
  }, [activeEngineId]);

  const addConfiguredNode = useCallback((node: Omit<ConfiguredNode, 'id'>) => {
    const newNode: ConfiguredNode = {
      ...node,
      id: `node-${Date.now()}`
    };
    setConfiguredNodes((prev) => {
      const updated = [...prev, newNode];
      localStorage.setItem('wal_e_configured_nodes', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeConfiguredNode = useCallback(async (id: string) => {
    await disconnect(id).catch(() => {});
    setConfiguredNodes((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      localStorage.setItem('wal_e_configured_nodes', JSON.stringify(updated));
      return updated;
    });
  }, [disconnect]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <EngineContext.Provider value={{
      engines,
      activeEngineId,
      configuredNodes,
      connect,
      disconnect,
      setActive,
      refresh,
      addConfiguredNode,
      removeConfiguredNode
    }}>
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}
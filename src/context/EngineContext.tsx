import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { EngineType, EngineConfig } from '../../electron/types';

interface EngineInfo {
  id: string;
  type: EngineType;
  status: string;
  config: EngineConfig;
}

interface EngineContextValue {
  engines: EngineInfo[];
  activeEngineId: string | null;
  connect: (engineId: string, type: EngineType, config: EngineConfig) => Promise<void>;
  disconnect: (engineId: string) => Promise<void>;
  setActive: (engineId: string | null) => void;
  refresh: () => Promise<void>;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [activeEngineId, setActiveEngineId] = useState<string | null>(null);

  const connect = useCallback(async (engineId: string, type: EngineType, config: EngineConfig) => {
    const result = await window.api.connectEngine(engineId, type, config);
    if (result.success) {
      const list = await window.api.listEngines();
      setEngines(list as EngineInfo[]);
      setActiveEngineId(engineId);
    }
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
  }, []);

  return (
    <EngineContext.Provider value={{ engines, activeEngineId, connect, disconnect, setActive, refresh }}>
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}
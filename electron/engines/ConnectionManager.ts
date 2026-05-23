import { IBaseEngine, EngineConnection } from './EngineInterface';
import { PostgresEngine } from './PostgresEngine';
import { MongoEngine } from './MongoEngine';
import type { EngineConfig, EngineType, EngineStatus } from '../types';

export class ConnectionManager {
  private engines: Map<string, IBaseEngine> = new Map();
  private connections: Map<string, EngineConnection> = new Map();

  async connect(engineId: string, type: EngineType, config: EngineConfig): Promise<boolean> {
    let engine: IBaseEngine;

    if (type === 'relational') {
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
      status: 'active' as EngineStatus,
      config,
    });

    return true;
  }

  async disconnect(engineId: string): Promise<void> {
    const engine = this.engines.get(engineId);
    if (engine) {
      await engine.disconnect();
      this.engines.delete(engineId);
      this.connections.delete(engineId);
    }
  }

  getEngine(engineId: string): IBaseEngine | undefined {
    return this.engines.get(engineId);
  }

  getConnection(engineId: string): EngineConnection | undefined {
    return this.connections.get(engineId);
  }

  getAllConnections(): EngineConnection[] {
    return Array.from(this.connections.values());
  }

  async disconnectAll(): Promise<void> {
    for (const [id, engine] of this.engines) {
      await engine.disconnect();
      this.connections.delete(id);
    }
    this.engines.clear();
  }
}
import { IBaseEngine, QueryResult } from './EngineInterface';
import type { EngineConfig } from '../types';

export class PostgresEngine implements IBaseEngine {
  private connected: boolean = false;

  async connect(_config: EngineConfig): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async executeQuery(_query: string): Promise<QueryResult> {
    if (!this.connected) {
      return { success: false, data: null, error: 'PostgresEngine: not connected' };
    }
    return { success: true, data: [] };
  }
}
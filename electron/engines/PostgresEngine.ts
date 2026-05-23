import { IBaseEngine, QueryResult } from './EngineInterface';
import type { EngineConfig, PostgresConfig } from '../types';
import type { Pool } from 'pg';

export class PostgresEngine implements IBaseEngine {
  private pool: Pool | null = null;
  private connected: boolean = false;

  async connect(config: EngineConfig): Promise<boolean> {
    const { default: Pg } = await import('pg');
    const PoolClass = Pg.Pool;
    const pgConfig = config as PostgresConfig;
    this.pool = new PoolClass({
      host: pgConfig.host,
      port: pgConfig.port,
      database: pgConfig.database,
      user: pgConfig.user,
      password: pgConfig.password,
    });

    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();

    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  async executeQuery(_query: string): Promise<QueryResult> {
    if (!this.connected || !this.pool) {
      return { success: false, data: null, error: 'PostgresEngine: not connected' };
    }
    return { success: true, data: [] };
  }
}
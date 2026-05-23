import type { EngineConfig, QueryResultData } from '../types';

export interface QueryResult {
  success: boolean;
  data: QueryResultData;
  error?: string;
}

export interface EngineConnection {
  id: string;
  type: 'relational' | 'nosql';
  status: 'active' | 'inactive';
  config: EngineConfig;
}

export interface IBaseEngine {
  connect(config: EngineConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  executeQuery(query: string): Promise<QueryResult>;
}
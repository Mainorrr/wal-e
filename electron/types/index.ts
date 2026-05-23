export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface MongoConfig {
  uri: string;
  database: string;
}

export type EngineConfig = PostgresConfig | MongoConfig | Record<string, unknown>;

export type DataSnapshot = Record<string, unknown> | null;

export type QueryResultData = Record<string, unknown>[] | Record<string, unknown> | null;

export interface MutationData {
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  table_or_collection?: string;
  before_image: DataSnapshot;
  after_image: DataSnapshot;
}

export type EngineType = 'relational' | 'nosql';

export type EngineStatus = 'active' | 'inactive';

export type RecoveryProtocol = 'No-Undo/No-Redo' | 'No-Undo/Redo' | 'Undo/No-Redo' | 'Undo/Redo';

export interface DirtyPageEntry {
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  table_or_collection: string;
  before_image: DataSnapshot;
  after_image: DataSnapshot;
  parsedSql?: string;
  isMongo: boolean;
}
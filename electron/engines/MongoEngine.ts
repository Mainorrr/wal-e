import { IBaseEngine, QueryResult } from './EngineInterface';
import type { EngineConfig, MongoConfig } from '../types';
import { parseRelaxedJson } from '../core/jsonUtils';

interface ParsedMongoCommand {
  collection: string;
  method: string;
  args: string[];
}

function parseMongoCommand(query: string): ParsedMongoCommand | null {
  const sanitized = query.trim().replace(/;+$/, '').trim();
  const match = sanitized.match(/^db\.(\w+)\.(\w+)\(([\s\S]*)\)$/);
  if (!match) return null;
  const collection = match[1];
  const method = match[2];
  const argsStr = match[3];

  const args: string[] = [];
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';
  let current = '';
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (!inQuote && (c === '"' || c === "'")) {
      inQuote = true;
      quoteChar = c;
      current += c;
    } else if (inQuote && c === quoteChar && argsStr[i - 1] !== '\\') {
      inQuote = false;
      quoteChar = '';
      current += c;
    } else if (!inQuote && (c === '{' || c === '[')) {
      depth++;
      current += c;
    } else if (!inQuote && (c === '}' || c === ']')) {
      depth--;
      current += c;
    } else if (!inQuote && c === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) args.push(current.trim());

  return { collection, method, args };
}

export class MongoEngine implements IBaseEngine {
  private client: import('mongodb').MongoClient | null = null;
  private db: import('mongodb').Db | null = null;
  private connected: boolean = false;

  async connect(config: EngineConfig): Promise<boolean> {
    const { MongoClient } = await import('mongodb');
    const mongoConfig = config as MongoConfig;
    this.client = new MongoClient(mongoConfig.uri);
    await this.client.connect();
    this.db = this.client.db(mongoConfig.database);
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    this.connected = false;
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.connected || !this.db) {
      return { success: false, data: null, error: 'MongoEngine: not connected' };
    }
    try {
      const parsed = parseMongoCommand(query);
      if (!parsed) {
        return { success: false, data: null, error: 'Invalid MongoDB command format' };
      }
      const collection = this.db.collection(parsed.collection);
      let result;
      switch (parsed.method) {
        case 'find':
        case 'findOne': {
          const filter = parseRelaxedJson(parsed.args[0] || '{}');
          const method = parsed.method === 'find' ? 'find' : 'findOne';
          result = method === 'find'
            ? await collection.find(filter).toArray()
            : await collection.findOne(filter);
          return { success: true, data: result };
        }
        case 'insertOne': {
          const doc = parseRelaxedJson(parsed.args[0] || '{}');
          result = await collection.insertOne(doc);
          return { success: true, data: { insertedId: result.insertedId } };
        }
        case 'insertMany': {
          const docs = parseRelaxedJson(parsed.args[0] || '[]');
          result = await collection.insertMany(Array.isArray(docs) ? docs : []);
          return { success: true, data: { insertedCount: result.insertedCount } };
        }
        case 'updateOne': {
          const filter = parseRelaxedJson(parsed.args[0] || '{}');
          const update = parseRelaxedJson(parsed.args[1] || '{}');
          result = await collection.updateOne(filter, update);
          return { success: true, data: { modifiedCount: result.modifiedCount } };
        }
        case 'updateMany': {
          const filter = parseRelaxedJson(parsed.args[0] || '{}');
          const update = parseRelaxedJson(parsed.args[1] || '{}');
          result = await collection.updateMany(filter, update);
          return { success: true, data: { modifiedCount: result.modifiedCount } };
        }
        case 'deleteOne': {
          const filter = parseRelaxedJson(parsed.args[0] || '{}');
          result = await collection.deleteOne(filter);
          return { success: true, data: { deletedCount: result.deletedCount } };
        }
        case 'deleteMany': {
          const filter = parseRelaxedJson(parsed.args[0] || '{}');
          result = await collection.deleteMany(filter);
          return { success: true, data: { deletedCount: result.deletedCount } };
        }
        default:
          return { success: false, data: null, error: `Unsupported method: ${parsed.method}` };
      }
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  }
}
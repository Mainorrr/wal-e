import fs from 'node:fs';
import path from 'node:path';
import type { DataSnapshot } from '../types';

export interface LogEntry {
  tid: string;
  op: 'BEGIN' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COMMIT' | 'ABORT';
  table_or_collection?: string;
  before_image: DataSnapshot;
  after_image: DataSnapshot;
  timestamp: number;
  engine_id: string;
  protocol?: string;
}

export type LogEntryInput = Omit<LogEntry, 'timestamp'>;
type EntryCallback = (entry: LogEntry) => void;

export class WalManager {
  private logPath: string;
  private subscribers: Set<EntryCallback> = new Set();

  constructor(logPath?: string) {
    this.logPath = logPath ?? path.join(process.cwd(), 'bitacora.log');
  }

  public onEntry(callback: EntryCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public writeEntry(entry: LogEntryInput): void {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    const line = JSON.stringify(fullEntry) + '\n';
    fs.appendFileSync(this.logPath, line, 'utf-8');

    for (const cb of this.subscribers) {
      cb(fullEntry);
    }
  }

  public getEntries(filters: { tid?: string; startTime?: number; endTime?: number }): LogEntry[] {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);

    let entries: LogEntry[] = lines.map((line) => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch {
        return null;
      }
    }).filter((e): e is LogEntry => e !== null);

    if (filters.tid) {
      entries = entries.filter((e) => e.tid === filters.tid);
    }
    if (filters.startTime !== undefined) {
      entries = entries.filter((e) => e.timestamp >= filters.startTime!);
    }
    if (filters.endTime !== undefined) {
      entries = entries.filter((e) => e.timestamp <= filters.endTime!);
    }

    return entries;
  }

  public clearLog(): void {
    if (fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, '', 'utf-8');
    }
  }

  public getLogPath(): string {
    return this.logPath;
  }
}
import { useState } from 'react';
import { Terminal } from 'lucide-react';
import { WALFilters } from './WALFilters';
import { WALLogViewer } from './WALLogViewer';
import { useTransaction } from '../../context/TransactionContext';
import type { WALFilterState } from './WALFilters';

export function WALConsole() {
  const { walEntries, clearWal } = useTransaction();
  const [filters, setFilters] = useState<WALFilterState>({ tid: '', opType: 'TODAS' });

  const filteredEntries = walEntries.filter((entry) => {
    if (filters.tid && !entry.tid.toLowerCase().includes(filters.tid.toLowerCase())) return false;
    if (filters.opType !== 'TODAS' && entry.op !== filters.opType) return false;
    return true;
  });

  return (
    <section className="h-72 flex flex-col bg-black border border-outline-variant rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-highest border-b border-outline-variant">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-secondary" />
            <span className="font-label-caps text-label-caps text-on-surface">WRITE-AHEAD LOG (WAL) VIEWER</span>
          </div>
          <WALFilters filters={filters} onFilterChange={setFilters} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-on-surface-variant font-code-md">
            {walEntries.length} entries
          </span>
          <button
            onClick={clearWal}
            className="text-[10px] text-error font-bold hover:text-error transition-colors"
          >
            CLEAR
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
        </div>
      </div>
      <WALLogViewer entries={filteredEntries} />
    </section>
  );
}
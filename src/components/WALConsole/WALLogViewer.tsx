import { useEffect, useRef } from 'react';
import type { WalEntry } from '../../types/window';

interface WALLogViewerProps {
  entries: WalEntry[];
}

function getOpColor(op: string): string {
  switch (op) {
    case 'BEGIN': return 'text-primary-container';
    case 'COMMIT': return 'text-secondary';
    case 'ABORT': return 'text-error';
    case 'INSERT': return 'text-secondary-fixed-dim';
    case 'UPDATE':
    case 'DELETE': return 'text-tertiary-fixed-dim';
    default: return 'text-outline-variant';
  }
}

export function WALLogViewer({ entries }: WALLogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 font-code-sm text-code-sm text-outline-variant italic">
        No WAL entries. Run transactions or load demo data.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 font-code-sm text-code-sm space-y-1">
      {entries.map((entry, i) => (
        <div key={`${entry.tid}-${entry.timestamp}-${i}`} className={`wal-line flex gap-4 ${getOpColor(entry.op)}`}>
          <span>{JSON.stringify(entry)}</span>
        </div>
      ))}
    </div>
  );
}
import { useState } from 'react';
import { useEngine } from '../../context/EngineContext';
import { useTransaction } from '../../context/TransactionContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';

interface CodeDisplayProps {
  onResult?: (data: unknown, isMutation: boolean) => void;
}

export function CodeDisplay({ onResult }: CodeDisplayProps) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { activeEngineId } = useEngine();
  const { executeQuery, allTransactions, currentTid, selectedTid } = useTransaction();

  const tid = selectedTid || currentTid || allTransactions.find((t) => t.status === 'ACTIVE')?.tid;
  const canRun = activeEngineId && tid;

  const handleRun = async () => {
    if (!canRun || !query.trim()) return;
    setError(null);

    try {
      const result = await executeQuery(activeEngineId!, query, tid);
      if (!result.success) {
        setError(result.error || 'Query failed');
      } else if (onResult) {
        onResult(result.data, result.isMutation || false);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-surface-container-lowest p-4 font-code-md text-code-md">
      <div className="flex justify-end mb-2 gap-2">
        {error && <span className="text-error text-[10px] mr-2">{error}</span>}
        {!tid && (
          <span className="text-[10px] text-yellow-600 mr-2">Select a transaction from sidebar or click BEGIN</span>
        )}
        <button
          onClick={handleRun}
          className={`flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded transition-opacity ${canRun ? 'bg-primary-container text-on-primary-container hover:opacity-90' : 'bg-surface-container text-outline opacity-50 cursor-not-allowed'}`}
          title="Execute query"
          disabled={!canRun}
        >
          <MaterialSymbol icon="play_arrow" size={16} />
          Run
        </button>
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={!canRun}
        spellCheck={false}
        className={`w-full h-full bg-transparent resize-none outline-none font-code-md text-code-md leading-[24px] ${canRun ? 'text-on-surface-variant' : 'text-outline opacity-50'}`}
        placeholder={canRun ? "Write your query here... (e.g. UPDATE estudiantes SET nota = 90 WHERE carne = '812345')" : "Select a transaction to enable query editing..."}
      />
    </div>
  );
}
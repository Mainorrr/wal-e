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
  const { executeQuery, allTransactions } = useTransaction();

  const currentActiveTx = allTransactions.find((t) => t.status === 'ACTIVE');

  const handleRun = async () => {
    if (!activeEngineId || !query.trim()) return;
    setError(null);
    try {
      const result = await executeQuery(activeEngineId, query, currentActiveTx?.tid);
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
        <button
          onClick={handleRun}
          className="flex items-center gap-1 px-3 py-1 bg-primary-container text-on-primary-container text-[11px] font-bold rounded hover:opacity-90 transition-opacity"
          title="Execute query"
          disabled={!activeEngineId}
        >
          <MaterialSymbol icon="play_arrow" size={16} />
          Run
        </button>
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
        className="w-full h-full bg-transparent text-on-surface-variant resize-none outline-none font-code-md text-code-md leading-[24px]"
        placeholder={"Write your query here... (e.g. UPDATE estudiantes SET nota = 90 WHERE carne = '812345')"}
      />
    </div>
  );
}
import { useState } from 'react';
import { CodeDisplay } from './CodeDisplay';
import { ResultsTable } from './ResultsTable';
import { useEngine } from '../../context/EngineContext';

export function QueryEditor() {
  const { activeEngineId, engines } = useEngine();
  const [queryResult, setQueryResult] = useState<{ data: unknown; isMutation: boolean } | null>(null);
  const activeEngine = engines.find((e) => e.id === activeEngineId);
  const isMongo = activeEngine?.type === 'nosql';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container border-b border-outline-variant">
        <div className="flex items-center gap-4">
          <span className="text-code-sm font-code-md text-on-surface-variant">
            {isMongo ? 'aggregate_metrics.js' : 'query_active_node_01.sql'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] text-secondary font-bold tracking-tighter uppercase">Connected</span>
          </div>
        </div>
      </div>
      <CodeDisplay onResult={(data, isMutation) => setQueryResult({ data, isMutation })} />
      <ResultsTable isMongo={isMongo} queryResult={queryResult} />
    </div>
  );
}
import { useState } from 'react';
import { useEngine } from '../../context/EngineContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';


export function CodeDisplay() {
  const [query, setQuery] = useState('');
  const { activeEngineId } = useEngine();


  return (
    <div className="flex-1 overflow-auto bg-surface-container-lowest p-4 font-code-md text-code-md">
      <div className="flex justify-end mb-2 gap-2">
        <button
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
        placeholder={"Write your query here..."}
      />
    </div>
  );
}
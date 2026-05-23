import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEngine } from '../../context/EngineContext';
import { useTransaction } from '../../context/TransactionContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import { POSTGRES_CATALOG, MONGO_CATALOG, type QueryExample } from './queryCatalog';

interface QueryLabModalProps {
  onClose: () => void;
}

export function QueryLabModal({ onClose }: QueryLabModalProps) {
  const { activeEngineId, engines } = useEngine();
  const { setPendingQuery, setActiveView } = useTransaction();

  const activeEngine = engines.find((e) => e.id === activeEngineId);
  const isMongo = activeEngine?.type === 'nosql';
  const catalog = useMemo(() => (isMongo ? MONGO_CATALOG : POSTGRES_CATALOG), [isMongo]);

  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);

  const selectedCategory = catalog[selectedCategoryIdx];

  const handleCopy = async (q: QueryExample) => {
    try {
      await navigator.clipboard.writeText(q.query);
      setCopiedQuery(q.title);
      setTimeout(() => setCopiedQuery((curr) => (curr === q.title ? null : curr)), 1500);
    } catch {
      // ignore
    }
  };

  const handleUse = (q: QueryExample) => {
    setPendingQuery(q.query);
    setActiveView('query');
    onClose();
  };

  return createPortal((
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-container border border-purple-500/40 rounded-xl shadow-2xl flex flex-col w-[min(1100px,92vw)] h-[min(720px,86vh)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-outline-variant bg-gradient-to-r from-purple-900/40 to-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
              <MaterialSymbol icon="science" size={22} className="text-purple-300" />
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-purple-200">Query Lab</h2>
              <p className="text-[11px] text-on-surface-variant">
                Catálogo de queries de demostración para{' '}
                <span className="font-bold text-purple-300">{isMongo ? 'MongoDB' : 'PostgreSQL'}</span>
                {activeEngineId && <span className="text-outline"> · {activeEngineId}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-purple-300 transition-colors p-1 rounded-full hover:bg-surface-container-high"
          >
            <MaterialSymbol icon="close" size={20} />
          </button>
        </header>

        {!activeEngineId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MaterialSymbol icon="dns" size={40} className="text-outline mb-3" />
            <p className="text-on-surface-variant">Conecta a un nodo desde el Sidebar para ver los ejemplos.</p>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            <nav className="w-64 border-r border-outline-variant bg-surface-container-lowest overflow-y-auto py-2">
              {catalog.map((cat, idx) => (
                <button
                  key={cat.category}
                  onClick={() => setSelectedCategoryIdx(idx)}
                  className={`w-full text-left px-4 py-2.5 text-[12px] border-l-2 transition-colors ${
                    idx === selectedCategoryIdx
                      ? 'border-purple-500 bg-purple-900/20 text-purple-200'
                      : 'border-transparent text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <div className="font-bold">{cat.category}</div>
                  <div className="text-[10px] text-outline mt-0.5">{cat.items.length} ejemplos</div>
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedCategory.intro && (
                <div className="bg-purple-900/15 border border-purple-500/30 rounded-lg px-4 py-3 text-[12px] text-purple-100">
                  {selectedCategory.intro}
                </div>
              )}

              {selectedCategory.items.map((q, i) => (
                <div
                  key={i}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-outline-variant flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[13px] text-on-surface">{q.title}</h3>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{q.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopy(q)}
                        className="px-2.5 py-1 text-[10px] font-bold rounded bg-surface-container-high text-on-surface-variant hover:text-purple-300 hover:bg-surface-container-highest transition-colors flex items-center gap-1"
                        title="Copiar al portapapeles"
                      >
                        <MaterialSymbol icon={copiedQuery === q.title ? 'check' : 'content_copy'} size={12} />
                        {copiedQuery === q.title ? 'Copiado' : 'Copiar'}
                      </button>
                      <button
                        onClick={() => handleUse(q)}
                        className="px-2.5 py-1 text-[10px] font-bold rounded bg-purple-600 text-white hover:bg-purple-500 transition-colors flex items-center gap-1"
                        title="Cargar en el editor"
                      >
                        <MaterialSymbol icon="east" size={12} />
                        Usar en editor
                      </button>
                    </div>
                  </div>

                  <pre className="px-4 py-3 bg-black/40 text-[11px] font-code-md text-purple-100 overflow-x-auto whitespace-pre">
{q.query}
                  </pre>

                  {q.notes && (
                    <div className="px-4 py-2 border-t border-outline-variant bg-surface-container/50 text-[10px] text-outline italic">
                      {q.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="px-5 py-2.5 border-t border-outline-variant bg-surface-container-highest text-[10px] text-outline flex items-center justify-between">
          <span>Tip: usa "Usar en editor" para cargar la query y luego pulsa Run.</span>
          <span>{catalog.reduce((acc, c) => acc + c.items.length, 0)} ejemplos totales</span>
        </footer>
      </div>
    </div>
  ), document.body);
}

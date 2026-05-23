import { useTransaction } from '../../context/TransactionContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import { WALConsole } from '../WALConsole/WALConsole';

function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'text-secondary';
    case 'COMMITTED': return 'text-secondary';
    case 'ABORTED': return 'text-error';
    default: return 'text-on-surface-variant';
  }
}

function StateTable({ title, rows }: { title: string; rows: Array<{ tid: string; engineId: string; status: string }> }) {
  return (
    <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col">
      <div className="px-4 py-2 bg-surface-container-highest border-b border-outline-variant">
        <span className="font-label-caps text-label-caps text-on-surface">{title} ({rows.length})</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-code-sm text-code-sm space-y-1">
        {rows.length === 0 ? (
          <p className="text-outline-variant italic text-[11px]">Sin transacciones</p>
        ) : (
          rows.map((r) => (
            <div key={`${r.tid}-${r.status}`} className="flex items-center justify-between px-2 py-1 rounded bg-surface-container-high">
              <span className="text-primary font-code-md text-[11px]">{r.tid}</span>
              <span className="text-on-surface-variant text-[10px]">{r.engineId}</span>
              <span className={`text-[10px] font-bold ${statusColor(r.status)}`}>{r.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface DataSnapshot {
  key: string;
  engineId: string;
  table: string;
  rows: unknown[];
}

function rowDigest(row: unknown): string {
  return JSON.stringify(row);
}

function diffRows(beforeRows: unknown[], afterRows: unknown[]) {
  const beforeSet = new Set(beforeRows.map(rowDigest));
  const afterSet = new Set(afterRows.map(rowDigest));
  return {
    addedCount: afterRows.filter((r) => !beforeSet.has(rowDigest(r))).length,
    removedCount: beforeRows.filter((r) => !afterSet.has(rowDigest(r))).length,
  };
}

function DataTable({ rows }: { rows: unknown[] }) {
  if (rows.length === 0) {
    return <p className="text-outline-variant italic text-[11px] p-3">Sin filas</p>;
  }
  const columns = Array.from(
    new Set(rows.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r as Record<string, unknown>) : []))),
  );
  return (
    <div className="overflow-auto max-h-48">
      <table className="w-full text-left border-collapse text-[11px]">
        <thead className="sticky top-0 bg-surface-container-highest z-10">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-2 py-1 text-[10px] font-bold text-outline border-r border-outline-variant last:border-r-0">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="font-code-sm divide-y divide-outline-variant">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface-container-highest/30">
              {columns.map((c) => {
                const v = r && typeof r === 'object' ? (r as Record<string, unknown>)[c] : undefined;
                return (
                  <td key={c} className="px-2 py-1 text-on-surface-variant border-r border-outline-variant last:border-r-0 truncate max-w-[180px]">
                    {v === undefined || v === null ? <span className="text-outline italic">—</span> : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataSnapshotsPanel({ before, after }: { before: DataSnapshot[]; after: DataSnapshot[] }) {
  if (before.length === 0 && after.length === 0) return null;
  const keys = Array.from(new Set([...before.map((s) => s.key), ...after.map((s) => s.key)]));
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-surface-container-highest border-b border-outline-variant flex items-center gap-2">
        <MaterialSymbol icon="table_chart" size={16} className="text-tertiary" />
        <span className="font-label-caps text-label-caps text-on-surface">ESTADO DE LOS DATOS — ANTES vs DESPUÉS</span>
      </div>
      <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
        {keys.map((key) => {
          const b = before.find((s) => s.key === key);
          const a = after.find((s) => s.key === key);
          const beforeRows = b?.rows ?? [];
          const afterRows = a?.rows ?? [];
          const diff = diffRows(beforeRows, afterRows);
          const target = b ?? a;
          return (
            <div key={key} className="border border-outline-variant rounded">
              <div className="px-3 py-1.5 bg-surface-container-high flex items-center justify-between text-[11px]">
                <span className="font-code-md text-primary font-bold">
                  {target?.table}
                  <span className="text-outline ml-2">· {target?.engineId}</span>
                </span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-secondary">+{diff.addedCount} fila(s)</span>
                  <span className="text-error">-{diff.removedCount} fila(s)</span>
                  <span className="text-outline">{beforeRows.length} → {afterRows.length}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-outline-variant">
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold text-outline bg-surface-container-lowest">ANTES</div>
                  <DataTable rows={beforeRows} />
                </div>
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold text-outline bg-surface-container-lowest">DESPUÉS</div>
                  <DataTable rows={afterRows} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TidList({ title, tids, accent }: { title: string; tids: string[]; accent: 'error' | 'secondary' }) {
  const colorClass = accent === 'error' ? 'text-error' : 'text-secondary';
  const bgClass = accent === 'error' ? 'bg-error-container/30' : 'bg-secondary-container/20';
  return (
    <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col">
      <div className="px-4 py-2 bg-surface-container-highest border-b border-outline-variant">
        <span className="font-label-caps text-label-caps text-on-surface">{title} ({tids.length})</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-code-sm text-code-sm space-y-1">
        {tids.length === 0 ? (
          <p className="text-outline-variant italic text-[11px]">Ninguna</p>
        ) : (
          tids.map((tid) => (
            <div key={tid} className={`px-2 py-1 rounded ${bgClass}`}>
              <span className={`font-code-md text-[11px] font-bold ${colorClass}`}>{tid}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RecoveryView() {
  const { protocol, recoveryResult, triggerRecovery, clearRecoveryResult, lastCrash, clearLastCrash } = useTransaction();

  const handleRun = async () => {
    await triggerRecovery();
  };

  return (
    <div className="flex-1 flex flex-col gap-gutter overflow-hidden">
      {lastCrash && (
        <div className="bg-error-container/30 border border-error rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MaterialSymbol icon="warning" size={20} className="text-error" />
            <div>
              <p className="text-error font-bold text-[12px]">CRASH INYECTADO</p>
              <p className="text-on-surface-variant text-[11px]">
                Se descartaron <span className="font-bold text-error">{lastCrash.droppedPages}</span> páginas sucias de memoria.
                {lastCrash.activeTids.length > 0 && (
                  <> Transacciones activas afectadas: <span className="font-code-md text-error">{lastCrash.activeTids.join(', ')}</span></>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={clearLastCrash}
            className="text-error/70 hover:text-error transition-colors"
            title="Cerrar"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>
      )}

      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 bg-surface-container-highest border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MaterialSymbol icon="bolt" size={18} className="text-tertiary" />
            <span className="font-label-caps text-label-caps text-primary">RECOVERY PROCEDURE</span>
            <span className="text-[10px] text-outline">Protocolo activo:</span>
            <span className="font-code-md text-tertiary text-[11px]">{protocol}</span>
          </div>
          <div className="flex items-center gap-2">
            {recoveryResult && (
              <button
                onClick={clearRecoveryResult}
                className="px-3 py-1.5 text-[11px] font-bold rounded bg-surface-container-high text-on-surface-variant hover:brightness-110"
              >
                CLEAR RESULT
              </button>
            )}
            <button
              onClick={handleRun}
              className="px-3 py-1.5 bg-tertiary-container text-on-tertiary-container text-[11px] font-bold rounded flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <MaterialSymbol icon="bolt" size={14} />
              RUN RECOVERY
            </button>
          </div>
        </div>

        {!recoveryResult ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <MaterialSymbol icon="history" size={40} className="text-outline mb-3" />
            <p className="text-on-surface-variant text-sm">
              Ejecuta <span className="font-bold text-tertiary">RUN RECOVERY</span> para reconstruir el estado a partir de la bitácora.
            </p>
            <p className="text-outline text-[11px] mt-2 max-w-md">
              Según el protocolo activo se ejecutará UNDO sobre transacciones sin commit y/o REDO sobre transacciones committed.
            </p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-4 gap-4 text-[12px]">
            <div className="space-y-1">
              <span className="text-[10px] text-outline font-label-caps uppercase">Protocolo aplicado</span>
              <p className="font-code-md text-tertiary">{recoveryResult.protocol}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-outline font-label-caps uppercase">Entradas WAL procesadas</span>
              <p className="font-code-md text-primary">{recoveryResult.walEntriesProcessed}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-outline font-label-caps uppercase">UNDO ejecutados</span>
              <p className="font-code-md text-error">{recoveryResult.undoneTids.length}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-outline font-label-caps uppercase">REDO ejecutados</span>
              <p className="font-code-md text-secondary">{recoveryResult.redoneTids.length}</p>
            </div>
          </div>
        )}
      </div>

      {recoveryResult && (
        <>
          <div className="flex gap-gutter min-h-[180px]">
            <StateTable title="TRANSACCIONES ANTES" rows={recoveryResult.beforeState} />
            <StateTable title="TRANSACCIONES DESPUÉS" rows={recoveryResult.afterState} />
            <TidList title="UNDO TIDs" tids={recoveryResult.undoneTids} accent="error" />
            <TidList title="REDO TIDs" tids={recoveryResult.redoneTids} accent="secondary" />
          </div>

          <DataSnapshotsPanel
            before={recoveryResult.dataBefore}
            after={recoveryResult.dataAfter}
          />
        </>
      )}

      <WALConsole />
    </div>
  );
}

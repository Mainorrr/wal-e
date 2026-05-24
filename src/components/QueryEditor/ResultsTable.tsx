import { useEngine } from '../../context/EngineContext';

interface ResultsTableProps {
  isMongo: boolean;
  queryResult?: { data: unknown; isMutation: boolean; command?: string; rowCount?: number } | null;
  error?: string | null;
}

export function ResultsTable({ isMongo, queryResult, error }: ResultsTableProps) {
  const { activeEngineId } = useEngine();

  if (error) {
    return (
      <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto p-4">
        <div className="border border-error rounded bg-error-container/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-error text-xl">error</span>
            <p className="text-error font-bold text-code-sm uppercase tracking-wider">Query Error</p>
          </div>
          <pre className="text-on-error-container font-code-sm text-code-sm whitespace-pre-wrap break-words">
            {error}
          </pre>
        </div>
      </div>
    );
  }

  if (!activeEngineId) {
    return (
      <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto flex items-center justify-center">
        <p className="text-on-surface-variant text-code-sm font-code-md italic">
          No engine connected. Select a node from the sidebar.
        </p>
      </div>
    );
  }

  if (queryResult?.isMutation) {
    return (
      <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-secondary text-4xl mb-2">check_circle</span>
          <p className="text-secondary font-code-md text-code-sm">Mutation applied</p>
          <p className="text-on-surface-variant text-[10px] mt-1">Check WAL log for details</p>
        </div>
      </div>
    );
  }

  const rows = queryResult?.data as Record<string, unknown>[] | undefined;

  if (isMongo) {
    return (
      <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto p-4">
        <pre className="text-secondary-fixed-dim font-code-sm text-code-sm">
          {rows ? JSON.stringify(rows, null, 2) : 'No data'}
        </pre>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    if (queryResult) {
      const cmd = queryResult.command;
      const isSelect = cmd === 'SELECT';
      const label = cmd ? `${cmd} executed successfully` : 'Query executed successfully';
      const detail = isSelect
        ? '0 filas devueltas.'
        : cmd === 'CREATE'
          ? 'Tabla creada (o ya existía si se usó IF NOT EXISTS). Esta sentencia DDL no se registra en el WAL.'
          : cmd
            ? `${queryResult.rowCount ?? 0} fila(s) afectada(s).`
            : 'La sentencia se ejecutó sin filas devueltas.';
      return (
        <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto p-4">
          <div className="border border-secondary/40 rounded bg-secondary-container/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-secondary text-base">check_circle</span>
              <p className="text-secondary font-bold text-[11px] uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-on-surface-variant font-code-sm text-code-sm">{detail}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto flex items-center justify-center">
        <p className="text-on-surface-variant text-code-sm font-code-md italic">
          Pulsa Run para ejecutar una query.
        </p>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-surface-container-high z-10">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 text-label-caps text-outline border-r border-outline-variant last:border-r-0">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-code-sm text-code-sm divide-y divide-outline-variant">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-surface-container-highest transition-colors">
              {columns.map((col, j) => (
                <td key={j} className={`px-4 py-2 border-r border-outline-variant last:border-r-0 ${j === 0 ? 'text-primary' : j === 2 ? 'text-on-surface-variant' : 'text-outline'}`}>
                  {String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
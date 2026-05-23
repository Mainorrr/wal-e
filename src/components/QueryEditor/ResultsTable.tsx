import { useEngine } from '../../context/EngineContext';

interface ResultsTableProps {
  isMongo: boolean;
}

export function ResultsTable({ isMongo }: ResultsTableProps) {
  const { activeEngineId } = useEngine();

  if (!activeEngineId) {
    return (
      <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto flex items-center justify-center">
        <p className="text-on-surface-variant text-code-sm font-code-md italic">
          No engine connected. Select a node from the sidebar.
        </p>
      </div>
    );
  }

  if (isMongo) {
    return (
      <div className="h-1/3 border-t border-outline-variant bg-surface overflow-auto p-4">
        <pre className="text-secondary-fixed-dim font-code-sm text-code-sm">

        </pre>
      </div>
    );
  }

  const columns: string[] = [];
  const rows: Record<string, unknown>[] = [];

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
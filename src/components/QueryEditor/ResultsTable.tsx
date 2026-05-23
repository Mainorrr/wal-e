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
{`[
  {
    "_id": "65609e25470d9e",
    "nombre": "Estudiante A",
    "metadata": { "last_login": "2023-11-24T14:32:00Z", "score": 95 }
  },
  {
    "_id": "65609e25470d9f",
    "nombre": "Estudiante B",
    "metadata": { "last_login": "2023-11-24T14:30:15Z", "score": 88 }
  }
]`}
        </pre>
      </div>
    );
  }

  const columns = ['ID', 'Name', 'Note', 'Timestamp'];
  const rows = [
    { ID: '001-ALPHA', Name: 'Primary-Node-Main', Note: 'Auto-recovery sequence initiated.', Timestamp: '2024-11-24 14:02:11' },
    { ID: '004-DELTA', Name: 'Secondary-Node-Edge', Note: 'LSM tree compaction in progress.', Timestamp: '2024-11-24 14:01:55' },
    { ID: '009-OMEGA', Name: 'Back-Worker-09', Note: 'Checkpoint sync complete (LSN 0/1A22B).', Timestamp: '2024-11-24 14:00:22' },
  ];

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
                  {row[col as keyof typeof row]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
import { useTransaction } from '../../context/TransactionContext';

export function TidInput() {
  const { currentTid, setTid } = useTransaction();

  return (
    <div className="flex items-center gap-2">
      <span className="font-label-caps text-label-caps text-outline">TID:</span>
      <input
        type="text"
        value={currentTid}
        onChange={(e) => setTid(e.target.value)}
        placeholder="TX-00001-A"
        className="bg-surface-container-lowest border border-outline-variant text-code-sm font-code-md text-primary px-3 py-1.5 w-36 focus:border-primary focus:ring-0 rounded outline-none"
      />
    </div>
  );
}
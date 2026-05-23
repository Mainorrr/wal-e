import type { RecoveryProtocol } from '../../../electron/types';

interface ProtocolSelectProps {
  value: RecoveryProtocol;
  onChange: (p: RecoveryProtocol) => void;
}

const PROTOCOLS: RecoveryProtocol[] = ['Undo/Redo', 'No-Undo/Redo', 'Undo/No-Redo', 'No-Undo/No-Redo'];

export function ProtocolSelect({ value, onChange }: ProtocolSelectProps) {
  return (
    <div>
      <label className="font-label-caps text-label-caps text-outline uppercase block mb-2">
        Recovery Policy
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as RecoveryProtocol)}
          className="w-full bg-surface-container-lowest border border-outline-variant text-body-md font-body-md rounded px-3 py-2 appearance-none focus:outline-none focus:border-primary transition-colors cursor-pointer"
        >
          {PROTOCOLS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="material-symbols-outlined absolute right-2 top-2 text-on-surface-variant pointer-events-none" style={{ fontSize: 20 }}>
          expand_more
        </span>
      </div>
      <p className="text-[10px] text-tertiary-fixed-dim mt-2 italic px-1">
        Active: WAL-E Optimized Recovery
      </p>
    </div>
  );
}
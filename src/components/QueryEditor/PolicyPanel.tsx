import { useState } from 'react';
import { useTransaction } from '../../context/TransactionContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';
import type { RecoveryProtocol } from '../../../electron/types';

interface PolicyInfo {
  steal: boolean;
  force: boolean;
  onMutation: string;
  onCommit: string;
  onRecovery: string;
  tradeoff: string;
}

const POLICY_INFO: Record<RecoveryProtocol, PolicyInfo> = {
  'No-Undo/No-Redo': {
    steal: true,
    force: true,
    onMutation: 'Writes are immediately flushed to disk (steal + force).',
    onCommit: 'Nothing extra needed — data is already persisted.',
    onRecovery: 'No UNDO or REDO phases. Uncommitted changes persist on disk; committed writes survive.',
    tradeoff: 'Simple but uncommitted writes persist after a crash.',
  },
  'No-Undo/Redo': {
    steal: false,
    force: false,
    onMutation: 'Writes are buffered in dirty pages (not flushed yet).',
    onCommit: 'COMMIT logged to WAL first, then dirty pages flushed to disk.',
    onRecovery: 'REDO phase replays after-images of committed transactions.',
    tradeoff: 'Better throughput at commit time; requires REDO after crash.',
  },
  'Undo/No-Redo': {
    steal: true,
    force: true,
    onMutation: 'Writes are flushed to disk immediately AND tracked in dirty buffer.',
    onCommit: 'Data already persisted — no extra flush needed.',
    onRecovery: 'UNDO phase reverses uncommitted writes using before-images.',
    tradeoff: 'Immediate persistence, but uncommitted data can leak to disk.',
  },
  'Undo/Redo': {
    steal: false,
    force: false,
    onMutation: 'Writes are buffered in dirty pages (not flushed yet).',
    onCommit: 'COMMIT logged to WAL first, then dirty pages flushed to disk.',
    onRecovery: 'UNDO reverses uncommitted writes (before-images); REDO replays committed writes (after-images).',
    tradeoff: 'Most flexible protocol; full recovery guarantee with both phases.',
  },
};

function ClassificationBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'bg-surface-container-high text-outline'
      }`}
    >
      {label}
    </span>
  );
}

function PolicySection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <MaterialSymbol icon={icon} size={14} className="text-secondary" />
        <span className="text-[10px] font-label-caps uppercase text-secondary tracking-wider">{title}</span>
      </div>
      <p className="text-[11px] text-on-surface-variant leading-relaxed pl-5">{children}</p>
    </div>
  );
}

export function PolicyPanel() {
  const { protocol } = useTransaction();
  const [isOpen, setIsOpen] = useState(false);

  const info = POLICY_INFO[protocol];

  return (
    <div className="relative flex h-full">
      {isOpen ? (
        <div className="w-72 bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden flex flex-col transition-all duration-200">
          <div className="px-4 py-2.5 bg-surface-container-highest border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MaterialSymbol icon="shield" size={16} className="text-primary" />
              <span className="font-label-caps text-label-caps text-on-surface">Recovery Policy</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant hover:text-on-surface transition-colors p-0.5"
              title="Collapse"
            >
              <MaterialSymbol icon="chevron_right" size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-sm font-bold text-primary mb-2">{protocol}</p>
              <div className="flex flex-wrap gap-1.5">
                <ClassificationBadge label={info.steal ? 'Steal' : 'No-Steal'} active={info.steal} />
                <ClassificationBadge label={info.force ? 'Force' : 'No-Force'} active={info.force} />
              </div>
            </div>

            <div className="h-px bg-outline-variant" />

            <PolicySection icon="edit" title="On Mutation">
              {info.onMutation}
            </PolicySection>

            <PolicySection icon="check_circle" title="On Commit">
              {info.onCommit}
            </PolicySection>

            <PolicySection icon="restore" title="On Recovery">
              {info.onRecovery}
            </PolicySection>

            <div className="h-px bg-outline-variant" />

            <div className="bg-surface-container-high rounded p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <MaterialSymbol icon="warning" size={14} className="text-tertiary" />
                <span className="text-[10px] font-label-caps uppercase text-tertiary tracking-wider">Tradeoff</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">{info.tradeoff}</p>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center justify-center gap-1 w-8 bg-surface-container-low border border-l-0 border-outline-variant rounded-r-lg hover:bg-surface-container transition-colors"
          title="Show Recovery Policy"
        >
          <MaterialSymbol icon="info" size={16} className="text-secondary" />
          <span
            className="text-[8px] font-label-caps uppercase tracking-tighter text-secondary"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Policy
          </span>
        </button>
      )}
    </div>
  );
}

import { Search, ChevronDown } from 'lucide-react';

export interface WALFilterState {
  tid: string;
  opType: string;
}

interface WALFiltersProps {
  filters: WALFilterState;
  onFilterChange: (filters: WALFilterState) => void;
}

export function WALFilters({ filters, onFilterChange }: WALFiltersProps) {
  return (
    <div className="flex gap-3 items-center">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-outline font-bold">TID</span>
        <div className="relative">
          <input
            type="text"
            value={filters.tid}
            onChange={(e) => onFilterChange({ ...filters, tid: e.target.value })}
            placeholder="Search TID..."
            className="bg-black border border-outline-variant text-[11px] font-code-md text-on-surface pl-6 pr-2 py-0.5 w-32 focus:border-primary focus:ring-0 rounded-sm outline-none"
          />
          <Search className="w-3 h-3 text-outline absolute left-1.5 top-1.5" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-outline font-bold">TYPE</span>
        <div className="relative">
          <select
            value={filters.opType}
            onChange={(e) => onFilterChange({ ...filters, opType: e.target.value })}
            className="bg-black border border-outline-variant text-[11px] font-code-md text-on-surface px-2 py-0.5 w-28 focus:border-primary focus:ring-0 rounded-sm appearance-none outline-none"
          >
            <option>TODAS</option>
            <option>BEGIN</option>
            <option>INSERT</option>
            <option>UPDATE</option>
            <option>DELETE</option>
            <option>COMMIT</option>
            <option>ABORT</option>
          </select>
          <ChevronDown className="w-3 h-3 text-outline absolute right-1.5 top-1.5 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
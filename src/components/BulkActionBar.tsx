import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  children: ReactNode;
}

export default function BulkActionBar({ selectedCount, onClear, children }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-slate-900 text-white rounded-lg px-4 py-3 mb-4 flex items-center justify-between animate-slide-up">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClear}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

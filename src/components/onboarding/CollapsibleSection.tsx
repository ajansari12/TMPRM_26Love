import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  description?: string;
  isComplete?: boolean;
  hasErrors?: boolean;
  answeredCount?: number;
  totalCount?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  title,
  description,
  isComplete,
  hasErrors,
  answeredCount = 0,
  totalCount = 0,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
          isOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-slate-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-500" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">{title}</h3>
              {isComplete && !hasErrors && (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              {hasErrors && <AlertCircle className="w-4 h-4 text-red-500" />}
            </div>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {answeredCount} / {totalCount} answered
          </span>
          <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isComplete ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{
                width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </button>
      {isOpen && <div className="p-4 border-t border-slate-200 bg-white">{children}</div>}
    </div>
  );
}

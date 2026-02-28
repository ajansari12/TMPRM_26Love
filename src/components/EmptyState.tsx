import { ReactNode } from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm text-center leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

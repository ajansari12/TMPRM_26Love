import { Shield, ShieldAlert, ShieldQuestion } from 'lucide-react';

interface AIConfidenceBadgeProps {
  confidence: 'high' | 'medium' | 'low';
  compact?: boolean;
}

const config = {
  high: {
    icon: Shield,
    label: 'High confidence',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  medium: {
    icon: ShieldAlert,
    label: 'Medium confidence',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  low: {
    icon: ShieldQuestion,
    label: 'Low confidence',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export default function AIConfidenceBadge({ confidence, compact = false }: AIConfidenceBadgeProps) {
  const { icon: Icon, label, className } = config[confidence];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${className}`}
        title={label}
      >
        <Icon className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

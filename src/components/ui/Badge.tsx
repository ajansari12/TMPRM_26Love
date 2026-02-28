import { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-slate-50 text-slate-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({
  variant = 'default',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

/** Maps common TMPRM statuses to badge variants */
export function getStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: 'success',
    approved: 'success',
    compliant: 'success',
    completed: 'success',
    pending: 'warning',
    in_progress: 'warning',
    under_review: 'warning',
    '1b_review': 'warning',
    '2nd_review': 'warning',
    pending_senior_approval: 'warning',
    draft: 'neutral',
    inactive: 'neutral',
    terminated: 'neutral',
    withdrawn: 'neutral',
    rejected: 'danger',
    overdue: 'danger',
    non_compliant: 'danger',
    critical: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'info',
  };
  return map[status.toLowerCase()] || 'default';
}

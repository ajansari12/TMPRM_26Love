import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';

export function formatDate(date: string | Date | null | undefined, formatStr: string = 'MMM dd, yyyy'): string {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
  } catch {
    return 'Invalid date';
  }
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

export function getDaysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return differenceInDays(dateObj, new Date());
  } catch {
    return null;
  }
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(decimals)}%`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'emerald',
    under_review: 'amber',
    onboarding: 'blue',
    offboarding: 'slate',
    terminated: 'slate',
    suspended: 'red',
    non_compliant: 'red',
    pending_approval: 'yellow',
    draft: 'slate',
    in_progress: 'blue',
    pending_review: 'amber',
    approved: 'emerald',
    rejected: 'red',
    completed: 'emerald',
    overdue: 'red',
  };
  return colors[status] || 'slate';
}

export function getTierColor(tier: string | undefined): string {
  if (!tier) return 'slate';
  if (tier.includes('5') || tier.includes('critical')) return 'red';
  if (tier.includes('4') || tier.includes('high')) return 'orange';
  if (tier.includes('3') || tier.includes('moderate')) return 'amber';
  if (tier.includes('2') || tier.includes('low')) return 'emerald';
  return 'slate';
}

export function getTierNumber(tier: string | undefined): number {
  if (!tier) return 0;
  const match = tier.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

export function truncate(str: string | null | undefined, length: number = 50): string {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

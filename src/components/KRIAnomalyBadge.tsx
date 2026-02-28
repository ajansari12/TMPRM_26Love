import { AlertTriangle, TrendingUp, TrendingDown, Zap } from 'lucide-react';

export type AnomalyType = 'spike' | 'drop' | 'trend_up' | 'trend_down' | 'deviation';

interface KRIAnomalyBadgeProps {
  anomalyType: AnomalyType;
  deviationValue: number; // standard deviations from mean
  explanation?: string;
  compact?: boolean;
}

const ANOMALY_CONFIG: Record<AnomalyType, {
  icon: typeof AlertTriangle;
  label: string;
  color: string;
  bg: string;
}> = {
  spike: { icon: TrendingUp, label: 'Spike', color: 'text-red-700', bg: 'bg-red-100' },
  drop: { icon: TrendingDown, label: 'Drop', color: 'text-blue-700', bg: 'bg-blue-100' },
  trend_up: { icon: TrendingUp, label: 'Rising', color: 'text-amber-700', bg: 'bg-amber-100' },
  trend_down: { icon: TrendingDown, label: 'Falling', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  deviation: { icon: Zap, label: 'Anomaly', color: 'text-purple-700', bg: 'bg-purple-100' },
};

export default function KRIAnomalyBadge({
  anomalyType,
  deviationValue,
  explanation,
  compact = false,
}: KRIAnomalyBadgeProps) {
  const config = ANOMALY_CONFIG[anomalyType] || ANOMALY_CONFIG.deviation;
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}
        title={explanation || `${config.label}: ${deviationValue.toFixed(1)}σ deviation`}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  }

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${config.bg} border-opacity-50`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
      <div>
        <p className={`text-xs font-semibold ${config.color}`}>
          {config.label} Detected ({deviationValue.toFixed(1)}σ)
        </p>
        {explanation && (
          <p className="text-xs text-slate-600 mt-0.5">{explanation}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Detect anomalies in a KRI value series
 */
export function detectKRIAnomalies(
  values: number[],
  currentValue: number,
  isHigherBetter: boolean
): { type: AnomalyType; deviation: number; explanation: string } | null {
  if (values.length < 5) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null;

  const deviation = (currentValue - mean) / stdDev;
  const absDeviation = Math.abs(deviation);

  // Check for significant deviation (>2σ)
  if (absDeviation >= 2) {
    if (deviation > 0) {
      return {
        type: isHigherBetter ? 'spike' : 'spike',
        deviation: absDeviation,
        explanation: `Current value deviates ${absDeviation.toFixed(1)} standard deviations above the rolling average`,
      };
    } else {
      return {
        type: 'drop',
        deviation: absDeviation,
        explanation: `Current value deviates ${absDeviation.toFixed(1)} standard deviations below the rolling average`,
      };
    }
  }

  // Check for sustained trend (5+ consecutive periods in same direction)
  if (values.length >= 5) {
    const recentValues = values.slice(-5);
    const isRising = recentValues.every((v, i) => i === 0 || v > recentValues[i - 1]);
    const isFalling = recentValues.every((v, i) => i === 0 || v < recentValues[i - 1]);

    if (isRising && absDeviation >= 1) {
      return {
        type: 'trend_up',
        deviation: absDeviation,
        explanation: 'Sustained upward trend detected across 5+ consecutive periods',
      };
    }
    if (isFalling && absDeviation >= 1) {
      return {
        type: 'trend_down',
        deviation: absDeviation,
        explanation: 'Sustained downward trend detected across 5+ consecutive periods',
      };
    }
  }

  return null;
}

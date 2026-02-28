import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import AIFeedback from './AIFeedback';
import AIConfidenceBadge from './AIConfidenceBadge';
import type { AIRiskSummary } from '../../types';

interface RiskSummaryCardProps {
  vendorId: string;
  vendorData: Record<string, unknown>;
}

export default function RiskSummaryCard({ vendorId, vendorData }: RiskSummaryCardProps) {
  const [summary, setSummary] = useState<AIRiskSummary | null>(null);
  const [expanded, setExpanded] = useState(true);

  const { loading, error, execute, submitFeedback, logId } = useAI<AIRiskSummary>({
    action: 'risk-summarize',
    vendorId,
  });

  const fetchSummary = useCallback(async () => {
    const result = await execute(vendorData);
    if (result.success && result.data) {
      setSummary(result.data as AIRiskSummary);
    }
  }, [vendorData, execute]);

  // Auto-fetch on mount
  useEffect(() => {
    if (!summary && vendorData) {
      fetchSummary();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const trendConfig = {
    improving: { icon: TrendingUp, label: 'Improving', className: 'text-green-600 bg-green-50' },
    stable: { icon: Minus, label: 'Stable', className: 'text-slate-600 bg-slate-50' },
    deteriorating: { icon: TrendingDown, label: 'Deteriorating', className: 'text-red-600 bg-red-50' },
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-900">AI Risk Summary</h3>
            <p className="text-xs text-slate-500">AI-generated executive risk narrative</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary && <AIConfidenceBadge confidence={summary.confidence} compact />}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-purple-500 animate-spin mr-2" />
              <span className="text-sm text-slate-500">Generating risk summary...</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p>{error}</p>
                <button onClick={fetchSummary} className="text-xs font-medium hover:underline mt-1">
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Summary Content */}
          {summary && !loading && (
            <>
              {/* Risk Trend */}
              {summary.risk_trend && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const trend = trendConfig[summary.risk_trend];
                    const TrendIcon = trend.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${trend.className}`}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        {trend.label} trend
                      </span>
                    );
                  })()}
                </div>
              )}

              {/* Overview */}
              <p className="text-sm text-slate-700 leading-relaxed">{summary.overview}</p>

              {/* Key Risks */}
              {summary.key_risks?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                    Key Risks
                  </h4>
                  <ul className="space-y-1.5">
                    {summary.key_risks.map((risk, i) => (
                      <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-red-400">
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {summary.strengths?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                    Strengths
                  </h4>
                  <ul className="space-y-1.5">
                    {summary.strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-green-400">
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {summary.recommendations?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1.5">
                    {summary.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* OSFI Gaps */}
              {summary.osfi_gaps?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    OSFI B-10 Compliance Gaps
                  </h4>
                  <ul className="space-y-1.5">
                    {summary.osfi_gaps.map((gap, i) => (
                      <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-orange-400">
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={fetchSummary}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Regenerate summary"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
                {logId && <AIFeedback onSubmit={submitFeedback} compact />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

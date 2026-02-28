import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Globe,
} from 'lucide-react';

interface InsightData {
  summary: string;
  key_risks: string[];
  concentration_alerts: string[];
  compliance_gaps: string[];
  recommendations: string[];
  risk_trend: 'improving' | 'stable' | 'deteriorating';
  generated_at: string;
}

const TREND_CONFIG = {
  improving: { icon: TrendingDown, label: 'Improving', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  stable: { icon: Minus, label: 'Stable', color: 'text-slate-600', bg: 'bg-slate-50' },
  deteriorating: { icon: TrendingUp, label: 'Deteriorating', color: 'text-red-600', bg: 'bg-red-50' },
};

export default function PortfolioInsights() {
  const { currentOrganization } = useOrganization();
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchCachedInsight();
    }
  }, [currentOrganization?.id]);

  async function fetchCachedInsight() {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('portfolio_insights')
        .select('insight_json, generated_at')
        .eq('organization_id', currentOrganization.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.insight_json) {
        setInsight(data.insight_json as InsightData);
      }
    } catch {
      // Table may not exist
    } finally {
      setLoading(false);
    }
  }

  async function generateInsights() {
    if (!currentOrganization?.id || generating) return;
    setGenerating(true);
    try {
      const { data } = await supabase.functions.invoke('portfolio-insights', {
        body: { organization_id: currentOrganization.id },
      });

      if (data?.success && data?.data) {
        setInsight(data.data);
        setExpanded(true);
      }
    } catch {
      // Function may not be deployed
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return null;

  const trend = insight?.risk_trend || 'stable';
  const trendConfig = TREND_CONFIG[trend];
  const TrendIcon = trendConfig.icon;

  return (
    <div className="bg-white rounded-lg shadow border border-slate-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-800">AI Portfolio Insights</h3>
            {insight ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`flex items-center gap-1 text-xs font-medium ${trendConfig.color}`}>
                  <TrendIcon className="w-3 h-3" />
                  {trendConfig.label}
                </span>
                <span className="text-xs text-slate-400">
                  Updated {new Date(insight.generated_at).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Generate AI-powered portfolio analysis</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateInsights();
            }}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : insight ? 'Refresh' : 'Generate'}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && insight && (
        <div className="border-t border-slate-100 p-5 space-y-4">
          {/* Summary */}
          <p className="text-sm text-slate-700 leading-relaxed">{insight.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Key Risks */}
            <div className="bg-red-50/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h4 className="text-xs font-semibold text-red-800">Key Portfolio Risks</h4>
              </div>
              <ul className="space-y-1.5">
                {insight.key_risks.map((risk, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">-</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-emerald-50/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-semibold text-emerald-800">Recommendations</h4>
              </div>
              <ul className="space-y-1.5">
                {insight.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-emerald-700 flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">+</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Concentration Alerts */}
            {insight.concentration_alerts.length > 0 && insight.concentration_alerts[0] !== 'No concentration alerts' && (
              <div className="bg-amber-50/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-semibold text-amber-800">Concentration Alerts</h4>
                </div>
                <ul className="space-y-1.5">
                  {insight.concentration_alerts.map((alert, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">!</span>
                      {alert}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Compliance Gaps */}
            {insight.compliance_gaps.length > 0 && insight.compliance_gaps[0] !== 'No major compliance gaps identified' && (
              <div className="bg-blue-50/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <h4 className="text-xs font-semibold text-blue-800">Compliance Gaps</h4>
                </div>
                <ul className="space-y-1.5">
                  {insight.compliance_gaps.map((gap, i) => (
                    <li key={i} className="text-xs text-blue-700 flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5">!</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

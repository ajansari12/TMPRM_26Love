import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import type { AIRiskPrediction } from '../../types';

interface RiskTrajectoryChartProps {
  vendorId: string;
  vendorName: string;
  currentRiskRating?: number;
  assessmentHistory?: Array<{
    date: string;
    risk_rating: number;
  }>;
}

interface ChartDataPoint {
  date: string;
  risk_rating: number;
  predicted?: boolean;
  lower?: number;
  upper?: number;
}

const TRAJECTORY_CONFIG = {
  improving: { icon: TrendingDown, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Improving' },
  stable: { icon: Minus, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Stable' },
  deteriorating: { icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50', label: 'Deteriorating' },
};

export default function RiskTrajectoryChart({
  vendorId,
  vendorName,
  currentRiskRating,
  assessmentHistory = [],
}: RiskTrajectoryChartProps) {
  const [prediction, setPrediction] = useState<AIRiskPrediction | null>(null);
  const [expanded, setExpanded] = useState(false);

  const { loading, execute } = useAI<AIRiskPrediction>({ action: 'risk-predict', vendorId });

  useEffect(() => {
    if (vendorId && currentRiskRating && assessmentHistory.length > 0) {
      fetchPrediction();
    }
  }, [vendorId]);

  async function fetchPrediction() {
    const result = await execute({
      vendor_name: vendorName,
      current_risk_rating: currentRiskRating,
      assessment_history: assessmentHistory.map(a => ({
        date: a.date,
        risk_rating: a.risk_rating,
      })),
    });

    if (result.success && result.data) {
      setPrediction(result.data as AIRiskPrediction);
    }
  }

  const chartData: ChartDataPoint[] = useMemo(() => {
    const data: ChartDataPoint[] = [];

    // Historical data points
    assessmentHistory
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((h) => {
        data.push({
          date: new Date(h.date).toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }),
          risk_rating: h.risk_rating,
        });
      });

    // Current
    if (currentRiskRating && (data.length === 0 || data[data.length - 1].risk_rating !== currentRiskRating)) {
      data.push({
        date: 'Current',
        risk_rating: currentRiskRating,
      });
    }

    // Predicted future
    if (prediction) {
      const ci = prediction.confidence_interval || 0.15;
      if (prediction.predicted_score_6m) {
        data.push({
          date: '+6 mo',
          risk_rating: prediction.predicted_score_6m,
          predicted: true,
          lower: Math.max(0, prediction.predicted_score_6m * (1 - ci)),
          upper: Math.min(25, prediction.predicted_score_6m * (1 + ci)),
        });
      }
      if (prediction.predicted_score_12m) {
        data.push({
          date: '+12 mo',
          risk_rating: prediction.predicted_score_12m,
          predicted: true,
          lower: Math.max(0, prediction.predicted_score_12m * (1 - ci)),
          upper: Math.min(25, prediction.predicted_score_12m * (1 + ci)),
        });
      }
    }

    return data;
  }, [assessmentHistory, currentRiskRating, prediction]);

  if (assessmentHistory.length === 0 && !currentRiskRating) return null;

  const trajectory = prediction?.trajectory || 'stable';
  const config = TRAJECTORY_CONFIG[trajectory] || TRAJECTORY_CONFIG.stable;
  const TrajectoryIcon = config.icon;

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center`}>
            <TrajectoryIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-slate-700">Risk Trajectory</h4>
            <p className="text-xs text-slate-400">
              {prediction ? `${config.label} trend` : 'Historical risk trend'}
              {prediction?.tier_change_risk && (
                <span className="text-amber-600 font-medium ml-1">(tier change risk)</span>
              )}
            </p>
          </div>
        </div>
        {loading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4">
          {chartData.length > 1 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 25]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value.toFixed(2), 'Risk Rating']}
                  />
                  <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Critical', fontSize: 10, fill: '#ef4444' }} />
                  <ReferenceLine y={10} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'High', fontSize: 10, fill: '#f97316' }} />

                  {/* Confidence interval area */}
                  {prediction && (
                    <Area
                      dataKey="upper"
                      stroke="none"
                      fill="#e2e8f0"
                      fillOpacity={0.4}
                      connectNulls={false}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="risk_rating"
                    stroke="#334155"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={payload.predicted ? '#8b5cf6' : '#334155'}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center">
              <p className="text-sm text-slate-400">Insufficient data for trajectory analysis</p>
            </div>
          )}

          {/* Risk Factors */}
          {prediction?.risk_factors && prediction.risk_factors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-600 mb-2">Key Risk Factors</p>
              <div className="space-y-1">
                {prediction.risk_factors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-slate-600">{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {prediction?.reasoning && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 italic">{prediction.reasoning}</p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-800" /> Historical
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> Predicted
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-2 bg-slate-200 rounded" /> Confidence interval
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

import { AlertTriangle, Shield, TrendingUp, Activity, Info } from 'lucide-react';
import { TierCalculationResult, tierConfig } from '../../lib/riskCalculations';
import { TierLevel } from '../../types';

interface RiskScorePanelProps {
  result: TierCalculationResult | null;
  questionsAnswered: number;
  totalQuestions: number;
}

export function RiskScorePanel({
  result,
  questionsAnswered,
  totalQuestions,
}: RiskScorePanelProps) {
  if (!result) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
            <Activity className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Risk Assessment</h3>
            <p className="text-sm text-slate-500">Complete the assessment to see results</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-500">
            Answer assessment questions to calculate the preliminary risk tier
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {questionsAnswered} of {totalQuestions} questions answered
          </p>
        </div>
      </div>
    );
  }

  const config = tierConfig[result.tier];
  const completionPercentage =
    totalQuestions > 0 ? Math.round((questionsAnswered / totalQuestions) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div
        className={`p-4 ${config.bgClass.replace('text-', 'text-white bg-').replace('-100', '-600')}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <div>
              <h3 className="font-semibold text-lg">Preliminary Risk Tier</h3>
              <p className="text-sm opacity-90">{result.vendor_archetype?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{config.label}</p>
            <p className="text-sm opacity-90">{config.description}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {result.is_auto_critical && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800">Auto-Critical Trigger</p>
                <p className="text-sm text-red-700 mt-1">
                  {result.auto_critical_rule_name || 'Critical threshold exceeded'}
                </p>
                {result.auto_critical_matched_conditions && (
                  <ul className="mt-2 text-xs text-red-600 space-y-1">
                    {result.auto_critical_matched_conditions.map((condition, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {condition}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <ScoreCard
            label="Impact Score"
            value={result.impact_score}
            maxValue={5}
            color="blue"
          />
          <ScoreCard
            label="Likelihood Score"
            value={result.likelihood_score}
            maxValue={5}
            color="amber"
          />
          <ScoreCard
            label="Risk Rating"
            value={result.risk_rating}
            maxValue={25}
            color={getRiskColor(result.tier)}
          />
        </div>

        {result.criticality_score !== undefined && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Criticality Score</span>
              <span className="text-sm font-bold text-slate-900">
                {result.criticality_score.toFixed(2)} / 5
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-700 transition-all"
                style={{ width: `${(result.criticality_score / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Assessment Completion</span>
            <span className="font-medium text-slate-900">{completionPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {questionsAnswered} of {totalQuestions} questions answered
          </p>
        </div>

        <TierGuidance tier={result.tier} reviewFrequency={config.reviewFrequency} />
      </div>
    </div>
  );
}

interface ScoreCardProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

function ScoreCard({ label, value, maxValue, color }: ScoreCardProps) {
  const percentage = (value / maxValue) * 100;
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    emerald: 'bg-emerald-500',
    slate: 'bg-slate-500',
  };

  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value.toFixed(2)}</p>
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
        <div
          className={`h-full ${colorClasses[color] || 'bg-slate-500'} transition-all`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}

function getRiskColor(tier: TierLevel): string {
  const colorMap: Record<TierLevel, string> = {
    tier_5_critical: 'red',
    tier_4_high: 'orange',
    tier_3_moderate: 'amber',
    tier_2_low: 'emerald',
    tier_1_informational: 'slate',
  };
  return colorMap[tier];
}

interface TierGuidanceProps {
  tier: TierLevel;
  reviewFrequency: string;
}

function TierGuidance({ tier, reviewFrequency }: TierGuidanceProps) {
  const guidance: Record<TierLevel, { text: string; dueDiligence: string[] }> = {
    tier_5_critical: {
      text: 'Requires comprehensive due diligence, executive approval, and ongoing monitoring.',
      dueDiligence: [
        'Full on-site due diligence assessment',
        'Board-level approval required',
        'Detailed exit strategy documentation',
        'Quarterly performance reviews',
        'Annual reassessment',
      ],
    },
    tier_4_high: {
      text: 'Requires enhanced due diligence and senior management approval.',
      dueDiligence: [
        'Enhanced due diligence questionnaire',
        'Senior management approval',
        'Semi-annual performance reviews',
        'Documented continuity plan',
      ],
    },
    tier_3_moderate: {
      text: 'Standard due diligence with regular monitoring.',
      dueDiligence: [
        'Standard due diligence assessment',
        'Manager-level approval',
        'Annual performance reviews',
      ],
    },
    tier_2_low: {
      text: 'Basic due diligence with periodic reviews.',
      dueDiligence: ['Basic due diligence checklist', 'Supervisor approval', 'Biennial reviews'],
    },
    tier_1_informational: {
      text: 'Minimal oversight required.',
      dueDiligence: ['Basic vendor registration', 'As-needed reviews'],
    },
  };

  const tierGuidance = guidance[tier];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">Review Frequency: {reviewFrequency}</p>
          <p className="text-xs text-blue-700 mt-1">{tierGuidance.text}</p>
          <ul className="mt-2 space-y-1">
            {tierGuidance.dueDiligence.map((item, idx) => (
              <li key={idx} className="text-xs text-blue-600 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

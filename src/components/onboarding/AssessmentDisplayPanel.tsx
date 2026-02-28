import { useState } from 'react';
import { ChevronDown, ChevronRight, BarChart3, AlertTriangle, CheckCircle2, Pencil, ArrowRight } from 'lucide-react';
import {
  OnboardingAssessmentData,
  ASSESSMENT_DISPLAY_SECTIONS,
  TIER_DISPLAY_CONFIG,
  getAssessmentCompletionStats,
  extractScoreFromValue,
} from '../../lib/assessmentValidation';

interface AssessmentDisplayPanelProps {
  assessmentData: OnboardingAssessmentData;
  completedBy?: string;
  completedAt?: string;
  original1aAnswers?: Record<string, unknown>;
  modifiedBy1b?: boolean;
  modifiedAt1b?: string;
  changeSummary?: Record<string, { old: unknown; new: unknown }>;
}

export function AssessmentDisplayPanel({
  assessmentData,
  completedBy,
  completedAt,
  original1aAnswers,
  modifiedBy1b,
  modifiedAt1b,
  changeSummary,
}: AssessmentDisplayPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['criticality']));

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const stats = getAssessmentCompletionStats(assessmentData);
  const tierConfig = assessmentData.calculated_tier
    ? TIER_DISPLAY_CONFIG[assessmentData.calculated_tier]
    : null;

  const changeCount = changeSummary ? Object.keys(changeSummary).length : 0;

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Inherent Risk Assessment</h3>
              {completedBy && (
                <p className="text-sm text-slate-500">
                  Completed by 1st Line {completedAt && `on ${new Date(completedAt).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">{stats.answered} / {stats.total} questions</div>
            <div className="w-24 h-2 bg-slate-200 rounded-full mt-1">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {modifiedBy1b && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Pencil className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-800">Reviewed and Updated by 1B</p>
              <p className="text-sm text-blue-700 mt-0.5">
                {changeCount > 0
                  ? `${changeCount} answer${changeCount !== 1 ? 's were' : ' was'} modified by the 1B reviewer`
                  : 'Assessment was reviewed by 1B with no changes'}
                {modifiedAt1b && ` on ${new Date(modifiedAt1b).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        )}

        {assessmentData.is_auto_critical && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Auto-Critical Triggered</p>
              <p className="text-sm text-red-700 mt-0.5">
                {assessmentData.auto_critical_rule_name || 'Built-in rule matched'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreCard
            label="Impact Score"
            value={assessmentData.calculated_impact_score}
            maxValue={5}
            color="blue"
          />
          <ScoreCard
            label="Likelihood Score"
            value={assessmentData.calculated_likelihood_score}
            maxValue={5}
            color="amber"
          />
          <ScoreCard
            label="Risk Rating"
            value={assessmentData.calculated_risk_rating}
            maxValue={25}
            color="red"
            showRaw
          />
          <div className="bg-white rounded-lg border p-3">
            <p className="text-xs text-slate-500 mb-1">Preliminary Tier</p>
            {tierConfig ? (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-medium ${tierConfig.bgClass}`}>
                {tierConfig.label}
              </span>
            ) : (
              <span className="text-slate-400">Not calculated</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {ASSESSMENT_DISPLAY_SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const sectionAnswered = section.questions.filter(
            (q) => assessmentData[q.fieldKey] !== undefined && assessmentData[q.fieldKey] !== null
          ).length;
          const sectionTotal = section.questions.length;
          const sectionChangedCount = changeSummary
            ? section.questions.filter(q => changeSummary[q.fieldKey as string]).length
            : 0;

          return (
            <div key={section.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <h4 className="font-medium text-slate-900">{section.title}</h4>
                    {section.description && (
                      <p className="text-sm text-slate-500">{section.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sectionChangedCount > 0 && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {sectionChangedCount} updated
                    </span>
                  )}
                  {sectionAnswered === sectionTotal && sectionTotal > 0 && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  <span className="text-sm text-slate-500">
                    {sectionAnswered} / {sectionTotal}
                  </span>
                  <SectionScoreBadge
                    questions={section.questions}
                    data={assessmentData}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-4">
                    {section.questions.map((question) => {
                      const value = assessmentData[question.fieldKey];
                      const score = extractScoreFromValue(value);
                      const scoreLabel = question.scoreLabels && score !== null
                        ? question.scoreLabels[score]
                        : null;
                      const fieldChange = changeSummary?.[question.fieldKey as string];

                      return (
                        <div
                          key={question.id}
                          className={`bg-white rounded-lg border p-4 ${
                            fieldChange ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-700">{question.label}</p>
                                {fieldChange && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                                    1B UPDATED
                                  </span>
                                )}
                              </div>
                              {fieldChange && (
                                <FieldChangeDiff
                                  oldValue={fieldChange.old}
                                  newValue={fieldChange.new}
                                  questionType={question.type}
                                  scoreLabels={question.scoreLabels}
                                />
                              )}
                              {!fieldChange && (
                                <>
                                  {value !== undefined && value !== null ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      {question.type === 'boolean' ? (
                                        <span className="text-sm text-slate-600">
                                          {value ? 'Yes' : 'No'}
                                        </span>
                                      ) : question.type === 'text' ? (
                                        <span className="text-sm text-slate-600">
                                          {String(value)}
                                        </span>
                                      ) : (
                                        <>
                                          {score !== null && <ScoreIndicator score={score} />}
                                          <span className="text-sm text-slate-600">
                                            {scoreLabel || (score !== null ? `Score: ${score}` : String(value))}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-sm text-slate-400 italic">Not answered</p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldChangeDiff({
  oldValue,
  newValue,
  questionType,
  scoreLabels,
}: {
  oldValue: unknown;
  newValue: unknown;
  questionType: string;
  scoreLabels?: Record<number, string>;
}) {
  const formatValue = (val: unknown): string => {
    if (val === undefined || val === null) return 'Not answered';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (scoreLabels) {
      const score = extractScoreFromValue(val);
      if (score !== null && scoreLabels[score]) return scoreLabels[score];
    }
    return String(val);
  };

  const oldDisplay = formatValue(oldValue);
  const newDisplay = formatValue(newValue);
  const oldScore = extractScoreFromValue(oldValue);
  const newScore = extractScoreFromValue(newValue);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400 line-through">{oldDisplay}</span>
        <ArrowRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-blue-700 font-medium">{newDisplay}</span>
      </div>
      {oldScore !== null && newScore !== null && questionType === 'score' && (
        <div className="flex items-center gap-2">
          <ScoreIndicator score={oldScore} muted />
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <ScoreIndicator score={newScore} />
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  value,
  maxValue,
  color,
  showRaw = false,
}: {
  label: string;
  value?: number;
  maxValue: number;
  color: 'blue' | 'amber' | 'red';
  showRaw?: boolean;
}) {
  const colorClasses = {
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };

  return (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClasses[color]}`}>
        {value !== undefined ? value.toFixed(1) : '-'}
        {!showRaw && <span className="text-sm font-normal text-slate-400"> / {maxValue}</span>}
      </p>
    </div>
  );
}

function ScoreIndicator({ score, muted = false }: { score: number; muted?: boolean }) {
  const getColor = (s: number) => {
    if (muted) return 'bg-slate-300';
    if (s >= 4) return 'bg-red-500';
    if (s >= 3) return 'bg-amber-500';
    if (s >= 2) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2 h-4 rounded-sm ${i <= score ? getColor(score) : 'bg-slate-200'}`}
        />
      ))}
    </div>
  );
}

function SectionScoreBadge({
  questions,
  data,
}: {
  questions: { fieldKey: keyof OnboardingAssessmentData }[];
  data: OnboardingAssessmentData;
}) {
  const scores = questions
    .map((q) => extractScoreFromValue(data[q.fieldKey]))
    .filter((v): v is number => v !== null);

  if (scores.length === 0) return null;

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const getBgColor = (s: number) => {
    if (s >= 4) return 'bg-red-100 text-red-700';
    if (s >= 3) return 'bg-amber-100 text-amber-700';
    if (s >= 2) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getBgColor(avgScore)}`}>
      Avg: {avgScore.toFixed(1)}
    </span>
  );
}

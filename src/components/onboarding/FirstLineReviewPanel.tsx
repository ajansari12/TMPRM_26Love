import { useState, useMemo, useCallback, useEffect } from 'react';
import { Save, RotateCcw, AlertTriangle, Pencil, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { assessmentSections, AssessmentSection } from '../../lib/assessmentQuestions';
import { loadAssessmentAnswersFromRow, VALID_QUESTION_IDS } from '../../lib/assessmentColumnMapping';
import { calculateRiskScores, TierCalculationResult } from '../../lib/riskCalculations';
import { OnboardingAssessmentData, extractScoreFromValue } from '../../lib/assessmentValidation';
import { CollapsibleSection } from './CollapsibleSection';
import { QuestionRenderer } from './QuestionRenderer';
import { RiskScorePanel } from './RiskScorePanel';
import { supabase } from '../../lib/supabase';

interface FirstLineReviewPanelProps {
  requestId: string;
  assessmentData: OnboardingAssessmentData;
  organizationId: string;
  reviewerUserId: string;
  onAssessmentSaved?: () => void;
}

export function FirstLineReviewPanel({
  requestId,
  assessmentData,
  organizationId,
  reviewerUserId,
  onAssessmentSaved,
}: FirstLineReviewPanelProps) {
  const originalAnswers = useMemo(
    () => loadAssessmentAnswersFromRow(assessmentData as unknown as Record<string, unknown>),
    [assessmentData]
  );

  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({ ...originalAnswers }));
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedOnce, setSavedOnce] = useState(!!assessmentData.assessment_modified_by_1b);

  const original1aSnapshot = useMemo(() => {
    if (assessmentData.original_1a_assessment_answers) {
      return assessmentData.original_1a_assessment_answers as Record<string, unknown>;
    }
    return originalAnswers;
  }, [assessmentData.original_1a_assessment_answers, originalAnswers]);

  const changedQuestions = useMemo(() => {
    const changed: Record<string, { original: unknown; updated: unknown }> = {};
    for (const key of Object.keys(answers)) {
      if (!VALID_QUESTION_IDS.has(key)) continue;
      const orig = original1aSnapshot[key];
      const curr = answers[key];
      if (JSON.stringify(orig) !== JSON.stringify(curr)) {
        changed[key] = { original: orig, updated: curr };
      }
    }
    return changed;
  }, [answers, original1aSnapshot]);

  const changeCount = Object.keys(changedQuestions).length;

  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setHasUnsavedChanges(true);
  }, []);

  const handleResetQuestion = useCallback((questionId: string) => {
    const originalValue = original1aSnapshot[questionId];
    setAnswers(prev => ({ ...prev, [questionId]: originalValue }));
    setHasUnsavedChanges(true);
  }, [original1aSnapshot]);

  const handleResetAll = useCallback(() => {
    setAnswers({ ...original1aSnapshot });
    setHasUnsavedChanges(true);
  }, [original1aSnapshot]);

  const contextFlags = useMemo(() => ({
    hasDataAccess: answers.q30_has_system_access === true,
    usesSubcontractors: answers.q38_uses_subcontractors === true,
    hasFormalContract: answers.q50_has_formal_contract === true,
    isCritical: ['yes_disruption_stops_operations', 'yes_critical'].includes(
      answers.q15_supports_essential_operations as string || ''
    ),
  }), [answers]);

  const filteredSections = useMemo(() => {
    return assessmentSections.map(section => ({
      ...section,
      questions: section.questions.filter(q => {
        if (q.conditional) {
          const depValue = answers[q.conditional.dependsOn];
          if (depValue !== q.conditional.showWhen) return false;
        }
        return true;
      }),
    })).filter(s => s.questions.length > 0);
  }, [answers]);

  const totalQuestions = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.questions.length, 0),
    [filteredSections]
  );

  const answeredCount = useMemo(
    () => filteredSections.reduce((sum, s) =>
      sum + s.questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== null).length, 0),
    [filteredSections, answers]
  );

  const riskResult = useMemo((): TierCalculationResult | null => {
    if (answeredCount < 3) return null;
    const scores = calculateRiskScores(answers, 0);
    return {
      tier: scores.calculated_tier,
      is_auto_critical: scores.is_auto_critical || false,
      auto_critical_rule_name: scores.is_auto_critical ? 'Auto-critical triggered' : undefined,
      criticality_score: scores.criticality_score,
      impact_score: scores.impact_score,
      likelihood_score: scores.likelihood_score,
      risk_rating: scores.risk_rating,
      vendor_archetype: scores.vendor_archetype,
    } as TierCalculationResult;
  }, [answers, answeredCount]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const snapshot1a = assessmentData.original_1a_assessment_answers || original1aSnapshot;

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        assessment_modified_by_1b: changeCount > 0,
        assessment_modified_by_1b_user: reviewerUserId,
        assessment_modified_at_1b: new Date().toISOString(),
      };

      if (!assessmentData.original_1a_assessment_answers) {
        updatePayload.original_1a_assessment_answers = snapshot1a;
      }

      for (const [key, value] of Object.entries(answers)) {
        if (VALID_QUESTION_IDS.has(key)) {
          updatePayload[key] = value ?? null;
        }
      }

      if (riskResult) {
        updatePayload.calculated_tier = riskResult.tier;
        updatePayload.calculated_impact_score = riskResult.impact_score;
        updatePayload.calculated_likelihood_score = riskResult.likelihood_score;
        updatePayload.calculated_risk_rating = riskResult.risk_rating;
        updatePayload.calculated_criticality_score = riskResult.criticality_score;
        updatePayload.is_auto_critical = riskResult.is_auto_critical;
        updatePayload.auto_critical_rule_name = riskResult.auto_critical_rule_name || null;

        const currentTier = riskResult.tier;
        const requires2nd = currentTier === 'tier_5_critical' || currentTier === 'tier_4_high' || riskResult.is_auto_critical;
        updatePayload.requires_2nd_line_review = requires2nd;
      }

      const changeSummary: Record<string, { old: unknown; new: unknown }> = {};
      for (const [key, diff] of Object.entries(changedQuestions)) {
        changeSummary[key] = { old: diff.original, new: diff.updated };
      }
      updatePayload.assessment_1b_change_summary = changeCount > 0 ? changeSummary : null;

      const { error } = await supabase
        .from('onboarding_requests')
        .update(updatePayload)
        .eq('id', requestId);

      if (error) throw error;

      await supabase.from('onboarding_audit_log').insert({
        organization_id: organizationId,
        request_id: requestId,
        action_type: '1b_assessment_review',
        action_description: `1B reviewer updated assessment (${changeCount} question${changeCount !== 1 ? 's' : ''} modified)`,
        performed_by: reviewerUserId,
        new_values: { changes_count: changeCount, change_summary: changeSummary },
      });

      setHasUnsavedChanges(false);
      setSavedOnce(true);
      toast.success(`Assessment saved${changeCount > 0 ? ` (${changeCount} change${changeCount !== 1 ? 's' : ''})` : ''}`);
      onAssessmentSaved?.();
    } catch (err) {
      console.error('Failed to save assessment:', err);
      toast.error('Failed to save assessment changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Pencil className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">1B Assessment Review</h3>
              <p className="text-sm text-blue-700 mt-1">
                Review each answer provided by the 1A requestor. You may update any answers based on your risk expertise.
                Changes are tracked and visible to downstream reviewers.
              </p>
            </div>
          </div>
          {savedOnce && !hasUnsavedChanges && (
            <div className="flex items-center gap-1.5 text-green-700 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved</span>
            </div>
          )}
        </div>
        {changeCount > 0 && (
          <div className="mt-3 flex items-center justify-between bg-blue-100 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-blue-800">
              {changeCount} answer{changeCount !== 1 ? 's' : ''} modified from 1A original
            </span>
            <button
              type="button"
              onClick={handleResetAll}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset all
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredSections.map((section) => {
            const sectionAnswered = section.questions.filter(
              q => answers[q.id] !== undefined && answers[q.id] !== null
            ).length;
            const sectionChanged = section.questions.filter(
              q => changedQuestions[q.id]
            ).length;

            return (
              <CollapsibleSection
                key={section.id}
                id={section.id}
                title={section.title}
                description={
                  sectionChanged > 0
                    ? `${section.description} -- ${sectionChanged} modified`
                    : section.description
                }
                answeredCount={sectionAnswered}
                totalCount={section.questions.length}
                isComplete={sectionAnswered === section.questions.length}
                hasErrors={false}
                defaultOpen={section.id === 'section1'}
              >
                {section.questions.map((question) => {
                  const isChanged = !!changedQuestions[question.id];
                  const origValue = original1aSnapshot[question.id];

                  return (
                    <div key={question.id} className="relative">
                      {isChanged && (
                        <div className="flex items-center justify-between mb-1 px-1">
                          <OriginalValueBadge value={origValue} question={question} />
                          <button
                            type="button"
                            onClick={() => handleResetQuestion(question.id)}
                            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Revert
                          </button>
                        </div>
                      )}
                      <div className={isChanged ? 'ring-2 ring-blue-300 rounded-lg p-1 -m-1' : ''}>
                        <QuestionRenderer
                          question={question}
                          value={answers[question.id]}
                          onChange={handleAnswerChange}
                        />
                      </div>
                    </div>
                  );
                })}
              </CollapsibleSection>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <RiskScorePanel
              result={riskResult}
              questionsAnswered={answeredCount}
              totalQuestions={totalQuestions}
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                hasUnsavedChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Assessment Review' : 'No Changes to Save'}
            </button>

            {hasUnsavedChanges && (
              <p className="text-xs text-amber-600 text-center">
                You have unsaved changes. Save before confirming the review.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OriginalValueBadge({
  value,
  question,
}: {
  value: unknown;
  question: { type: string; options?: Array<{ value: string; label: string }> };
}) {
  let displayValue = 'Not answered';

  if (value !== undefined && value !== null) {
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (typeof value === 'string' && question.options) {
      const opt = question.options.find(o => o.value === value);
      displayValue = opt ? opt.label : String(value);
    } else {
      displayValue = String(value);
    }
  }

  if (displayValue.length > 60) {
    displayValue = displayValue.substring(0, 57) + '...';
  }

  return (
    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded inline-flex items-center gap-1">
      <AlertTriangle className="w-3 h-3 text-amber-500" />
      1A original: {displayValue}
    </span>
  );
}

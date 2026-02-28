import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { assessmentSections, AssessmentSection } from '../lib/assessmentQuestions';
import {
  calculateRiskScores,
  tierConfig,
  checkAutoCriticalRules,
  AutoCriticalRule,
  AutoCriticalMatch,
  OrganizationTierConfig,
  OrganizationOSFIWeights,
  convertOrgTierConfigToThresholds,
} from '../lib/riskCalculations';
import {
  determineVendorArchetype,
  getVendorProfile,
  isQuestionRelevantForProfile,
  VendorArchetype,
} from '../lib/vendorProfiles';
import { Vendor, ServiceCategory, ProviderType, TieringAssessment, TierLevel, AssessmentTask } from '../types';
import { ArrowLeft, ArrowRight, Save, CheckCircle, AlertCircle, Info, Shield, Building2, GitCompare, ArrowUpRight, ArrowDownRight, Minus, Zap, XCircle, Clock, Calendar, History, ChevronDown, ChevronUp, AlertTriangle, Brain } from 'lucide-react';
import { isValidUUID } from '../lib/utils';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import AssessmentAssistant from '../components/ai/AssessmentAssistant';

export default function AssessmentWizard() {
  const { vendorId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [showProfileInfo, setShowProfileInfo] = useState(true);
  const [previousAssessment, setPreviousAssessment] = useState<TieringAssessment | null>(null);
  const [tierChangeJustification, setTierChangeJustification] = useState('');
  const [showComparison, setShowComparison] = useState(true);
  const [autoCriticalRules, setAutoCriticalRules] = useState<AutoCriticalRule[]>([]);
  const [autoCriticalOverride, setAutoCriticalOverride] = useState(false);
  const [autoCriticalOverrideReason, setAutoCriticalOverrideReason] = useState('');
  const [orgTierConfig, setOrgTierConfig] = useState<OrganizationTierConfig[]>([]);
  const [orgOsfiWeights, setOrgOsfiWeights] = useState<OrganizationOSFIWeights | null>(null);
  const [currentTask, setCurrentTask] = useState<AssessmentTask | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<TieringAssessment[]>([]);
  const [expandedQuestionHistory, setExpandedQuestionHistory] = useState<Record<string, boolean>>({});
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(false);

  const assessmentType = searchParams.get('type') || 'initial';
  const previousAssessmentId = searchParams.get('previousAssessmentId');
  const taskId = searchParams.get('taskId');
  const isReassessment =
    assessmentType === 'periodic_review' ||
    assessmentType === 'reassessment' ||
    assessmentType === 'material_change' ||
    assessmentType === 'contract_renewal';

  // Auto-save draft answers to localStorage
  const draftKey = `assessment-draft-${vendorId}-${assessmentType}`;
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);

  // Restore draft on mount (only for new assessments, not reassessments with prefilled answers)
  useEffect(() => {
    if (draftRestored || isReassessment || previousAssessmentId) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const { answers: savedAnswers, section, savedAt } = JSON.parse(saved);
        const savedDate = new Date(savedAt);
        const hoursSince = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60);
        // Only restore drafts less than 72 hours old
        if (hoursSince < 72 && savedAnswers && Object.keys(savedAnswers).length > 0) {
          setAnswers(savedAnswers);
          setCurrentSection(section || 0);
          setLastAutoSave(savedDate);
        }
      }
    } catch {
      // Ignore parse errors
    }
    setDraftRestored(true);
  }, [draftKey, draftRestored, isReassessment, previousAssessmentId]);

  // Auto-save answers every time they change (debounced by React batching)
  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ answers, section: currentSection, savedAt: new Date().toISOString() })
      );
      setLastAutoSave(new Date());
    } catch {
      // localStorage full or unavailable
    }
  }, [answers, currentSection, draftKey]);

  // Clear draft after successful submission
  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (vendorId && currentOrganization) {
      fetchVendor();
      fetchAutoCriticalRules();
      fetchOrgConfig();
      fetchAssessmentHistory();
      if (previousAssessmentId) {
        fetchPreviousAssessment();
      } else if (isReassessment) {
        fetchLatestAssessment();
      }
      if (taskId) {
        fetchTask();
      }
    }
  }, [vendorId, currentOrganization, previousAssessmentId, taskId, isReassessment]);

  const fetchTask = async () => {
    if (!taskId || !currentOrganization?.id) return;
    try {
      const { data, error } = await supabase
        .from('assessment_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setCurrentTask(data);
        if (data.status === 'pending') {
          await supabase
            .from('assessment_tasks')
            .update({ status: 'in_progress', updated_at: new Date().toISOString() })
            .eq('id', taskId);
        }
      }
    } catch (error) {
      logger.error('Error fetching task:', error);
    }
  };

  const fetchOrgConfig = async () => {
    if (!currentOrganization?.id) return;

    const [tierRes, osfiRes] = await Promise.all([
      supabase
        .from('organization_tier_config')
        .select('*')
        .eq('organization_id', currentOrganization.id),
      supabase
        .from('organization_osfi_weights')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle()
    ]);

    if (tierRes.data) setOrgTierConfig(tierRes.data);
    if (osfiRes.data) setOrgOsfiWeights(osfiRes.data);
  };

  const fetchAutoCriticalRules = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('auto_critical_rules')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) throw error;
      setAutoCriticalRules(data || []);
    } catch (error) {
      logger.error('Error fetching auto-critical rules:', error);
    }
  };

  const fetchPreviousAssessment = async () => {
    if (!previousAssessmentId) return;

    try {
      const { data, error } = await supabase
        .from('tiering_assessments')
        .select('*')
        .eq('id', previousAssessmentId)
        .single();

      if (error) throw error;
      setPreviousAssessment(data);

      const prevAnswers: Record<string, unknown> = {};
      Object.keys(data).forEach((key) => {
        if (key.startsWith('q') && data[key] !== null) {
          prevAnswers[key] = data[key];
        }
      });
      setAnswers(prevAnswers);
    } catch (error) {
      logger.error('Error fetching previous assessment:', error);
    }
  };

  const fetchLatestAssessment = async () => {
    if (!vendorId || !currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('tiering_assessments')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('organization_id', currentOrganization.id)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreviousAssessment(data);

        const prevAnswers: Record<string, unknown> = {};
        Object.keys(data).forEach((key) => {
          if (key.startsWith('q') && data[key] !== null) {
            prevAnswers[key] = data[key];
          }
        });
        setAnswers(prevAnswers);
      }
    } catch (error) {
      logger.error('Error fetching latest assessment:', error);
    }
  };

  const fetchAssessmentHistory = async () => {
    if (!vendorId || !currentOrganization?.id) return;
    try {
      const { data, error } = await supabase
        .from('tiering_assessments')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('organization_id', currentOrganization.id)
        .order('assessment_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAssessmentHistory(data || []);
    } catch (error) {
      logger.error('Error fetching assessment history:', error);
    }
  };

  const fetchVendor = async () => {
    if (!currentOrganization || !vendorId) return;
    try {
      let query = supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      if (isValidUUID(vendorId)) {
        query = query.eq('id', vendorId);
      } else {
        query = query.eq('vendor_id', vendorId.toUpperCase());
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Vendor not found. Please check the vendor ID and try again.');
        return;
      }

      setVendor(data);
    } catch (error: unknown) {
      const err = error as Error;
      setError(err.message);
    }
  };

  const vendorArchetype = useMemo<VendorArchetype>(() => {
    if (!vendor?.service_category || !vendor?.provider_type) return 'general';
    return determineVendorArchetype(
      vendor.service_category as ServiceCategory,
      vendor.provider_type as ProviderType
    );
  }, [vendor?.service_category, vendor?.provider_type]);

  const vendorProfile = useMemo(() => {
    if (!vendor?.service_category || !vendor?.provider_type) return null;
    return getVendorProfile(
      vendor.service_category as ServiceCategory,
      vendor.provider_type as ProviderType
    );
  }, [vendor?.service_category, vendor?.provider_type]);

  const contextFlags = useMemo(() => ({
    hasDataAccess: answers.q30_has_system_access === true,
    usesSubcontractors: answers.q38_uses_subcontractors === true,
    hasFormalContract: answers.q50_has_formal_contract === true,
    isCritical: answers.q15_supports_essential_operations === 'yes_disruption_stops_operations' ||
      answers.q15_supports_essential_operations === 'yes_critical',
  }), [answers]);

  const isBasicConditionalMet = (conditional: { dependsOn: string; showWhen: unknown } | undefined): boolean => {
    if (!conditional) return true;
    const dependentValue = answers[conditional.dependsOn];
    return dependentValue === conditional.showWhen;
  };

  const filteredSections = useMemo<AssessmentSection[]>(() => {
    if (!vendor) return assessmentSections;

    return assessmentSections.map(section => ({
      ...section,
      questions: section.questions.filter(question => {
        const basicConditional = isBasicConditionalMet(question.conditional);
        if (!basicConditional) return false;

        if (!question.profileConfig) return true;

        return isQuestionRelevantForProfile(
          question.profileConfig,
          vendorArchetype,
          vendor.service_category as ServiceCategory,
          vendor.provider_type as ProviderType,
          contextFlags
        );
      }),
    })).filter(section => section.questions.length > 0);
  }, [vendor, vendorArchetype, contextFlags, answers]);

  // Auto-reset currentSection if it's out of bounds
  useEffect(() => {
    if (filteredSections.length > 0 && currentSection >= filteredSections.length) {
      logger.warn(`currentSection (${currentSection}) is out of bounds for filteredSections (${filteredSections.length}). Resetting to 0.`);
      setCurrentSection(0);
    }
  }, [filteredSections.length, currentSection]);

  const handleAnswer = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const canProceed = (): boolean => {
    if (currentSection >= filteredSections.length) return true;
    const section = filteredSections[currentSection];
    if (!section) return false;

    return section.questions.every((q) => {
      if (!isBasicConditionalMet(q.conditional)) return true;

      const answer = answers[q.id];
      if (q.type === 'boolean') {
        return answer !== undefined;
      }
      if (q.type === 'checkbox') {
        return answer && (answer as string[]).length > 0;
      }
      return answer !== undefined && answer !== '';
    });
  };

  const handleNext = () => {
    if (currentSection < filteredSections.length - 1) {
      setCurrentSection(currentSection + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handlePrevious = () => {
    if (showSummary) {
      setShowSummary(false);
    } else if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const calculateScores = () => {
    let totalScore = 0;
    let scoredQuestions = 0;

    filteredSections.forEach((section) => {
      section.questions.forEach((question) => {
        if (question.options && isBasicConditionalMet(question.conditional)) {
          const answer = answers[question.id];
          const option = question.options.find((opt) => opt.value === answer);
          if (option?.score) {
            totalScore += option.score;
            scoredQuestions++;
          }
        }
      });
    });

    const averageScore = scoredQuestions > 0 ? totalScore / scoredQuestions : 0;
    return { totalScore, scoredQuestions, averageScore };
  };

  const calculateCurrentRiskScores = () => {
    const scores = calculateScores();
    const tierThresholds = orgTierConfig.length > 0
      ? convertOrgTierConfigToThresholds(orgTierConfig)
      : undefined;
    return calculateRiskScores(
      answers,
      scores.averageScore,
      vendor || undefined,
      vendorArchetype,
      tierThresholds,
      orgOsfiWeights || undefined,
      autoCriticalRules
    );
  };

  const getScoreChange = (current: number | undefined, previous: number | undefined) => {
    if (!current || !previous) return { change: 0, percentage: 0, isSignificant: false };
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage, isSignificant: Math.abs(percentage) > 20 };
  };

  const getPreviousAnswer = (questionId: string): unknown => {
    if (!previousAssessment) return undefined;
    return (previousAssessment as Record<string, unknown>)[questionId];
  };

  const hasAnswerChanged = (questionId: string): boolean => {
    if (!previousAssessment) return false;
    const prevAnswer = getPreviousAnswer(questionId);
    const currentAnswer = answers[questionId];
    if (Array.isArray(prevAnswer) && Array.isArray(currentAnswer)) {
      if (prevAnswer.length !== currentAnswer.length) return true;
      return !prevAnswer.every((v) => currentAnswer.includes(v));
    }
    return prevAnswer !== currentAnswer;
  };

  const formatAnswerDisplay = (
    answer: unknown,
    question: { type: string; options?: Array<{ value: string; label: string }> }
  ): string => {
    if (answer === undefined || answer === null) return 'Not answered';
    if (question.type === 'boolean') {
      return answer === true ? 'Yes' : answer === false ? 'No' : 'Not answered';
    }
    if (question.options) {
      if (Array.isArray(answer)) {
        return answer
          .map((v) => question.options?.find((o) => o.value === v)?.label || v)
          .join(', ');
      }
      const option = question.options.find((o) => o.value === answer);
      return option?.label || String(answer);
    }
    return String(answer);
  };

  const getQuestionHistory = (questionId: string): Array<{
    date: string;
    value: unknown;
    tier?: string;
  }> => {
    return assessmentHistory
      .filter((a) => (a as Record<string, unknown>)[questionId] !== undefined)
      .map((a) => ({
        date: a.assessment_date || '',
        value: (a as Record<string, unknown>)[questionId],
        tier: a.calculated_tier || undefined,
      }));
  };

  const toggleQuestionHistory = (questionId: string) => {
    setExpandedQuestionHistory((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const changedAnswersCount = useMemo(() => {
    if (!previousAssessment) return 0;
    let count = 0;
    filteredSections.forEach((section) => {
      section.questions.forEach((q) => {
        if (isBasicConditionalMet(q.conditional) && hasAnswerChanged(q.id)) {
          count++;
        }
      });
    });
    return count;
  }, [previousAssessment, answers, filteredSections]);

  const currentScores = useMemo(() => {
    if (!vendor) return null;
    return calculateCurrentRiskScores();
  }, [answers, vendor, vendorArchetype, orgTierConfig, orgOsfiWeights, autoCriticalRules]);

  const autoCriticalMatch = useMemo<AutoCriticalMatch | null>(() => {
    if (!vendor || autoCriticalRules.length === 0) return null;
    return checkAutoCriticalRules(autoCriticalRules, answers as Partial<TieringAssessment>, vendor);
  }, [answers, vendor, autoCriticalRules]);

  const builtInAutoCritical = useMemo(() => {
    if (answers.q15_supports_essential_operations === 'yes_disruption_stops_operations') {
      return {
        rule_name: 'Essential Operations (Built-in)',
        matched_conditions: ['Supports essential banking operations - disruption would stop operations'],
      };
    }

    const q15Score = answers.q15_supports_essential_operations === 'yes_critical' ? 4 :
      answers.q15_supports_essential_operations === 'yes_important' ? 3 : 1;
    const q16Score = typeof answers.q16_essential_to_business === 'string' ? parseInt(answers.q16_essential_to_business) || 1 : 1;
    const q17Score = typeof answers.q17_failure_impact === 'string' ? parseInt(answers.q17_failure_impact) || 1 : 1;
    const criticalityScore = (q15Score + q16Score + q17Score) / 3;

    if (criticalityScore >= 4.5) {
      return {
        rule_name: 'High Criticality Score (Built-in)',
        matched_conditions: [`Criticality score (${criticalityScore.toFixed(2)}) >= 4.5`],
      };
    }

    return null;
  }, [answers]);

  const isAutoCritical = !autoCriticalOverride && (autoCriticalMatch !== null || builtInAutoCritical !== null);
  const activeAutoCriticalTrigger = autoCriticalMatch || builtInAutoCritical;

  const tierChanged = useMemo(() => {
    if (!previousAssessment || !currentScores) return false;
    return previousAssessment.calculated_tier !== currentScores.calculated_tier;
  }, [previousAssessment, currentScores]);

  const requiresJustification = useMemo(() => {
    if (!previousAssessment || !currentScores) return false;
    const riskChange = getScoreChange(currentScores.risk_rating, previousAssessment.risk_rating);
    return tierChanged || riskChange.isSignificant;
  }, [tierChanged, previousAssessment, currentScores]);

  const handleSubmit = async () => {
    if (requiresJustification && !tierChangeJustification.trim()) {
      setError('Please provide a justification for the tier/risk change');
      return;
    }

    if (autoCriticalOverride && !autoCriticalOverrideReason.trim()) {
      setError('Please provide a justification for overriding the auto-critical determination');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const scores = calculateScores();
      const tierThresholds = orgTierConfig.length > 0
        ? convertOrgTierConfigToThresholds(orgTierConfig)
        : undefined;

      const riskScores = calculateRiskScores(
        answers,
        scores.averageScore,
        vendor || undefined,
        vendorArchetype,
        tierThresholds,
        orgOsfiWeights || undefined,
        autoCriticalRules
      );

      if (isAutoCritical) {
        riskScores.calculated_tier = 'tier_5_critical';
        riskScores.is_auto_critical = true;
      }

      if (autoCriticalOverride) {
        riskScores.is_auto_critical = false;
      }

      const assessmentData: Record<string, unknown> = {
        vendor_id: vendorId,
        status: 'completed',
        assessment_type: assessmentType,
        assessment_date: new Date().toISOString().split('T')[0],
        vendor_archetype: vendorArchetype,
        organization_id: currentOrganization?.id,
        ...answers,
        ...riskScores,
      };

      if (activeAutoCriticalTrigger) {
        assessmentData.auto_critical_rule_name = activeAutoCriticalTrigger.rule_name;
        if ('rule_id' in activeAutoCriticalTrigger && activeAutoCriticalTrigger.rule_id) {
          assessmentData.auto_critical_rule_id = activeAutoCriticalTrigger.rule_id;
        }
      }

      if (autoCriticalOverride) {
        assessmentData.auto_critical_override = true;
        assessmentData.auto_critical_override_reason = autoCriticalOverrideReason.trim();
      }

      if (previousAssessment) {
        assessmentData.previous_assessment_id = previousAssessment.id;
        assessmentData.previous_tier = previousAssessment.calculated_tier;
        assessmentData.previous_risk_rating = previousAssessment.risk_rating;
      }

      if (tierChangeJustification.trim()) {
        assessmentData.tier_change_justification = tierChangeJustification.trim();
      }

      const { data: newAssessment, error: assessmentError } = await supabase
        .from('tiering_assessments')
        .insert([assessmentData])
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      const finalTier = isAutoCritical ? 'tier_5_critical' : riskScores.calculated_tier;

      const vendorUpdateData: Record<string, unknown> = {
        tier: finalTier,
        risk_rating: riskScores.risk_rating,
        impact_score: riskScores.impact_score,
        likelihood_score: riskScores.likelihood_score,
        is_critical: isAutoCritical,
        last_review_date: new Date().toISOString().split('T')[0],
        last_assessment_id: newAssessment?.id,
      };

      if (vendor?.status === 'pending_assessment') {
        vendorUpdateData.status = 'active';
      }

      let reviewDays: number | null = null;
      if (orgTierConfig.length > 0 && finalTier) {
        const orgTierInfo = orgTierConfig.find(c => c.tier_level === finalTier);
        reviewDays = orgTierInfo?.review_frequency_days ?? null;
      } else if (finalTier) {
        reviewDays = tierConfig[finalTier as TierLevel]?.reviewDays ?? null;
      }

      if (reviewDays) {
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + reviewDays);
        vendorUpdateData.next_review_date = nextReview.toISOString().split('T')[0];
      }

      await supabase
        .from('vendors')
        .update(vendorUpdateData)
        .eq('id', vendorId);

      const tierChanged = previousAssessment && previousAssessment.calculated_tier !== finalTier;
      const isCriticalVendor = finalTier === 'tier_5_critical';
      const requiresValidation = tierChanged || isCriticalVendor;

      if (taskId) {
        await supabase
          .from('assessment_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user?.id,
            related_assessment_id: newAssessment?.id,
            validation_required: requiresValidation,
          })
          .eq('id', taskId);

        if (requiresValidation) {
          await supabase.from('assessment_tasks').insert({
            organization_id: currentOrganization?.id,
            vendor_id: vendorId,
            task_type: 'reassessment_validation',
            status: 'pending',
            priority: isCriticalVendor ? 'high' : 'normal',
            assigned_defense_line: '2nd',
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            trigger_reason: tierChanged
              ? `Tier changed from ${previousAssessment?.calculated_tier} to ${finalTier}. Validation required.`
              : 'Critical vendor reassessment requires 2nd line validation.',
            related_assessment_id: newAssessment?.id,
            related_task_id: taskId,
            notes: `2nd line validation required for ${vendor?.legal_name} reassessment.`,
          });
        }
      } else {
        await supabase
          .from('assessment_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user?.id,
            related_assessment_id: newAssessment?.id,
          })
          .eq('vendor_id', vendorId)
          .eq('organization_id', currentOrganization?.id)
          .in('status', ['pending', 'in_progress']);
      }

      clearDraft();
      navigate(`/vendors/${vendorId}`);
    } catch (error: unknown) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to complete assessments</p>
        </div>
      </div>
    );
  }

  if (!vendor && error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/vendors')}
            className="flex items-center text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Vendors
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Vendor Not Found</h2>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              {error}
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => navigate('/vendors')}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Back to Vendors
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-56 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-80 bg-slate-200 rounded animate-pulse" />
        </div>
        <CardSkeleton count={1} />
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (filteredSections.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/vendors/${vendorId}`)}
            className="flex items-center text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Vendor
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Cannot Start Assessment</h2>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              This vendor's profile is incomplete. Please complete the required fields before starting an assessment.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-amber-900 mb-2">Missing Required Information:</h3>
              <ul className="space-y-1 text-sm text-amber-800">
                {!vendor.service_category && (
                  <li className="flex items-center">
                    <XCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    Service Category
                  </li>
                )}
                {!vendor.provider_type && (
                  <li className="flex items-center">
                    <XCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    Provider Type
                  </li>
                )}
                {vendor.service_category && vendor.provider_type && (
                  <li className="flex items-center">
                    <Info className="w-4 h-4 mr-2 flex-shrink-0" />
                    The current categorization results in no applicable assessment questions
                  </li>
                )}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate(`/vendors/${vendorId}/edit`)}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Edit Vendor Profile
              </button>
              <button
                onClick={() => navigate(`/vendors/${vendorId}`)}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Return to Vendor Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const section = filteredSections[currentSection];

  // Safety check: if section is undefined, show error state
  if (!section) {
    logger.error(`Section at index ${currentSection} is undefined. filteredSections length: ${filteredSections.length}`);
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/vendors/${vendorId}`)}
            className="flex items-center text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Vendor
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Assessment Error</h2>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              There was an error loading the assessment section. This may be due to filtering issues or navigation problems.
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-red-900 mb-2">Debug Information:</h3>
              <ul className="space-y-1 text-sm text-red-800">
                <li>Current Section Index: {currentSection}</li>
                <li>Total Sections Available: {filteredSections.length}</li>
                <li>Vendor: {vendor?.legal_name || 'Unknown'}</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setCurrentSection(0);
                  setShowSummary(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reset to First Section
              </button>
              <button
                onClick={() => navigate(`/vendors/${vendorId}`)}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Return to Vendor Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progress = ((currentSection + 1) / filteredSections.length) * 100;
  const totalQuestions = filteredSections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div className={`${aiAssistantEnabled ? 'max-w-6xl' : 'max-w-4xl'} mx-auto`}>
      <div className={`${aiAssistantEnabled ? 'flex gap-6' : ''}`}>
      {/* Main content */}
      <div className={`${aiAssistantEnabled ? 'flex-1 min-w-0' : ''}`}>
      <div className="mb-6">
        <button
          onClick={() => navigate(`/vendors/${vendorId}`)}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vendor
        </button>

        {currentTask && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900">
                    {currentTask.task_type === 'periodic_reassessment' && 'Periodic Reassessment'}
                    {currentTask.task_type === 'material_change' && 'Material Change Assessment'}
                    {currentTask.task_type === 'contract_renewal' && 'Contract Renewal Assessment'}
                    {currentTask.task_type === 'bulk_import_assessment' && 'Initial Assessment (Bulk Import)'}
                  </h3>
                  {currentTask.trigger_reason && (
                    <p className="text-sm text-blue-700 mt-1">{currentTask.trigger_reason}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    {currentTask.due_date && (
                      <span className="inline-flex items-center text-xs text-blue-700">
                        <Calendar className="w-3.5 h-3.5 mr-1" />
                        Due: {new Date(currentTask.due_date).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      currentTask.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      currentTask.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {currentTask.priority.charAt(0).toUpperCase() + currentTask.priority.slice(1)} Priority
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {isReassessment ? 'Periodic Risk Review' : 'Tiering Assessment'}
            </h1>
            <div className="flex items-center gap-3">
              <p className="text-slate-600">{vendor.legal_name}</p>
              {lastAutoSave && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Save className="w-3 h-3" />
                  Draft auto-saved
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {previousAssessment && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  showComparison
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <GitCompare className="w-4 h-4" />
                <span>{showComparison ? 'Hide Comparison' : 'Compare with Previous'}</span>
              </button>
            )}
            <button
              onClick={() => setAiAssistantEnabled(!aiAssistantEnabled)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                aiAssistantEnabled
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">{aiAssistantEnabled ? 'AI On' : 'AI Assist'}</span>
            </button>
          </div>
        </div>

        {vendorProfile && showProfileInfo && (
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-slate-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-slate-900">
                    Assessment Profile: {vendorProfile.label}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">{vendorProfile.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {vendorProfile.riskEmphasis.map((emphasis) => (
                      <span
                        key={emphasis}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700"
                      >
                        {emphasis.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    This assessment includes {totalQuestions} questions tailored to this vendor type.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProfileInfo(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="sr-only">Dismiss</span>
                &times;
              </button>
            </div>
          </div>
        )}

        {showComparison && previousAssessment && currentScores && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-blue-900 flex items-center">
                <GitCompare className="w-5 h-5 mr-2" />
                Score Comparison with Previous Assessment
              </h3>
              {changedAnswersCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {changedAnswersCount} answer{changedAnswersCount !== 1 ? 's' : ''} changed
                </span>
              )}
            </div>
            {(() => {
              const prevTierInfo = previousAssessment.calculated_tier && tierConfig[previousAssessment.calculated_tier as TierLevel];
              const currTierInfo = currentScores.calculated_tier && tierConfig[currentScores.calculated_tier as TierLevel];
              const impactChange = getScoreChange(currentScores.impact_score, previousAssessment.impact_score);
              const likelihoodChange = getScoreChange(currentScores.likelihood_score, previousAssessment.likelihood_score);
              const ratingChange = getScoreChange(currentScores.risk_rating, previousAssessment.risk_rating);

              return (
                <div className="bg-white rounded-lg border border-blue-100 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-blue-100 bg-slate-50">
                        <th className="text-left py-2 px-4 font-medium text-slate-600 w-28"></th>
                        <th className="text-center py-2 px-4 font-medium text-slate-600">Impact</th>
                        <th className="text-center py-2 px-4 font-medium text-slate-600">Likelihood</th>
                        <th className="text-center py-2 px-4 font-medium text-slate-600">Rating</th>
                        <th className="text-center py-2 px-4 font-medium text-slate-600">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-blue-50">
                        <td className="py-3 px-4 font-medium text-slate-500">Previous</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {previousAssessment.impact_score?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {previousAssessment.likelihood_score?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {previousAssessment.risk_rating?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {prevTierInfo && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${prevTierInfo.bgClass}`}>
                              {prevTierInfo.label}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-blue-50 bg-blue-50/50">
                        <td className="py-3 px-4 font-medium text-blue-700">Current</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-900">
                          {currentScores.impact_score?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-900">
                          {currentScores.likelihood_score?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-900">
                          {currentScores.risk_rating?.toFixed(2) || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {currTierInfo && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${currTierInfo.bgClass}`}>
                              {currTierInfo.label}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className={tierChanged ? 'bg-amber-50' : ''}>
                        <td className="py-3 px-4 font-medium text-slate-500">Change</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center font-medium ${
                            impactChange.change < 0 ? 'text-green-600' : impactChange.change > 0 ? 'text-red-600' : 'text-slate-500'
                          }`}>
                            {impactChange.change < 0 ? (
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                            ) : impactChange.change > 0 ? (
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            ) : (
                              <Minus className="w-3 h-3 mr-0.5" />
                            )}
                            {impactChange.change >= 0 ? '+' : ''}{impactChange.change.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center font-medium ${
                            likelihoodChange.change < 0 ? 'text-green-600' : likelihoodChange.change > 0 ? 'text-red-600' : 'text-slate-500'
                          }`}>
                            {likelihoodChange.change < 0 ? (
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                            ) : likelihoodChange.change > 0 ? (
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            ) : (
                              <Minus className="w-3 h-3 mr-0.5" />
                            )}
                            {likelihoodChange.change >= 0 ? '+' : ''}{likelihoodChange.change.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center font-medium ${
                            ratingChange.change < 0 ? 'text-green-600' : ratingChange.change > 0 ? 'text-red-600' : 'text-slate-500'
                          }`}>
                            {ratingChange.change < 0 ? (
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                            ) : ratingChange.change > 0 ? (
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            ) : (
                              <Minus className="w-3 h-3 mr-0.5" />
                            )}
                            {ratingChange.change >= 0 ? '+' : ''}{ratingChange.change.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {tierChanged ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-200 text-amber-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              TIER CHANGE
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs text-slate-500">
                              <Minus className="w-3 h-3 mr-1" />
                              No change
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        <div className="mt-4 bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-slate-900 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Section {currentSection + 1} of {filteredSections.length}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!showSummary ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
            {section.osfiSection && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <Info className="w-3 h-3 mr-1" />
                {section.osfiSection}
              </span>
            )}
          </div>
          <p className="text-slate-600 mb-6">{section.description}</p>

          <div className="space-y-6">
            {section.questions.map((question) => {
              if (!isBasicConditionalMet(question.conditional)) {
                return null;
              }

              const answerChanged = hasAnswerChanged(question.id);
              const prevAnswer = getPreviousAnswer(question.id);
              const questionHistory = getQuestionHistory(question.id);
              const isHistoryExpanded = expandedQuestionHistory[question.id];

              return (
                <div
                  key={question.id}
                  className={`border-b pb-6 last:border-0 rounded-lg p-4 -mx-4 ${
                    answerChanged && showComparison
                      ? 'bg-amber-50 border-amber-200 border'
                      : 'border-slate-200'
                  }`}
                >
                  <label className="block">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-900 mb-2 block">{question.text}</span>
                        {answerChanged && showComparison && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-800">
                            Changed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {question.osfiReference && (
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {question.osfiReference}
                          </span>
                        )}
                        {questionHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleQuestionHistory(question.id)}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            <History className="w-3 h-3 mr-1" />
                            History
                            {isHistoryExpanded ? (
                              <ChevronUp className="w-3 h-3 ml-1" />
                            ) : (
                              <ChevronDown className="w-3 h-3 ml-1" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {question.helpText && (
                      <span className="text-sm text-slate-500 mb-3 block">{question.helpText}</span>
                    )}

                    {showComparison && previousAssessment && prevAnswer !== undefined && (
                      <div className="mb-4 bg-white border border-slate-200 rounded-lg p-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Previous Answer</p>
                            <p className="text-slate-700">{formatAnswerDisplay(prevAnswer, question)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Current Answer</p>
                            <p className="text-slate-900 font-medium">
                              {formatAnswerDisplay(answers[question.id], question)}
                            </p>
                          </div>
                          <div className="flex items-center justify-center">
                            {answerChanged ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Changed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                <Minus className="w-3 h-3 mr-1" />
                                No Change
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {isHistoryExpanded && questionHistory.length > 0 && (
                      <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center">
                          <History className="w-3.5 h-3.5 mr-1" />
                          Answer History (Audit Trail)
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {questionHistory.map((entry, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between text-xs bg-white rounded p-2 border border-slate-100"
                            >
                              <div className="flex-1">
                                <span className="text-slate-500">
                                  {new Date(entry.date).toLocaleDateString()}
                                </span>
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="text-slate-700">
                                  {formatAnswerDisplay(entry.value, question)}
                                </span>
                              </div>
                              {entry.tier && tierConfig[entry.tier as TierLevel] && (
                                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${tierConfig[entry.tier as TierLevel].bgClass}`}>
                                  {tierConfig[entry.tier as TierLevel].label}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {question.type === 'radio' && question.options && (
                      <div className="space-y-2 mt-3">
                        {question.options.map((option) => (
                          <label
                            key={option.value}
                            className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                              answers[question.id] === option.value
                                ? 'border-slate-400 bg-slate-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={option.value}
                              checked={answers[question.id] === option.value}
                              onChange={(e) => handleAnswer(question.id, e.target.value)}
                              className="mt-1 text-slate-900 focus:ring-slate-500"
                            />
                            <span className="ml-3 text-slate-900">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'checkbox' && question.options && (
                      <div className="space-y-2 mt-3">
                        {question.options.map((option) => (
                          <label
                            key={option.value}
                            className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                              (answers[question.id] as string[] | undefined)?.includes(option.value)
                                ? 'border-slate-400 bg-slate-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              value={option.value}
                              checked={
                                (answers[question.id] as string[] | undefined)?.includes(option.value) || false
                              }
                              onChange={(e) => {
                                const currentValues = (answers[question.id] as string[]) || [];
                                const newValues = e.target.checked
                                  ? [...currentValues, option.value]
                                  : currentValues.filter((v: string) => v !== option.value);
                                handleAnswer(question.id, newValues);
                              }}
                              className="mt-1 rounded text-slate-900 focus:ring-slate-500"
                            />
                            <span className="ml-3 text-slate-900">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'boolean' && (
                      <div className="flex items-center space-x-4 mt-3">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={question.id}
                            checked={answers[question.id] === true}
                            onChange={() => handleAnswer(question.id, true)}
                            className="text-slate-900 focus:ring-slate-500"
                          />
                          <span className="ml-2 text-slate-900">Yes</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={question.id}
                            checked={answers[question.id] === false}
                            onChange={() => handleAnswer(question.id, false)}
                            className="text-slate-900 focus:ring-slate-500"
                          />
                          <span className="ml-2 text-slate-900">No</span>
                        </label>
                      </div>
                    )}

                    {question.type === 'text' && (
                      <input
                        type="text"
                        value={(answers[question.id] as string) || ''}
                        onChange={(e) => handleAnswer(question.id, e.target.value)}
                        className="mt-3 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                    )}

                    {question.type === 'textarea' && (
                      <textarea
                        value={(answers[question.id] as string) || ''}
                        onChange={(e) => handleAnswer(question.id, e.target.value)}
                        rows={4}
                        className="mt-3 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                    )}

                    {question.type === 'number' && (
                      <input
                        type="number"
                        value={(answers[question.id] as number) || ''}
                        onChange={(e) => handleAnswer(question.id, parseFloat(e.target.value))}
                        className="mt-3 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                    )}
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={handlePrevious}
              disabled={currentSection === 0}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span>{currentSection === filteredSections.length - 1 ? 'Review' : 'Next'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-center mb-6">
            <CheckCircle className="w-16 h-16 text-emerald-600" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 text-center mb-4">
            Assessment Complete
          </h2>
          <p className="text-slate-600 text-center mb-8">
            Review your answers below before submitting the assessment.
          </p>

          <div className="bg-slate-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">Assessment Summary</h3>
            {(() => {
              const scores = calculateScores();
              return (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-slate-600">Questions Answered</p>
                    <p className="text-2xl font-bold text-slate-900">{scores.scoredQuestions}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Score</p>
                    <p className="text-2xl font-bold text-slate-900">{scores.totalScore.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Average Score</p>
                    <p className="text-2xl font-bold text-slate-900">{scores.averageScore.toFixed(2)}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {vendorProfile && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Assessment Profile</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    This assessment was tailored for <strong>{vendorProfile.label}</strong> vendors,
                    with emphasis on {vendorProfile.riskEmphasis.slice(0, 3).join(', ').replace(/_/g, ' ')}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeAutoCriticalTrigger && (
            <div className={`rounded-lg p-4 mb-6 ${autoCriticalOverride ? 'bg-slate-50 border border-slate-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <Zap className={`w-5 h-5 mt-0.5 ${autoCriticalOverride ? 'text-slate-500' : 'text-red-600'}`} />
                  <div>
                    <h4 className={`font-medium ${autoCriticalOverride ? 'text-slate-700 line-through' : 'text-red-900'}`}>
                      Auto-Critical Classification Triggered
                    </h4>
                    <p className={`text-sm mt-1 ${autoCriticalOverride ? 'text-slate-500' : 'text-red-700'}`}>
                      Rule: <strong>{activeAutoCriticalTrigger.rule_name}</strong>
                    </p>
                    <div className="mt-2">
                      <p className={`text-xs font-medium ${autoCriticalOverride ? 'text-slate-500' : 'text-red-700'}`}>
                        Matched Conditions:
                      </p>
                      <ul className={`mt-1 text-sm list-disc list-inside ${autoCriticalOverride ? 'text-slate-500' : 'text-red-600'}`}>
                        {activeAutoCriticalTrigger.matched_conditions.map((condition, idx) => (
                          <li key={idx}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                    {autoCriticalOverride && (
                      <p className="mt-2 text-sm text-amber-700 font-medium">
                        Override applied - vendor will not be classified as Critical
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setAutoCriticalOverride(!autoCriticalOverride)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
                    autoCriticalOverride
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {autoCriticalOverride ? (
                    <>
                      <Zap className="w-4 h-4" />
                      Restore Auto-Critical
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Override
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {autoCriticalOverride && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-amber-900 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Override Justification Required
              </h4>
              <p className="text-sm text-amber-700 mb-3">
                You are overriding an auto-critical determination. This requires 2nd line approval.
                Please provide a detailed justification.
              </p>
              <textarea
                value={autoCriticalOverrideReason}
                onChange={(e) => setAutoCriticalOverrideReason(e.target.value)}
                placeholder="Explain why this vendor should not be classified as Critical despite meeting auto-critical criteria..."
                rows={3}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          )}

          {previousAssessment && currentScores && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                <GitCompare className="w-4 h-4 mr-2" />
                Comparison with Previous Assessment
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-2">Previous Assessment</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Tier:</span>
                      {previousAssessment.calculated_tier && tierConfig[previousAssessment.calculated_tier as TierLevel] && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${tierConfig[previousAssessment.calculated_tier as TierLevel].bgClass}`}>
                          {tierConfig[previousAssessment.calculated_tier as TierLevel].label}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Risk Rating:</span>
                      <span className="text-sm font-medium">{previousAssessment.risk_rating?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Impact:</span>
                      <span className="text-sm font-medium">{previousAssessment.impact_score?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Likelihood:</span>
                      <span className="text-sm font-medium">{previousAssessment.likelihood_score?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">New Assessment</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Tier:</span>
                      {currentScores.calculated_tier && tierConfig[currentScores.calculated_tier as TierLevel] && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${tierConfig[currentScores.calculated_tier as TierLevel].bgClass}`}>
                          {tierConfig[currentScores.calculated_tier as TierLevel].label}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Risk Rating:</span>
                      <span className="text-sm font-medium">{currentScores.risk_rating?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Impact:</span>
                      <span className="text-sm font-medium">{currentScores.impact_score?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Likelihood:</span>
                      <span className="text-sm font-medium">{currentScores.likelihood_score?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {requiresJustification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-amber-900 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Justification Required
              </h4>
              <p className="text-sm text-amber-700 mb-3">
                {tierChanged
                  ? 'The tier has changed from the previous assessment. Please provide a justification for this change.'
                  : 'There is a significant change (>20%) in the risk rating. Please provide a justification.'}
              </p>
              <textarea
                value={tierChangeJustification}
                onChange={(e) => setTierChangeJustification(e.target.value)}
                placeholder="Explain the reasons for the tier/risk change..."
                rows={3}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          )}

          <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
            {filteredSections.map((section, idx) => {
              const sectionAnswers = section.questions
                .filter((q) => isBasicConditionalMet(q.conditional))
                .filter((q) => answers[q.id] !== undefined);

              if (sectionAnswers.length === 0) return null;

              return (
                <div key={idx} className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">{section.title}</h4>
                  <div className="space-y-2 text-sm">
                    {sectionAnswers.map((q) => (
                      <div key={q.id} className="flex justify-between">
                        <span className="text-slate-600">{q.text.replace(/^Q\d+[a-z]?\.\s/, '')}</span>
                        <button
                          onClick={() => {
                            setCurrentSection(idx);
                            setShowSummary(false);
                          }}
                          className="text-slate-900 hover:underline ml-4"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-200">
            <button
              onClick={handlePrevious}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Questions</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading || (requiresJustification && !tierChangeJustification.trim()) || (autoCriticalOverride && !autoCriticalOverrideReason.trim())}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Submitting...' : 'Submit Assessment'}</span>
            </button>
          </div>
        </div>
      )}
      </div>
      {/* AI Assistant Sidebar */}
      {aiAssistantEnabled && vendor && !showSummary && (
        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-24">
            <AssessmentAssistant
              vendorId={vendor.id}
              vendorName={vendor.legal_name}
              serviceCategory={vendor.service_category}
              providerType={vendor.provider_type}
              country={vendor.country}
              currentSection={currentSection}
              sections={filteredSections}
              answers={answers}
              previousAnswers={previousAssessment ? (previousAssessment as unknown as Record<string, unknown>) : undefined}
              onAcceptSuggestion={(questionId, value) => {
                setAnswers((prev) => ({ ...prev, [questionId]: value }));
              }}
            />
          </div>
        </aside>
      )}
      </div>
    </div>
  );
}

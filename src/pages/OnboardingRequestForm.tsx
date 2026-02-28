import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { logger } from '../lib/logger';
import { OnboardingRequestFormData, SensitiveDataType, OnboardingStatus } from '../types/workflow';
import { findLeastLoadedReviewer } from '../lib/reviewerAssignment';
import { toast } from 'sonner';
import {
  SERVICE_CATEGORIES,
  PROVIDER_TYPES,
  CONTRACT_DURATIONS,
  BUSINESS_UNITS,
} from '../lib/constants';
import { assessmentSections, AssessmentSection } from '../lib/assessmentQuestions';
import { loadAssessmentAnswersFromRow, buildOldColumnPayload } from '../lib/assessmentColumnMapping';
import {
  calculateRiskScores,
  TierCalculationResult,
  AutoCriticalRule,
} from '../lib/riskCalculations';
import {
  determineVendorArchetype,
  isQuestionRelevantForProfile,
} from '../lib/vendorProfiles';
import { CollapsibleSection, QuestionRenderer, RiskScorePanel } from '../components/onboarding';
import TemplateSelector from '../components/TemplateSelector';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  Building2,
  Briefcase,
  ClipboardCheck,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  AlertCircle,
  Copy,
  Sparkles,
} from 'lucide-react';

const STEPS = [
  { id: 'vendor', title: 'Vendor Information', icon: Building2 },
  { id: 'service', title: 'Service & Business Context', icon: Briefcase },
  { id: 'assessment', title: 'Risk Assessment', icon: ClipboardCheck },
  { id: 'calculation', title: 'Risk Calculation', icon: BarChart3 },
  { id: 'review', title: 'Review & Submit', icon: CheckCircle2 },
];

const ASSESSMENT_SECTIONS_CONFIG = [
  {
    id: 'section_a',
    title: 'A. Criticality & Business Impact',
    description: 'Evaluate the criticality of this third party to your operations',
    sectionIds: ['section1'],
  },
  {
    id: 'section_b',
    title: 'B. Service Classification',
    description: 'Categorize the type of service provided',
    sectionIds: ['section2'],
  },
  {
    id: 'section_c',
    title: 'C. Dependency Level',
    description: 'Assess the level of dependency on this third party',
    sectionIds: ['section3'],
  },
  {
    id: 'section_d',
    title: 'D. Financial & Operational Impact',
    description: 'Evaluate financial significance and operational effort',
    sectionIds: ['section4'],
  },
  {
    id: 'section_e',
    title: 'E. Strategic & Reputational Risk',
    description: 'Assess strategic importance and reputational considerations',
    sectionIds: ['section5'],
  },
  {
    id: 'section_f',
    title: 'F. Data Sensitivity & Cybersecurity',
    description: 'Evaluate data access and cybersecurity risk',
    sectionIds: ['section6'],
  },
  {
    id: 'section_g',
    title: 'G. Concentration Risk',
    description: 'Assess concentration and availability risks',
    sectionIds: ['section7'],
  },
  {
    id: 'section_h',
    title: 'H. Access Level & Subcontractors',
    description: 'Evaluate system access and fourth-party risk',
    sectionIds: ['section8', 'section9'],
  },
  {
    id: 'section_i',
    title: 'I. Legal, Regulatory & Other Risks',
    description: 'Assess regulatory compliance and other risk factors',
    sectionIds: ['section10', 'section11', 'section12', 'section13'],
  },
];

const SENSITIVE_DATA_OPTIONS: { value: SensitiveDataType; label: string }[] = [
  { value: 'pii', label: 'Personal Identifiable Information (PII)' },
  { value: 'financial', label: 'Financial Data' },
  { value: 'health', label: 'Health Information' },
  { value: 'credentials', label: 'Credentials / Access Keys' },
  { value: 'proprietary', label: 'Proprietary / Trade Secrets' },
  { value: 'regulatory', label: 'Regulatory Data' },
];

const COUNTRIES = [
  'Canada',
  'United States',
  'United Kingdom',
  'India',
  'Philippines',
  'Ireland',
  'Germany',
  'France',
  'Australia',
  'Singapore',
  'Other',
];

interface ValidationError {
  field: string;
  message: string;
  step: number;
}

interface ExtendedFormData extends OnboardingRequestFormData {
  assessment_answers: Record<string, unknown>;
}

export default function OnboardingRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrganization, canCreateRequests } = useOrganization();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionErrors, setSubmissionErrors] = useState<ValidationError[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [autoCriticalRules, setAutoCriticalRules] = useState<AutoCriticalRule[]>([]);
  const [acknowledgeAttestation, setAcknowledgeAttestation] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [existingStatus, setExistingStatus] = useState<OnboardingStatus | null>(null);

  const [formData, setFormData] = useState<ExtendedFormData>({
    vendor_legal_name: '',
    vendor_trading_name: '',
    vendor_description: '',
    vendor_website: '',
    vendor_country: 'Canada',
    vendor_province_state: '',
    vendor_city: '',
    vendor_number_of_employees: undefined,
    vendor_years_in_operation: undefined,
    vendor_primary_contact_name: '',
    vendor_primary_contact_email: '',
    vendor_primary_contact_phone: '',
    service_category: '' as never,
    service_description: '',
    provider_type: '' as never,
    requesting_business_unit: '',
    business_justification: '',
    strategic_rationale: '',
    alternatives_considered: '',
    estimated_contract_value_cad: undefined,
    contract_duration: undefined,
    payment_terms: '',
    budget_approved: false,
    budget_approval_reference: '',
    is_critical_service: false,
    supports_essential_operations: false,
    failure_impact_description: '',
    handles_sensitive_data: false,
    sensitive_data_types: [],
    data_location: '',
    has_system_access: false,
    system_access_description: '',
    is_outsourcing: false,
    outsourcing_type: '',
    uses_subcontractors: false,
    known_subcontractors: '',
    offshore_components: false,
    offshore_locations: [],
    assessment_answers: {},
  });

  const isEditMode = !!id;
  const cloneFrom = searchParams.get('clone_from');
  const useTemplate = searchParams.get('use_template') === 'true';

  useEffect(() => {
    if (id) {
      loadExistingRequest();
    } else if (cloneFrom && !initialDataLoaded) {
      loadClonedRequest(cloneFrom);
    } else if (useTemplate && !initialDataLoaded && !id && !cloneFrom) {
      setShowTemplateSelector(true);
      setInitialDataLoaded(true);
    }
  }, [id, cloneFrom, useTemplate, initialDataLoaded]);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadAutoCriticalRules();
    }
  }, [currentOrganization?.id]);

  async function loadAutoCriticalRules() {
    try {
      const { data, error } = await supabase
        .from('auto_critical_rules')
        .select('*')
        .eq('organization_id', currentOrganization?.id)
        .eq('is_active', true)
        .order('priority');

      if (error) throw error;
      setAutoCriticalRules(data || []);
    } catch (error) {
      logger.error('Error loading auto-critical rules:', error);
    }
  }

  async function loadExistingRequest() {
    try {
      const { data, error } = await supabase
        .from('onboarding_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setExistingStatus(data.status as OnboardingStatus);

        const assessmentAnswers = loadAssessmentAnswersFromRow(data as Record<string, unknown>);

        setFormData({
          vendor_legal_name: data.vendor_legal_name || '',
          vendor_trading_name: data.vendor_trading_name || '',
          vendor_description: data.vendor_description || '',
          vendor_website: data.vendor_website || '',
          vendor_country: data.vendor_country || 'Canada',
          vendor_province_state: data.vendor_province_state || '',
          vendor_city: data.vendor_city || '',
          vendor_number_of_employees: data.vendor_number_of_employees,
          vendor_years_in_operation: data.vendor_years_in_operation,
          vendor_primary_contact_name: data.vendor_primary_contact_name || '',
          vendor_primary_contact_email: data.vendor_primary_contact_email || '',
          vendor_primary_contact_phone: data.vendor_primary_contact_phone || '',
          service_category: data.service_category,
          service_description: data.service_description || '',
          provider_type: data.provider_type,
          requesting_business_unit: data.requesting_business_unit || '',
          business_justification: data.business_justification || '',
          strategic_rationale: data.strategic_rationale || '',
          alternatives_considered: data.alternatives_considered || '',
          estimated_contract_value_cad: data.estimated_contract_value_cad,
          contract_duration: data.contract_duration,
          payment_terms: data.payment_terms || '',
          budget_approved: data.budget_approved || false,
          budget_approval_reference: data.budget_approval_reference || '',
          is_critical_service: data.is_critical_service || false,
          supports_essential_operations: data.supports_essential_operations || false,
          failure_impact_description: data.failure_impact_description || '',
          handles_sensitive_data: data.handles_sensitive_data || false,
          sensitive_data_types: data.sensitive_data_types || [],
          data_location: data.data_location || '',
          has_system_access: data.has_system_access || false,
          system_access_description: data.system_access_description || '',
          is_outsourcing: data.is_outsourcing || false,
          outsourcing_type: data.outsourcing_type || '',
          uses_subcontractors: data.uses_subcontractors || false,
          known_subcontractors: data.known_subcontractors || '',
          offshore_components: data.offshore_components || false,
          offshore_locations: data.offshore_locations || [],
          assessment_answers: assessmentAnswers,
        });
      }
    } catch (error) {
      logger.error('Error loading request:', error);
      toast.error('Failed to load request');
    }
  }

  async function loadClonedRequest(requestId: string) {
    try {
      const { data, error } = await supabase
        .from('onboarding_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) throw error;

      if (data) {
        const assessmentAnswers = loadAssessmentAnswersFromRow(data as Record<string, unknown>);

        setFormData({
          vendor_legal_name: (data.vendor_legal_name || '') + ' (Copy)',
          vendor_trading_name: data.vendor_trading_name || '',
          vendor_description: data.vendor_description || '',
          vendor_website: data.vendor_website || '',
          vendor_country: data.vendor_country || 'Canada',
          vendor_province_state: data.vendor_province_state || '',
          vendor_city: data.vendor_city || '',
          vendor_number_of_employees: data.vendor_number_of_employees,
          vendor_years_in_operation: data.vendor_years_in_operation,
          vendor_primary_contact_name: data.vendor_primary_contact_name || '',
          vendor_primary_contact_email: data.vendor_primary_contact_email || '',
          vendor_primary_contact_phone: data.vendor_primary_contact_phone || '',
          service_category: data.service_category,
          service_description: data.service_description || '',
          provider_type: data.provider_type,
          requesting_business_unit: data.requesting_business_unit || '',
          business_justification: data.business_justification || '',
          strategic_rationale: data.strategic_rationale || '',
          alternatives_considered: data.alternatives_considered || '',
          estimated_contract_value_cad: data.estimated_contract_value_cad,
          contract_duration: data.contract_duration,
          payment_terms: data.payment_terms || '',
          budget_approved: data.budget_approved || false,
          budget_approval_reference: data.budget_approval_reference || '',
          is_critical_service: data.is_critical_service || false,
          supports_essential_operations: data.supports_essential_operations || false,
          failure_impact_description: data.failure_impact_description || '',
          handles_sensitive_data: data.handles_sensitive_data || false,
          sensitive_data_types: data.sensitive_data_types || [],
          data_location: data.data_location || '',
          has_system_access: data.has_system_access || false,
          system_access_description: data.system_access_description || '',
          is_outsourcing: data.is_outsourcing || false,
          outsourcing_type: data.outsourcing_type || '',
          uses_subcontractors: data.uses_subcontractors || false,
          known_subcontractors: data.known_subcontractors || '',
          offshore_components: data.offshore_components || false,
          offshore_locations: data.offshore_locations || [],
          assessment_answers: assessmentAnswers,
        });

        setInitialDataLoaded(true);
        toast.success('Request cloned successfully');
      }
    } catch (error) {
      logger.error('Error cloning request:', error);
      toast.error('Failed to clone request');
    }
  }

  const vendorArchetype = useMemo(() => {
    if (formData.service_category && formData.provider_type) {
      return determineVendorArchetype(formData.service_category, formData.provider_type);
    }
    return 'general';
  }, [formData.service_category, formData.provider_type]);

  const contextFlags = useMemo(
    () => ({
      hasDataAccess:
        formData.handles_sensitive_data || formData.assessment_answers.q30_has_system_access === true,
      usesSubcontractors:
        formData.uses_subcontractors ||
        formData.assessment_answers.q38_uses_subcontractors === true,
      hasFormalContract: formData.assessment_answers.q50_has_formal_contract === true,
      isCritical:
        formData.is_critical_service ||
        formData.supports_essential_operations ||
        formData.assessment_answers.q15_supports_essential_operations ===
          'yes_disruption_stops_operations' ||
        formData.assessment_answers.q15_supports_essential_operations === 'yes_critical',
    }),
    [formData]
  );

  const filteredSections = useMemo((): AssessmentSection[] => {
    return assessmentSections
      .map((section) => ({
        ...section,
        questions: section.questions.filter((question) => {
          if (question.conditional) {
            const dependValue = formData.assessment_answers[question.conditional.dependsOn];
            if (dependValue !== question.conditional.showWhen) {
              return false;
            }
          }
          return isQuestionRelevantForProfile(
            question.profileConfig,
            vendorArchetype,
            formData.service_category,
            formData.provider_type,
            contextFlags
          );
        }),
      }))
      .filter((section) => section.questions.length > 0 && section.id !== 'section14');
  }, [vendorArchetype, formData.service_category, formData.provider_type, contextFlags, formData.assessment_answers]);

  const riskCalculation = useMemo((): TierCalculationResult | null => {
    const answeredCount = Object.keys(formData.assessment_answers).filter(
      (k) => formData.assessment_answers[k] !== undefined && formData.assessment_answers[k] !== ''
    ).length;

    if (answeredCount < 5) return null;

    const vendorData = {
      service_category: formData.service_category,
      provider_type: formData.provider_type,
      contract_value_cad: formData.estimated_contract_value_cad,
      handles_sensitive_data: formData.handles_sensitive_data,
    };

    const result = calculateRiskScores(
      formData.assessment_answers,
      0,
      vendorData,
      vendorArchetype,
      undefined,
      undefined,
      autoCriticalRules
    );

    return {
      tier: result.calculated_tier,
      is_auto_critical: result.is_auto_critical,
      impact_score: result.impact_score,
      likelihood_score: result.likelihood_score,
      risk_rating: result.risk_rating,
      criticality_score: result.criticality_score,
      vendor_archetype: result.vendor_archetype,
      exit_strategy_score: result.exit_strategy_score,
      bcp_score: result.bcp_score,
      incident_response_score: result.incident_response_score,
      audit_rights_score: result.audit_rights_score,
      financial_viability_score: result.financial_viability_score,
      insurance_score: result.insurance_score,
    };
  }, [formData.assessment_answers, formData, vendorArchetype, autoCriticalRules]);

  const assessmentStats = useMemo(() => {
    let totalQuestions = 0;
    let answeredQuestions = 0;

    filteredSections.forEach((section) => {
      section.questions.forEach((q) => {
        totalQuestions++;
        const answer = formData.assessment_answers[q.id];
        if (
          answer !== undefined &&
          answer !== '' &&
          !(Array.isArray(answer) && answer.length === 0)
        ) {
          answeredQuestions++;
        }
      });
    });

    return { total: totalQuestions, answered: answeredQuestions };
  }, [filteredSections, formData.assessment_answers]);

  function validateStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.vendor_legal_name.trim()) {
        newErrors.vendor_legal_name = 'Legal name is required';
      }
      if (!formData.vendor_country) {
        newErrors.vendor_country = 'Country is required';
      }
    }

    if (step === 1) {
      if (!formData.service_category) {
        newErrors.service_category = 'Service category is required';
      }
      if (!formData.service_description?.trim()) {
        newErrors.service_description = 'Service description is required';
      }
      if (!formData.provider_type) {
        newErrors.provider_type = 'Provider type is required';
      }
      if (!formData.requesting_business_unit) {
        newErrors.requesting_business_unit = 'Business unit is required';
      }
      if (!formData.business_justification?.trim()) {
        newErrors.business_justification = 'Business justification is required';
      }
      if (!formData.estimated_contract_value_cad && formData.estimated_contract_value_cad !== 0) {
        newErrors.estimated_contract_value_cad = 'Estimated contract value is required';
      }
    }

    if (step === 2) {
      const minimumQuestions = Math.min(10, assessmentStats.total);
      if (assessmentStats.answered < minimumQuestions) {
        newErrors.assessment = `Please answer at least ${minimumQuestions} assessment questions`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateForSubmission(): ValidationError[] {
    const validationErrors: ValidationError[] = [];

    if (!formData.vendor_legal_name.trim()) {
      validationErrors.push({
        field: 'vendor_legal_name',
        message: 'Vendor legal name is required',
        step: 0,
      });
    }

    if (!formData.service_description?.trim()) {
      validationErrors.push({
        field: 'service_description',
        message: 'Service description is required',
        step: 1,
      });
    }

    if (!formData.service_category) {
      validationErrors.push({
        field: 'service_category',
        message: 'Service category is required',
        step: 1,
      });
    }

    if (!formData.requesting_business_unit) {
      validationErrors.push({
        field: 'requesting_business_unit',
        message: 'Requesting business unit is required',
        step: 1,
      });
    }

    if (formData.estimated_contract_value_cad === undefined) {
      validationErrors.push({
        field: 'estimated_contract_value_cad',
        message: 'Estimated contract value is required',
        step: 1,
      });
    }

    const minimumQuestions = Math.min(10, assessmentStats.total);
    if (assessmentStats.answered < minimumQuestions) {
      validationErrors.push({
        field: 'assessment',
        message: `At least ${minimumQuestions} assessment questions must be answered`,
        step: 2,
      });
    }

    if (!acknowledgeAttestation) {
      validationErrors.push({
        field: 'attestation',
        message: 'You must acknowledge the attestation before submitting',
        step: 4,
      });
    }

    return validationErrors;
  }

  function handleChange(field: keyof ExtendedFormData, value: unknown) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
    if (submissionErrors.some((e) => e.field === field)) {
      setSubmissionErrors((prev) => prev.filter((e) => e.field !== field));
    }
  }

  function handleAssessmentChange(questionId: string, value: unknown) {
    setFormData((prev) => ({
      ...prev,
      assessment_answers: {
        ...prev.assessment_answers,
        [questionId]: value,
      },
    }));

    if (questionId === 'q30_has_system_access' && value === true) {
      handleChange('has_system_access', true);
    }
    if (questionId === 'q38_uses_subcontractors' && value === true) {
      handleChange('uses_subcontractors', true);
    }
    if (
      questionId === 'q15_supports_essential_operations' &&
      (value === 'yes_disruption_stops_operations' || value === 'yes_critical')
    ) {
      handleChange('supports_essential_operations', true);
    }
  }

  function handleNext() {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleSaveDraft() {
    if (!currentOrganization || !user) return;

    setSaving(true);
    try {
      const oldColumnValues = buildOldColumnPayload(formData.assessment_answers);
      const payload: Record<string, unknown> = {
        ...formData,
        ...formData.assessment_answers,
        ...oldColumnValues,
        organization_id: currentOrganization.id,
        status: 'draft',
        is_draft: true,
        requested_by: user.id,
        assessment_source: 'onboarding',
      };
      delete payload.assessment_answers;

      if (isEditMode) {
        const { error } = await supabase.from('onboarding_requests').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('onboarding_requests').insert(payload);
        if (error) throw error;
      }

      toast.success('Draft saved successfully - you can resume this request later');
      navigate('/onboarding');
    } catch (error) {
      logger.error('Error saving draft:', error);
      const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
      toast.error(message ? `Failed to save draft: ${message}` : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmitClick() {
    if (!currentOrganization || !user) {
      toast.error('Unable to submit. Please ensure you are logged in and have selected an organization.');
      return;
    }

    const validationErrors = validateForSubmission();
    setSubmissionErrors(validationErrors);

    if (validationErrors.length > 0) {
      toast.error(
        `Please fix ${validationErrors.length} validation error${validationErrors.length > 1 ? 's' : ''} before submitting`
      );
      return;
    }

    setShowConfirmModal(true);
  }

  async function handleConfirmSubmit() {
    if (!currentOrganization || !user) {
      setShowConfirmModal(false);
      toast.error('Unable to submit. Please ensure you are logged in and have selected an organization.');
      return;
    }

    setSubmitting(true);

    try {
      const oldColumnValues = buildOldColumnPayload(formData.assessment_answers);
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        ...formData,
        ...formData.assessment_answers,
        ...oldColumnValues,
        organization_id: currentOrganization.id,
        status: 'submitted',
        is_draft: false,
        submitted_at: now,
        requested_by: user.id,
        assessment_source: 'onboarding',
        preliminary_risk_tier: riskCalculation?.tier,
        preliminary_risk_score: riskCalculation?.risk_rating,
        requires_2nd_line_review:
          riskCalculation?.tier === 'tier_5_critical' ||
          riskCalculation?.tier === 'tier_4_high' ||
          riskCalculation?.is_auto_critical,
        calculated_impact_score: riskCalculation?.impact_score,
        calculated_likelihood_score: riskCalculation?.likelihood_score,
        calculated_risk_rating: riskCalculation?.risk_rating,
        calculated_tier: riskCalculation?.tier,
        is_auto_critical: riskCalculation?.is_auto_critical || false,
        auto_critical_rule_name: riskCalculation?.auto_critical_rule_name || null,
        auto_critical_rule_id: riskCalculation?.auto_critical_rule_id || null,
        assessment_completed: true,
        assessment_completed_at: now,
        assessment_completed_by: user.id,
      };
      delete payload.assessment_answers;

      let requestId = id;

      if (!isEditMode) {
        const { data, error } = await supabase
          .from('onboarding_requests')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        requestId = data.id;
      } else {
        const { error } = await supabase.from('onboarding_requests').update(payload).eq('id', id);
        if (error) throw error;
      }

      const isResubmission = existingStatus === '1b_returned' || existingStatus === '2nd_returned';

      const reviewUpdate: Record<string, unknown> = {
        status: '1b_review',
        current_defense_line: '1b',
      };

      if (isResubmission) {
        reviewUpdate.reviewed_by_1b = null;
        reviewUpdate.reviewed_at_1b = null;
        reviewUpdate.review_decision_1b = null;
        reviewUpdate.review_notes_1b = null;
        reviewUpdate.completeness_confirmed = false;
        reviewUpdate.business_need_validated = false;
        reviewUpdate.initial_risk_acknowledged = false;
        reviewUpdate.assigned_1b_reviewer = null;
        reviewUpdate.assigned_1b_at = null;
        reviewUpdate.original_1a_assessment_answers = null;
        reviewUpdate.assessment_modified_by_1b = false;
        reviewUpdate.assessment_modified_by_1b_user = null;
        reviewUpdate.assessment_modified_at_1b = null;
        reviewUpdate.assessment_1b_change_summary = null;

        if (existingStatus === '2nd_returned') {
          reviewUpdate.reviewed_by_2nd = null;
          reviewUpdate.reviewed_at_2nd = null;
          reviewUpdate.review_decision_2nd = null;
          reviewUpdate.review_notes_2nd = null;
          reviewUpdate.risk_assessment_2nd = null;
          reviewUpdate.risk_appetite_alignment = null;
          reviewUpdate.assigned_2nd_reviewer = null;
          reviewUpdate.assigned_2nd_at = null;
          reviewUpdate.assessment_validated = false;
          reviewUpdate.assessment_validated_by = null;
          reviewUpdate.assessment_validated_at = null;
          reviewUpdate.validated_tier = null;
          reviewUpdate.tier_adjustment_reason = null;
        }
      }

      const assignedReviewer = await findLeastLoadedReviewer(
        currentOrganization.id,
        '1b',
        formData.requesting_business_unit
      );
      if (assignedReviewer) {
        reviewUpdate.assigned_1b_reviewer = assignedReviewer;
        reviewUpdate.assigned_1b_at = new Date().toISOString();
      }

      const { error: reviewStatusError } = await supabase
        .from('onboarding_requests')
        .update(reviewUpdate)
        .eq('id', requestId);

      if (reviewStatusError) throw reviewStatusError;

      const auditAction = isResubmission
        ? 'onboarding_request_resubmitted'
        : 'onboarding_request_submitted';

      try {
        await supabase.from('onboarding_audit_log').insert({
          organization_id: currentOrganization.id,
          request_id: requestId,
          action_type: auditAction,
          action_description: isResubmission
            ? `Request resubmitted after ${existingStatus === '2nd_returned' ? '2nd Line' : '1B'} return`
            : 'Request submitted for 1B review',
          previous_status: isResubmission ? existingStatus : 'submitted',
          new_status: '1b_review',
          performed_by: user.id,
          performed_by_defense_line: '1a',
          new_values: {
            vendor_legal_name: formData.vendor_legal_name,
            service_category: formData.service_category,
            preliminary_risk_tier: riskCalculation?.tier,
          },
        });
      } catch (auditError) {
        logger.warn('Audit log creation failed:', auditError);
      }

      setSubmitting(false);
      setShowConfirmModal(false);
      toast.success(isResubmission ? 'Request resubmitted for review' : 'Request submitted for review');
      navigate('/onboarding');
    } catch (error) {
      logger.error('Error submitting request:', error);
      const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
      toast.error(message ? `Failed to submit request: ${message}` : 'Failed to submit request. Please try again.');
      setSubmitting(false);
    }
  }

  function goToErrorStep(step: number) {
    setCurrentStep(step);
  }

  function getSectionStats(sectionIds: string[]) {
    let total = 0;
    let answered = 0;

    sectionIds.forEach((sectionId) => {
      const section = filteredSections.find((s) => s.id === sectionId);
      if (section) {
        section.questions.forEach((q) => {
          total++;
          const answer = formData.assessment_answers[q.id];
          if (
            answer !== undefined &&
            answer !== '' &&
            !(Array.isArray(answer) && answer.length === 0)
          ) {
            answered++;
          }
        });
      }
    });

    return { total, answered, isComplete: total > 0 && answered === total };
  }

  if (!canCreateRequests) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600 mb-4">
          You don&apos;t have permission to create onboarding requests.
        </p>
        <button
          onClick={() => navigate('/onboarding')}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => navigate('/onboarding')}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Onboarding Dashboard
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditMode
                ? existingStatus === '1b_returned' || existingStatus === '2nd_returned'
                  ? 'Edit & Resubmit Onboarding Request'
                  : 'Edit Onboarding Request'
                : 'New Third-Party Onboarding Request'}
            </h1>
            <p className="text-slate-600">
              {existingStatus === '1b_returned' || existingStatus === '2nd_returned'
                ? 'Address the reviewer feedback below, then resubmit for review.'
                : 'Complete the risk assessment wizard to request onboarding of a new third-party vendor.'}
            </p>
          </div>
          {!isEditMode && currentStep === 0 && (
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Use Template
            </button>
          )}
        </div>
      </div>

      {showTemplateSelector && currentOrganization?.id && (
        <TemplateSelector
          organizationId={currentOrganization.id}
          onTemplateApplied={(draftId) => {
            setShowTemplateSelector(false);
            navigate(`/onboarding/edit/${draftId}`);
          }}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}

      {submissionErrors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                Please fix the following errors before submitting:
              </h3>
              <ul className="space-y-1">
                {submissionErrors.map((error, index) => (
                  <li
                    key={index}
                    className="text-sm text-red-700 flex items-center justify-between"
                  >
                    <span>{error.message}</span>
                    <button
                      onClick={() => goToErrorStep(error.step)}
                      className="text-xs text-red-600 hover:text-red-800 underline ml-2"
                    >
                      Go to {STEPS[error.step].title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const hasError = submissionErrors.some((e) => e.step === index);
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (index < currentStep || validateStep(currentStep)) {
                      setCurrentStep(index);
                    }
                  }}
                  className={`flex items-center ${
                    isActive
                      ? 'text-slate-900'
                      : isCompleted
                        ? hasError
                          ? 'text-red-600'
                          : 'text-green-600'
                        : hasError
                          ? 'text-red-400'
                          : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : isCompleted
                          ? hasError
                            ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-600'
                          : hasError
                            ? 'bg-red-100 text-red-400'
                            : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted && !hasError ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : hasError ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="ml-2 text-sm font-medium hidden md:block">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 md:w-16 h-1 mx-2 rounded ${
                      index < currentStep ? 'bg-green-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            {currentStep === 0 && (
              <VendorInformationStep
                formData={formData}
                errors={errors}
                submissionErrors={submissionErrors}
                onChange={handleChange}
              />
            )}

            {currentStep === 1 && (
              <ServiceContextStep
                formData={formData}
                errors={errors}
                submissionErrors={submissionErrors}
                onChange={handleChange}
              />
            )}

            {currentStep === 2 && (
              <AssessmentStep
                formData={formData}
                filteredSections={filteredSections}
                vendorArchetype={vendorArchetype}
                onAnswerChange={handleAssessmentChange}
                errors={errors}
                getSectionStats={getSectionStats}
              />
            )}

            {currentStep === 3 && (
              <CalculationStep
                riskCalculation={riskCalculation}
                assessmentStats={assessmentStats}
              />
            )}

            {currentStep === 4 && (
              <ReviewStep
                formData={formData}
                riskCalculation={riskCalculation}
                acknowledgeAttestation={acknowledgeAttestation}
                onAttestationChange={setAcknowledgeAttestation}
                submissionErrors={submissionErrors}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>

              {currentStep < STEPS.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  onClick={handleSubmitClick}
                  disabled={submitting}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <RiskScorePanel
              result={riskCalculation}
              questionsAnswered={assessmentStats.answered}
              totalQuestions={assessmentStats.total}
            />
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <ConfirmSubmitModal
          formData={formData}
          riskCalculation={riskCalculation}
          submitting={submitting}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmSubmit}
        />
      )}
    </div>
  );
}

interface VendorInformationStepProps {
  formData: ExtendedFormData;
  errors: Record<string, string>;
  submissionErrors: ValidationError[];
  onChange: (field: keyof ExtendedFormData, value: unknown) => void;
}

function VendorInformationStep({
  formData,
  errors,
  submissionErrors,
  onChange,
}: VendorInformationStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Vendor Information</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Legal Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.vendor_legal_name}
            onChange={(e) => onChange('vendor_legal_name', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.vendor_legal_name ||
              submissionErrors.some((e) => e.field === 'vendor_legal_name')
                ? 'border-red-500'
                : 'border-slate-300'
            }`}
            placeholder="Enter vendor's legal name"
          />
          {errors.vendor_legal_name && (
            <p className="text-red-500 text-sm mt-1">{errors.vendor_legal_name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Trading Name (DBA)</label>
          <input
            type="text"
            value={formData.vendor_trading_name}
            onChange={(e) => onChange('vendor_trading_name', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="If different from legal name"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={formData.vendor_description}
            onChange={(e) => onChange('vendor_description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="Brief description of the vendor and their business"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Country <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.vendor_country}
            onChange={(e) => onChange('vendor_country', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.vendor_country ? 'border-red-500' : 'border-slate-300'
            }`}
          >
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Province/State</label>
          <input
            type="text"
            value={formData.vendor_province_state}
            onChange={(e) => onChange('vendor_province_state', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
          <input
            type="text"
            value={formData.vendor_city}
            onChange={(e) => onChange('vendor_city', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
          <input
            type="url"
            value={formData.vendor_website}
            onChange={(e) => onChange('vendor_website', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="https://"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Number of Employees</label>
          <input
            type="number"
            value={formData.vendor_number_of_employees || ''}
            onChange={(e) =>
              onChange(
                'vendor_number_of_employees',
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Years in Operation</label>
          <input
            type="number"
            value={formData.vendor_years_in_operation || ''}
            onChange={(e) =>
              onChange(
                'vendor_years_in_operation',
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
      </div>

      <h3 className="text-md font-semibold text-slate-900 mt-6 mb-4">Primary Contact</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            type="text"
            value={formData.vendor_primary_contact_name}
            onChange={(e) => onChange('vendor_primary_contact_name', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={formData.vendor_primary_contact_email}
            onChange={(e) => onChange('vendor_primary_contact_email', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            type="tel"
            value={formData.vendor_primary_contact_phone}
            onChange={(e) => onChange('vendor_primary_contact_phone', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
      </div>
    </div>
  );
}

interface ServiceContextStepProps {
  formData: ExtendedFormData;
  errors: Record<string, string>;
  submissionErrors: ValidationError[];
  onChange: (field: keyof ExtendedFormData, value: unknown) => void;
}

function ServiceContextStep({
  formData,
  errors,
  submissionErrors,
  onChange,
}: ServiceContextStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Service & Business Context</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Service Category <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.service_category}
            onChange={(e) => onChange('service_category', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.service_category ||
              submissionErrors.some((e) => e.field === 'service_category')
                ? 'border-red-500'
                : 'border-slate-300'
            }`}
          >
            <option value="">Select category...</option>
            {SERVICE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.service_category && (
            <p className="text-red-500 text-sm mt-1">{errors.service_category}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Provider Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.provider_type}
            onChange={(e) => onChange('provider_type', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.provider_type ? 'border-red-500' : 'border-slate-300'
            }`}
          >
            <option value="">Select type...</option>
            {PROVIDER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.provider_type && (
            <p className="text-red-500 text-sm mt-1">{errors.provider_type}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Requesting Business Unit <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.requesting_business_unit}
            onChange={(e) => onChange('requesting_business_unit', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.requesting_business_unit ||
              submissionErrors.some((e) => e.field === 'requesting_business_unit')
                ? 'border-red-500'
                : 'border-slate-300'
            }`}
          >
            <option value="">Select business unit...</option>
            {BUSINESS_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
          {errors.requesting_business_unit && (
            <p className="text-red-500 text-sm mt-1">{errors.requesting_business_unit}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Estimated Contract Value (CAD) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.estimated_contract_value_cad ?? ''}
            onChange={(e) =>
              onChange(
                'estimated_contract_value_cad',
                e.target.value ? parseFloat(e.target.value) : undefined
              )
            }
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.estimated_contract_value_cad ||
              submissionErrors.some((e) => e.field === 'estimated_contract_value_cad')
                ? 'border-red-500'
                : 'border-slate-300'
            }`}
            placeholder="Total contract value"
          />
          {errors.estimated_contract_value_cad && (
            <p className="text-red-500 text-sm mt-1">{errors.estimated_contract_value_cad}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contract Duration</label>
          <select
            value={formData.contract_duration || ''}
            onChange={(e) => onChange('contract_duration', e.target.value || undefined)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="">Select duration...</option>
            {CONTRACT_DURATIONS.map((dur) => (
              <option key={dur.value} value={dur.value}>
                {dur.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
          <input
            type="text"
            value={formData.payment_terms}
            onChange={(e) => onChange('payment_terms', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="e.g., Net 30, Monthly"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Service Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.service_description}
            onChange={(e) => onChange('service_description', e.target.value)}
            rows={3}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.service_description || submissionErrors.some((e) => e.field === 'service_description')
                ? 'border-red-500'
                : 'border-slate-300'
            }`}
            placeholder="Describe the services to be provided"
          />
          {errors.service_description && (
            <p className="text-red-500 text-sm mt-1">{errors.service_description}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Business Justification <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.business_justification}
            onChange={(e) => onChange('business_justification', e.target.value)}
            rows={3}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 ${
              errors.business_justification ? 'border-red-500' : 'border-slate-300'
            }`}
            placeholder="Why is this vendor needed? What business problem does it solve?"
          />
          {errors.business_justification && (
            <p className="text-red-500 text-sm mt-1">{errors.business_justification}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Alternatives Considered
          </label>
          <textarea
            value={formData.alternatives_considered}
            onChange={(e) => onChange('alternatives_considered', e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="What alternatives were evaluated?"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Initial Risk Indicators</h3>
        <p className="text-sm text-slate-600 mb-4">
          These preliminary indicators help scope the risk assessment in the next step.
        </p>

        <div className="space-y-3">
          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={formData.is_critical_service}
              onChange={(e) => onChange('is_critical_service', e.target.checked)}
              className="w-4 h-4 mt-1 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Critical Service</span>
              <p className="text-xs text-slate-500">
                Services where disruption would significantly impact operations or customers
              </p>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={formData.handles_sensitive_data}
              onChange={(e) => onChange('handles_sensitive_data', e.target.checked)}
              className="w-4 h-4 mt-1 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Handles Sensitive Data</span>
              <p className="text-xs text-slate-500">
                Will have access to, process, or store sensitive data
              </p>
            </div>
          </label>

          {formData.handles_sensitive_data && (
            <div className="ml-7 mt-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Types of Sensitive Data
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SENSITIVE_DATA_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.sensitive_data_types?.includes(opt.value) || false}
                      onChange={(e) => {
                        const current = formData.sensitive_data_types || [];
                        if (e.target.checked) {
                          onChange('sensitive_data_types', [...current, opt.value]);
                        } else {
                          onChange(
                            'sensitive_data_types',
                            current.filter((v) => v !== opt.value)
                          );
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={formData.has_system_access}
              onChange={(e) => onChange('has_system_access', e.target.checked)}
              className="w-4 h-4 mt-1 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Requires System Access</span>
              <p className="text-xs text-slate-500">
                Will need access to internal systems or networks
              </p>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={formData.is_outsourcing}
              onChange={(e) => onChange('is_outsourcing', e.target.checked)}
              className="w-4 h-4 mt-1 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Outsourcing Arrangement</span>
              <p className="text-xs text-slate-500">
                This is an outsourcing of a business activity, function, or service
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

interface AssessmentStepProps {
  formData: ExtendedFormData;
  filteredSections: AssessmentSection[];
  vendorArchetype: string;
  onAnswerChange: (questionId: string, value: unknown) => void;
  errors: Record<string, string>;
  getSectionStats: (sectionIds: string[]) => { total: number; answered: number; isComplete: boolean };
}

function AssessmentStep({
  formData,
  filteredSections,
  vendorArchetype,
  onAnswerChange,
  errors,
  getSectionStats,
}: AssessmentStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Inherent Risk Assessment</h2>
          <p className="text-sm text-slate-600 mt-1">
            OSFI B-10 pre-contract risk assessment for{' '}
            <span className="font-medium">{vendorArchetype.replace(/_/g, ' ')}</span> vendors
          </p>
        </div>
      </div>

      {errors.assessment && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-800">{errors.assessment}</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Assessment Guidance</p>
            <p className="text-sm text-blue-700 mt-1">
              Answer the questions in each section to build a comprehensive risk profile. Questions
              are filtered based on the service category and provider type selected. The risk
              calculation panel on the right updates in real-time as you answer questions.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {ASSESSMENT_SECTIONS_CONFIG.map((configSection) => {
          const stats = getSectionStats(configSection.sectionIds);
          if (stats.total === 0) return null;

          const sectionQuestions = configSection.sectionIds.flatMap((sectionId) => {
            const section = filteredSections.find((s) => s.id === sectionId);
            return section?.questions || [];
          });

          return (
            <CollapsibleSection
              key={configSection.id}
              id={configSection.id}
              title={configSection.title}
              description={configSection.description}
              isComplete={stats.isComplete}
              answeredCount={stats.answered}
              totalCount={stats.total}
              defaultOpen={configSection.id === 'section_a'}
            >
              <div className="divide-y divide-slate-100">
                {sectionQuestions.map((question) => (
                  <QuestionRenderer
                    key={question.id}
                    question={question}
                    value={formData.assessment_answers[question.id]}
                    onChange={onAnswerChange}
                  />
                ))}
              </div>
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}

interface CalculationStepProps {
  riskCalculation: TierCalculationResult | null;
  assessmentStats: { total: number; answered: number };
}

function CalculationStep({ riskCalculation, assessmentStats }: CalculationStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Risk Calculation Results</h2>
      <p className="text-sm text-slate-600">
        Review the calculated risk scores based on your assessment responses.
      </p>

      {riskCalculation ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-4">Impact Scores</h3>
              {riskCalculation.score_breakdown && (
                <div className="space-y-3">
                  <ScoreRow label="Criticality" value={riskCalculation.score_breakdown.impact.criticality} />
                  <ScoreRow label="Product/Service" value={riskCalculation.score_breakdown.impact.product} />
                  <ScoreRow label="Dependency" value={riskCalculation.score_breakdown.impact.dependency} />
                  <ScoreRow label="Financial" value={riskCalculation.score_breakdown.impact.financial} />
                  <ScoreRow label="Strategic" value={riskCalculation.score_breakdown.impact.strategic} />
                  <ScoreRow label="Data Sensitivity" value={riskCalculation.score_breakdown.impact.data} />
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-4">Likelihood Scores</h3>
              {riskCalculation.score_breakdown && (
                <div className="space-y-3">
                  <ScoreRow label="Concentration" value={riskCalculation.score_breakdown.likelihood.concentration} />
                  <ScoreRow label="Access Level" value={riskCalculation.score_breakdown.likelihood.access} />
                  <ScoreRow label="Subcontractor" value={riskCalculation.score_breakdown.likelihood.subcontractor} />
                  <ScoreRow label="Legal/Regulatory" value={riskCalculation.score_breakdown.likelihood.legal} />
                  <ScoreRow label="Maturity" value={riskCalculation.score_breakdown.likelihood.maturity} />
                  <ScoreRow label="Other Risks" value={riskCalculation.score_breakdown.likelihood.other_risks} />
                </div>
              )}
            </div>
          </div>

          {(riskCalculation.exit_strategy_score ||
            riskCalculation.bcp_score ||
            riskCalculation.incident_response_score) && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-4">OSFI B-10 Compliance Scores</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {riskCalculation.exit_strategy_score && (
                  <div>
                    <p className="text-xs text-blue-700">Exit Strategy</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {riskCalculation.exit_strategy_score.toFixed(2)}
                    </p>
                  </div>
                )}
                {riskCalculation.bcp_score && (
                  <div>
                    <p className="text-xs text-blue-700">Business Continuity</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {riskCalculation.bcp_score.toFixed(2)}
                    </p>
                  </div>
                )}
                {riskCalculation.incident_response_score && (
                  <div>
                    <p className="text-xs text-blue-700">Incident Response</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {riskCalculation.incident_response_score.toFixed(2)}
                    </p>
                  </div>
                )}
                {riskCalculation.audit_rights_score && (
                  <div>
                    <p className="text-xs text-blue-700">Audit Rights</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {riskCalculation.audit_rights_score.toFixed(2)}
                    </p>
                  </div>
                )}
                {riskCalculation.financial_viability_score && (
                  <div>
                    <p className="text-xs text-blue-700">Financial Viability</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {riskCalculation.financial_viability_score.toFixed(2)}
                    </p>
                  </div>
                )}
                {riskCalculation.insurance_score && (
                  <div>
                    <p className="text-xs text-blue-700">Insurance</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {riskCalculation.insurance_score.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg p-8 text-center">
          <p className="text-slate-500">
            Complete more assessment questions to see risk calculation results.
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {assessmentStats.answered} of {assessmentStats.total} questions answered
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const percentage = (value / 5) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value.toFixed(2)}</span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getScoreColor(value)} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 4) return 'bg-red-500';
  if (score >= 3) return 'bg-orange-500';
  if (score >= 2) return 'bg-amber-500';
  return 'bg-green-500';
}

interface ReviewStepProps {
  formData: ExtendedFormData;
  riskCalculation: TierCalculationResult | null;
  acknowledgeAttestation: boolean;
  onAttestationChange: (value: boolean) => void;
  submissionErrors: ValidationError[];
}

function ReviewStep({
  formData,
  riskCalculation,
  acknowledgeAttestation,
  onAttestationChange,
  submissionErrors,
}: ReviewStepProps) {
  const tierConfig: Record<string, { label: string; color: string }> = {
    tier_5_critical: { label: 'Critical', color: 'bg-red-100 text-red-800' },
    tier_4_high: { label: 'High Risk', color: 'bg-orange-100 text-orange-800' },
    tier_3_moderate: { label: 'Moderate Risk', color: 'bg-amber-100 text-amber-800' },
    tier_2_low: { label: 'Low Risk', color: 'bg-emerald-100 text-emerald-800' },
    tier_1_informational: { label: 'Informational', color: 'bg-slate-100 text-slate-800' },
  };

  const config = riskCalculation ? tierConfig[riskCalculation.tier] : null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Review & Submit</h2>

      {riskCalculation && config && (
        <div className={`p-4 rounded-lg border ${config.color}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Preliminary Risk Tier</p>
              <p className="text-xl font-bold">{config.label}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">Risk Score</p>
              <p className="text-2xl font-bold">{riskCalculation.risk_rating.toFixed(2)}</p>
            </div>
          </div>
          {riskCalculation.is_auto_critical && (
            <div className="mt-3 pt-3 border-t border-current/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Auto-Critical Trigger Active</span>
              </div>
              <p className="text-xs mt-1">{riskCalculation.auto_critical_rule_name}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-medium text-slate-900 mb-3">Vendor Information</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Legal Name</dt>
              <dd className="font-medium text-slate-900">{formData.vendor_legal_name || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Country</dt>
              <dd className="font-medium text-slate-900">{formData.vendor_country}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Service Category</dt>
              <dd className="font-medium text-slate-900">
                {SERVICE_CATEGORIES.find((c) => c.value === formData.service_category)?.label || '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Provider Type</dt>
              <dd className="font-medium text-slate-900">
                {PROVIDER_TYPES.find((t) => t.value === formData.provider_type)?.label || '-'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-medium text-slate-900 mb-3">Financial & Business</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Contract Value</dt>
              <dd className="font-medium text-slate-900">
                {formData.estimated_contract_value_cad != null && !isNaN(formData.estimated_contract_value_cad)
                  ? `$${formData.estimated_contract_value_cad.toLocaleString()}`
                  : 'N/A'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Business Unit</dt>
              <dd className="font-medium text-slate-900">
                {BUSINESS_UNITS.find((u) => u.value === formData.requesting_business_unit)?.label ||
                  '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Contract Duration</dt>
              <dd className="font-medium text-slate-900">
                {CONTRACT_DURATIONS.find((d) => d.value === formData.contract_duration)?.label ||
                  'Not specified'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 mb-3">Risk Indicators</h3>
        <div className="flex flex-wrap gap-2">
          {formData.is_critical_service && (
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
              Critical Service
            </span>
          )}
          {formData.supports_essential_operations && (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
              Essential Operations
            </span>
          )}
          {formData.handles_sensitive_data && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              Sensitive Data
            </span>
          )}
          {formData.has_system_access && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              System Access
            </span>
          )}
          {formData.is_outsourcing && (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
              Outsourcing
            </span>
          )}
          {formData.uses_subcontractors && (
            <span className="px-3 py-1 bg-slate-200 text-slate-800 rounded-full text-sm">
              Subcontractors
            </span>
          )}
        </div>
      </div>

      <div
        className={`bg-slate-50 rounded-lg p-4 border ${submissionErrors.some((e) => e.field === 'attestation') ? 'border-red-300' : 'border-slate-200'}`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledgeAttestation}
            onChange={(e) => onAttestationChange(e.target.checked)}
            className="w-5 h-5 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          />
          <div>
            <p className="font-medium text-slate-900">Requestor Attestation</p>
            <p className="text-sm text-slate-600 mt-1">
              I confirm that the information provided in this onboarding request is accurate and
              complete to the best of my knowledge. I understand that this request will be reviewed
              by the appropriate lines of defense based on the assessed risk level.
            </p>
          </div>
        </label>
        {submissionErrors.some((e) => e.field === 'attestation') && (
          <p className="text-sm text-red-600 mt-2">
            You must acknowledge the attestation before submitting.
          </p>
        )}
      </div>

      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">What happens next?</p>
            <p className="text-sm text-blue-700 mt-1">
              After submission, this request will be reviewed by your Business Unit Risk Coordinator
              (1B Line of Defense).
              {riskCalculation &&
                (riskCalculation.tier === 'tier_5_critical' ||
                  riskCalculation.tier === 'tier_4_high' ||
                  riskCalculation.is_auto_critical) && (
                  <>
                    {' '}
                    Based on the risk level, it will also require approval from the 2nd Line of
                    Defense (Risk Management).
                  </>
                )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConfirmSubmitModalProps {
  formData: ExtendedFormData;
  riskCalculation: TierCalculationResult | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmSubmitModal({
  formData,
  riskCalculation,
  submitting,
  onClose,
  onConfirm,
}: ConfirmSubmitModalProps) {
  const tierLabels: Record<string, string> = {
    tier_5_critical: 'Critical',
    tier_4_high: 'High Risk',
    tier_3_moderate: 'Moderate Risk',
    tier_2_low: 'Low Risk',
    tier_1_informational: 'Informational',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Confirm Submission</h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-600 mb-6">
          Are you sure you want to submit this request for review?{' '}
          <span className="font-medium text-slate-800">
            You will not be able to edit it after submission.
          </span>
        </p>

        <div className="bg-slate-50 rounded-lg p-3 mb-6">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Vendor:</span> {formData.vendor_legal_name}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Value:</span>{' '}
            {formData.estimated_contract_value_cad != null && !isNaN(formData.estimated_contract_value_cad)
              ? `$${formData.estimated_contract_value_cad.toLocaleString()}`
              : 'N/A'}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Risk Tier:</span>{' '}
            {riskCalculation ? tierLabels[riskCalculation.tier] : 'Not calculated'}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Yes, Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

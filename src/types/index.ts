// User roles and permissions
export type UserRole =
  | 'risk_manager'
  | 'vendor_owner'
  | 'compliance_analyst'
  | 'auditor'
  | 'executive'
  | 'business_user';

export type BusinessUnit =
  | 'audit'
  | 'branch_operations'
  | 'business_development_marketing'
  | 'credit_risk_cad'
  | 'financial_controls'
  | 'human_resources'
  | 'legal_compliance'
  | 'retail_banking'
  | 'risk_control'
  | 'risk_control_ops'
  | 'technology';

// Service categories
export type ServiceCategory =
  | 'facilities_real_estate'
  | 'financial_insurance_services'
  | 'it_telecom_services'
  | 'legal_audit_consulting'
  | 'office_support_supplies'
  | 'physical_security'
  | 'cloud_data_services'
  | 'exchange_clearing_services'
  | 'human_resources_services'
  | 'info_cyber_security'
  | 'transport_delivery'
  | 'marketing_services'
  | 'external_portals_platforms'
  | 'data_research_subscription'
  | 'other';

// Provider types
export type ProviderType =
  | 'tpsp_outsourced_group'
  | 'tpsp_outsourced_external'
  | 'tpsp_other_providers'
  | 'tpsp_vendor'
  | 'tpsp_business_partner';

// Tier and risk levels
export type TierLevel =
  | 'tier_5_critical'
  | 'tier_4_high'
  | 'tier_3_moderate'
  | 'tier_2_low'
  | 'tier_1_informational';

export type RiskLevel =
  | 'critical'
  | 'high'
  | 'moderate'
  | 'low'
  | 'informational';

// Status types
export type VendorStatus =
  | 'active'
  | 'under_review'
  | 'pending_assessment'
  | 'onboarding'
  | 'offboarding'
  | 'terminated'
  | 'suspended'
  | 'non_compliant'
  | 'pending_approval';

export type LifecycleStage =
  | 'identification'
  | 'tiering'
  | 'due_diligence'
  | 'contracting'
  | 'onboarding'
  | 'monitoring'
  | 'performance_review'
  | 'offboarding'
  | 'terminated';

export type DataAccessLevel =
  | 'none'
  | 'read_only'
  | 'limited'
  | 'moderate'
  | 'high'
  | 'full_admin';

// Contract types
export type ContractType =
  | 'formal_contract'
  | 'supply_agreement'
  | 'procurement_invoice'
  | 'subscription_license'
  | 'portal_regulatory_access'
  | 'membership_association'
  | 'terms_only';

export type ContractDuration =
  | 'zero_one_year'
  | 'one_three_years'
  | 'three_five_years'
  | 'over_five_years'
  | 'terms_only_no_duration';

// User interface
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  business_unit?: BusinessUnit;
  created_at: string;
  updated_at: string;
}

// Vendor interface
export interface Vendor {
  id: string;
  vendor_id: string;
  legal_name: string;
  trading_name?: string;
  description?: string;
  street_address?: string;
  suite_unit?: string;
  city?: string;
  province_state?: string;
  postal_code?: string;
  country: string;
  website?: string;
  number_of_employees?: number;
  years_in_operation?: number;
  lei?: string;
  ultimate_parent_name?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  responsible_officer?: string;
  business_unit?: BusinessUnit;
  service_category: ServiceCategory;
  service_description?: string;
  provider_type: ProviderType;
  is_critical: boolean;
  tier?: TierLevel;
  impact_score?: number;
  likelihood_score?: number;
  risk_rating?: number;
  inherent_risk_level?: RiskLevel;
  status: VendorStatus;
  lifecycle_stage: LifecycleStage;
  onboarding_date?: string;
  last_review_date?: string;
  next_review_date?: string;
  has_system_access: boolean;
  data_access_level?: DataAccessLevel;
  handles_sensitive_data: boolean;
  data_location?: string;
  uses_subcontractors: boolean;
  subcontractor_oversight_level?: string;
  has_formal_contract: boolean;
  contract_type?: ContractType;
  contract_start_date?: string;
  contract_end_date?: string;
  contract_duration?: ContractDuration;
  contract_value_cad?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Assessment types
export type AssessmentType =
  | 'initial'
  | 'periodic'
  | 'periodic_review'
  | 'renewal'
  | 'triggered'
  | 'reassessment';

export type AssessmentStatus =
  | 'draft'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export type VendorArchetypeType =
  | 'technology_data_processor'
  | 'financial_services'
  | 'professional_services'
  | 'operational_support'
  | 'strategic_partner'
  | 'general';

export interface TieringAssessment {
  id: string;
  assessment_id: string;
  vendor_id: string;
  assessment_date: string;
  assessor_name?: string;
  assessment_type: AssessmentType;
  status: AssessmentStatus;
  vendor_archetype?: VendorArchetypeType;
  assessment_notes?: string;

  q15_supports_essential_operations?: string;
  q16_essential_to_business?: string;
  q17_failure_impact?: string;

  q18_product_service_types?: string[];
  q19_service_description?: string;
  q20_service_recipient?: BusinessUnit;
  q21_provider_type?: ProviderType;

  q22_dependency_level?: string;

  q23_contract_value_cad?: number;
  q24_total_financial_input?: string;
  q25_operational_effort?: string;
  q26_replacement_complexity?: string;
  q27_disruption_downtime?: string;

  q27b_exit_plan_documented?: string;
  q27c_transition_period?: string;
  q27d_data_portability?: string;
  q27e_exit_fees?: string;

  q27f_bcp_documented?: string;
  q27g_bcp_tested?: string;
  q27h_rto_rpo?: string;
  q27i_geographic_redundancy?: string;

  q28_reputational_impact?: string;
  q29_public_association?: string;

  q30_has_system_access?: boolean;
  q31_data_sensitivity?: string;
  q32_cybersecurity_risk?: string;

  q32b_incident_response_plan?: string;
  q32c_notification_period?: string;
  q32d_past_incidents?: string;
  q32e_incident_testing?: string;

  q33_provider_availability?: string;
  q34_services_relied_on?: string;

  q35_data_access_location?: string;
  q36_system_access_level?: string;
  q37_sensitive_data_access?: string;

  q38_uses_subcontractors?: boolean;
  q39_subcontractor_oversight?: string;
  q40_subcontractor_access?: string;

  q41_regulatory_oversight?: string;
  q42_non_compliance_consequences?: string;
  q43_fraud_misconduct_history?: string;

  q43b_audit_rights?: string;
  q43c_osfi_access?: string;
  q43d_certifications?: string[];
  q43e_audit_exercised?: string;

  q44_operational_maturity?: string;
  q45_reliability_track_record?: string;

  q45b_financial_stability?: string;
  q45c_ownership_changes?: string;
  q45d_ownership_type?: string;
  q45e_going_concern?: string;

  q46_geopolitical_risk?: string;
  q47_negative_coverage?: string;
  q48_esg_concerns?: string;
  q49_child_labor_verification?: string;

  q50_has_formal_contract?: boolean;
  q51_contract_type?: ContractType;
  q52_contract_duration?: ContractDuration;
  q53_requires_formal_contract?: boolean;

  q53b_professional_liability?: string;
  q53c_cyber_liability?: string;
  q53d_coverage_adequacy?: string;
  q53e_indemnification?: string;

  criticality_score?: number;
  impact_score?: number;
  likelihood_score?: number;
  risk_rating?: number;
  calculated_tier?: TierLevel;
  is_auto_critical: boolean;

  exit_strategy_score?: number;
  bcp_score?: number;
  incident_response_score?: number;
  audit_rights_score?: number;
  financial_viability_score?: number;
  insurance_score?: number;

  reviewer_name?: string;
  review_date?: string;
  review_comments?: string;
  approved_by?: string;
  approval_date?: string;

  created_at: string;
  updated_at: string;
}

// Category Weights
export interface CategoryWeights {
  id: string;
  category: ServiceCategory;
  category_display_name: string;

  // Impact factor weights
  weight_criticality: number;
  weight_product_type: number;
  weight_dependency: number;
  weight_financial_resilience: number;
  weight_strategic_reputational: number;
  weight_data_sensitivity: number;

  // Likelihood factor weights
  weight_concentration: number;
  weight_access_level: number;
  weight_subcontractor: number;
  weight_legal_regulatory: number;
  weight_operational_maturity: number;
  weight_other_risks: number;

  is_active: boolean;
  updated_at: string;
  updated_by?: string;
}

// KRI Types
export interface KRIThreshold {
  id: string;
  kri_code: string;
  kri_name: string;
  description?: string;
  green_min?: number;
  green_max?: number;
  amber_min?: number;
  amber_max?: number;
  red_min?: number;
  red_max?: number;
  threshold_type: 'percentage' | 'count';
  is_higher_better: boolean;
  is_enabled: boolean;
  notify_on_amber: boolean;
  notify_on_red: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface KRIHistory {
  id: string;
  recorded_date: string;
  kri_code: string;
  calculated_value: number;
  previous_value?: number;
  change_amount?: number;
  change_direction?: 'up' | 'down' | 'unchanged';
  status: 'green' | 'amber' | 'red';
  threshold_breached: boolean;
  details?: Record<string, unknown>;
  created_at: string;
}

// Lifecycle Config
export interface LifecycleConfig {
  id: string;
  stage_code: LifecycleStage;
  stage_name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  required_actions?: string[];
  auto_advance_enabled: boolean;
  auto_advance_trigger?: string;
  notification_on_enter: boolean;
  notification_on_exit: boolean;
  days_until_escalation?: number;
  created_at: string;
  updated_at: string;
}

// Contract Review
export type ContractReviewStatus = 'pending' | 'in_review' | 'approved' | 'approved_with_conditions' | 'rejected';

export interface ContractReview {
  id: string;
  contract_id: string;
  review_type: 'initial' | 'renewal' | 'amendment' | 'periodic';
  status: ContractReviewStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
  assigned_at?: string;
  assigned_by?: string;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  legal_notes?: string;
  conditions?: string;
  recommendations?: string;
  annex2_compliance_score?: number;
  provisions_missing?: string[];
  risk_flags?: string[];
  decision?: string;
  decision_by?: string;
  decision_date?: string;
  decision_notes?: string;
  created_at: string;
  updated_at: string;
}

// Report Template
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  report_type: 'board' | 'inventory' | 'compliance' | 'custom';
  config: Record<string, unknown>;
  include_sections?: string[];
  date_range_type: 'custom' | 'quarterly' | 'annual' | 'ytd';
  default_format: 'pdf' | 'pptx' | 'xlsx';
  is_default: boolean;
  is_shared: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Role Permission
export interface RolePermission {
  id: string;
  role: UserRole;
  permission: string;
  is_granted: boolean;
  created_at: string;
}

// Scheduled Job
export interface ScheduledJob {
  id: string;
  job_name: string;
  job_type: string;
  description?: string;
  schedule_cron?: string;
  is_enabled: boolean;
  last_run_at?: string;
  last_run_status?: 'success' | 'failure' | 'running';
  last_run_duration_ms?: number;
  last_run_result?: Record<string, unknown>;
  last_error?: string;
  next_run_at?: string;
  run_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

// Notification
export interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
  target_user_id?: string;
  target_role?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

// Review Schedule Types
export interface ReviewSchedule {
  id: string;
  vendor_id: string;
  review_type: string;
  frequency_days: number;
  last_review_date?: string;
  next_review_date: string;
  responsible_user_id?: string;
  escalation_user_id?: string;
  is_active: boolean;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewNotification {
  id: string;
  vendor_id: string;
  schedule_id?: string;
  notification_type: string;
  days_before_due?: number;
  sent_at: string;
  recipient_user_id?: string;
  recipient_email?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  created_at: string;
}

export interface ReviewCompletion {
  id: string;
  vendor_id: string;
  schedule_id?: string;
  review_type: string;
  review_date: string;
  reviewer_id: string;
  reviewer_name?: string;
  findings?: string;
  tier_change_recommended: boolean;
  recommended_tier?: string;
  follow_up_actions?: string;
  attestation_confirmed: boolean;
  attestation_text?: string;
  attested_at?: string;
  attested_by_user_id?: string;
  attested_by_name?: string;
  attested_ip_address?: string;
  attested_user_agent?: string;
  status: string;
  created_at: string;
}

// Risk Appetite Types
export interface RiskAppetiteMetric {
  id: string;
  metric_code: string;
  metric_name: string;
  description?: string;
  category: string;
  green_max?: number;
  amber_max?: number;
  measurement_unit: string;
  effective_date: string;
  approved_by?: string;
  approved_at?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface RiskAppetiteHistory {
  id: string;
  metric_id: string;
  previous_green_max?: number;
  previous_amber_max?: number;
  new_green_max?: number;
  new_amber_max?: number;
  change_reason?: string;
  changed_at: string;
  changed_by?: string;
  changed_by_name?: string;
}

// OSFI Notification Types
export interface OSFINotificationTemplate {
  id: string;
  template_code: string;
  template_name: string;
  description?: string;
  subject_template: string;
  body_template: string;
  notification_deadline_hours: number;
  incident_types: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OSFINotificationStatus = 'draft' | 'pending_approval' | 'approved' | 'submitted' | 'acknowledged';

export interface OSFINotification {
  id: string;
  incident_id: string;
  template_id?: string;
  notification_type: string;
  status: OSFINotificationStatus;
  subject: string;
  body: string;
  notification_deadline?: string;
  prepared_by?: string;
  prepared_by_name?: string;
  prepared_at: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_notes?: string;
  submitted_at?: string;
  submitted_by?: string;
  osfi_reference_number?: string;
  response_received_at?: string;
  response_notes?: string;
  created_at: string;
  updated_at: string;
}

// Concentration Types
export interface ConcentrationSnapshot {
  id: string;
  snapshot_date: string;
  snapshot_type: string;
  dimension_key: string;
  dimension_value: string;
  amount: number;
  percentage: number;
  vendor_count: number;
  vendor_ids: string[];
  is_breach: boolean;
  breach_level?: string;
  created_at: string;
}

export interface ConcentrationThreshold {
  id: string;
  organization_id: string;
  threshold_type: string;
  threshold_name: string;
  description?: string;
  warning_level: number;
  critical_level: number;
  measurement_unit: string;
  effective_date: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Document Types
export interface DocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  default_expiry_months?: number;
  required_for_tiers: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export type DocumentStatus = 'current' | 'archived' | 'expired';

export interface VendorDocument {
  id: string;
  vendor_id: string;
  organization_id?: string;
  document_type_id?: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  storage_path: string;
  version: number;
  version_notes?: string;
  is_current: boolean;
  status?: DocumentStatus;
  expiry_date?: string;
  linked_due_diligence_id?: string;
  linked_contract_id?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  created_at: string;
  document_type?: DocumentType;
  review_required?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  auto_detected_type?: boolean;
  original_document_id?: string;
}

// Attestation Types
export type AttestationPeriodStatus = 'open' | 'in_progress' | 'completed' | 'overdue';
export type AttestationSubmissionStatus = 'draft' | 'submitted' | 'accepted' | 'rejected';
export type AttestationResponse = 'compliant' | 'non_compliant' | 'not_applicable';

export interface AttestationPeriod {
  id: string;
  period_type: string;
  period_name: string;
  description?: string;
  period_start: string;
  period_end: string;
  due_date: string;
  status: AttestationPeriodStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AttestationRequirement {
  id: string;
  period_id?: string;
  requirement_code: string;
  requirement_text: string;
  description?: string;
  is_mandatory: boolean;
  sort_order: number;
  created_at: string;
}

export interface AttestationSubmission {
  id: string;
  period_id: string;
  submitted_by_user_id: string;
  submitted_by_name?: string;
  business_unit?: string;
  submission_date?: string;
  status: AttestationSubmissionStatus;
  attestation_confirmed: boolean;
  attestation_text?: string;
  attested_at?: string;
  attested_ip_address?: string;
  attested_user_agent?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  review_date?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AttestationResponseRecord {
  id: string;
  submission_id: string;
  requirement_id: string;
  response: AttestationResponse;
  evidence_notes?: string;
  evidence_document_ids: string[];
  linked_vendor_ids: string[];
  created_at: string;
  updated_at: string;
}

// Workflow Types
export type WorkflowStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated';

export interface WorkflowConfiguration {
  id: string;
  workflow_type: string;
  workflow_name: string;
  description?: string;
  trigger_conditions: Record<string, unknown>;
  approval_chain: Array<{ role: string; label: string }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  workflow_config_id?: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  status: WorkflowStatus;
  current_step: number;
  initiated_by?: string;
  initiated_by_name?: string;
  initiated_at: string;
  completed_at?: string;
  completion_notes?: string;
  created_at: string;
}

export interface WorkflowApproval {
  id: string;
  instance_id: string;
  approver_user_id?: string;
  approver_name?: string;
  approver_role?: string;
  sequence_order: number;
  status: ApprovalStatus;
  decision_at?: string;
  decision_notes?: string;
  delegated_to?: string;
  delegated_at?: string;
  created_at: string;
}

// Assessment Task Types
export type AssessmentTaskType =
  | 'initial_assessment'
  | 'reassessment'
  | 'periodic_review'
  | 'tier_change_review'
  | 'periodic_reassessment'
  | 'material_change'
  | 'contract_renewal'
  | 'bulk_import_assessment'
  | 'reassessment_validation';

export type AssessmentTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type AssessmentTaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface AssessmentTask {
  id: string;
  organization_id: string;
  vendor_id: string;
  task_type: AssessmentTaskType;
  status: AssessmentTaskStatus;
  priority: AssessmentTaskPriority;
  assigned_to?: string;
  assigned_defense_line?: string;
  due_date?: string;
  notes?: string;
  trigger_reason?: string;
  snooze_until?: string;
  snooze_reason?: string;
  snooze_count?: number;
  validation_required?: boolean;
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string;
  related_assessment_id?: string;
  related_task_id?: string;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// Onboarding Document Types
export interface OnboardingDocument {
  id: string;
  organization_id: string;
  request_id: string;
  task_id?: string;
  document_type?: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  storage_path: string;
  description?: string;
  version: number;
  is_current: boolean;
  uploaded_by?: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
}

export const ONBOARDING_DOCUMENT_TYPES = {
  business_case: 'Business Case',
  vendor_info: 'Vendor Information',
  security_assessment: 'Security Assessment',
  soc2_report: 'SOC 2 Report',
  iso_certification: 'ISO Certification',
  financial_statement: 'Financial Statement',
  insurance_certificate: 'Insurance Certificate',
  contract_draft: 'Contract Draft',
  nda: 'Non-Disclosure Agreement',
  data_processing_agreement: 'Data Processing Agreement',
  pricing_proposal: 'Pricing Proposal',
  technical_specification: 'Technical Specification',
  reference_check: 'Reference Check',
  other: 'Other Document',
} as const;

// Due Diligence Document Request Types
export type DDRequestStatus = 'requested' | 'received' | 'under_review' | 'approved' | 'rejected' | 'waived' | 'expired';

export interface DueDiligenceDocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  required_for_tiers: string[];
  blocks_activation_for_tiers: string[];
  default_due_days: number;
  reminder_days: number[];
  is_active: boolean;
  display_order: number;
}

export interface DueDiligenceDocumentRequest {
  id: string;
  organization_id: string;
  vendor_id?: string;
  onboarding_request_id?: string;
  document_type_code: string;
  status: DDRequestStatus;
  is_critical: boolean;
  blocks_activation: boolean;
  requested_at: string;
  requested_by?: string;
  requested_by_name?: string;
  due_date: string;
  received_document_id?: string;
  received_at?: string;
  received_by_name?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  waived_by?: string;
  waived_by_name?: string;
  waived_at?: string;
  waiver_reason?: string;
  reminder_count: number;
  last_reminder_at?: string;
  next_reminder_at?: string;
  notes?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
  document_type?: DueDiligenceDocumentType;
  vendor?: {
    id: string;
    legal_name: string;
    tier?: string;
  };
}

export interface VendorActivationBlock {
  id: string;
  organization_id: string;
  vendor_id: string;
  block_reason: string;
  blocking_document_request_ids: string[];
  missing_document_types: string[];
  is_active: boolean;
  blocked_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  override_allowed: boolean;
  override_by?: string;
  override_at?: string;
  override_reason?: string;
  override_expires_at?: string;
}

export const DD_REQUEST_STATUS_LABELS: Record<DDRequestStatus, string> = {
  requested: 'Requested',
  received: 'Received',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  waived: 'Waived',
  expired: 'Expired',
};

export const DD_REQUEST_STATUS_COLORS: Record<DDRequestStatus, string> = {
  requested: 'bg-amber-100 text-amber-800',
  received: 'bg-blue-100 text-blue-800',
  under_review: 'bg-sky-100 text-sky-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  waived: 'bg-slate-100 text-slate-800',
  expired: 'bg-gray-100 text-gray-800',
};

export const DD_CATEGORY_LABELS: Record<string, string> = {
  security: 'Security & Compliance',
  financial: 'Financial',
  legal: 'Legal & Insurance',
  operational: 'Operational',
  compliance: 'Regulatory Compliance',
  general: 'General',
};

// Extended Incident Type
export interface IncidentExtended {
  id: string;
  incident_id: string;
  vendor_id: string;
  title: string;
  description: string;
  incident_type?: string;
  severity?: string;
  impact_to_frfi?: string;
  detected_date?: string;
  reported_date: string;
  contained_date?: string;
  resolved_date?: string;
  closed_date?: string;
  status: string;
  root_cause?: string;
  remediation_actions?: string;
  lessons_learned?: string;
  preventive_measures?: string;
  osfi_notifiable: boolean;
  osfi_notified: boolean;
  osfi_notification_date?: string;
  osfi_reference_number?: string;
  osfi_notification_deadline?: string;
  notification_status: string;
  customers_affected?: number;
  service_outage_hours?: number;
  involves_regulatory_data: boolean;
  reporter?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

// Offboarding Task Types
export type OffboardingTaskStatus = 'pending' | 'in_progress' | 'completed' | 'not_applicable';
export type OffboardingTaskCategory = 'data' | 'contract' | 'access' | 'financial' | 'communication' | 'documentation';

export interface OffboardingTask {
  id: string;
  organization_id: string;
  vendor_id: string;
  task_name: string;
  task_category: OffboardingTaskCategory;
  description?: string;
  is_required: boolean;
  assigned_to?: string;
  status: OffboardingTaskStatus;
  completed_at?: string;
  completed_by?: string;
  completion_notes?: string;
  due_date?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// ============================================
// AI Types
// ============================================

export type AIAction = 'assess-assist' | 'document-analyze' | 'risk-summarize' | 'risk-predict' | 'query';

export interface AIUsageLog {
  id: string;
  organization_id: string;
  user_id: string;
  action: AIAction;
  model: string;
  tokens_input: number;
  tokens_output: number;
  vendor_id?: string | null;
  created_at: string;
}

export interface AIFeedbackRecord {
  id: string;
  ai_usage_log_id: string;
  user_id: string;
  rating: 'thumbs_up' | 'thumbs_down';
  correction_text?: string | null;
  created_at: string;
}

export interface AIRiskSummary {
  id: string;
  vendor_id: string;
  assessment_id?: string | null;
  overview: string;
  key_risks: string[];
  strengths: string[];
  recommendations: string[];
  osfi_gaps: string[];
  risk_trend: 'improving' | 'stable' | 'deteriorating';
  confidence: 'high' | 'medium' | 'low';
  generated_at: string;
}

export interface AIAssessmentSuggestion {
  question_id: string;
  suggested_value: string | string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface AIAssessmentResponse {
  suggestions: AIAssessmentSuggestion[];
  vendor_context: string;
}

export interface AIDocumentAnalysis {
  document_type: string;
  key_findings: string[];
  compliance_gaps: string[];
  expiry_dates: { item: string; date: string; days_until_expiry: number }[];
  risk_flags: { severity: 'high' | 'medium' | 'low'; description: string }[];
  extracted_data: Record<string, unknown>;
  osfi_provisions?: Record<string, 'present' | 'missing' | 'partial'>;
}

export interface AIRiskPrediction {
  vendor_id: string;
  predicted_score_6m: number;
  predicted_score_12m: number;
  confidence_interval: { low: number; high: number };
  trajectory: 'improving' | 'stable' | 'deteriorating';
  risk_factors: {
    factor: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    impact: 'high' | 'medium' | 'low';
  }[];
  tier_change_risk: {
    likely: boolean;
    from_tier: string | null;
    to_tier: string | null;
  };
  reasoning: string;
  generated_at: string;
}

export interface AIQueryResponse {
  answer: string;
  entities: {
    type: 'vendor' | 'assessment' | 'contract' | 'incident';
    id: string | null;
    label: string;
  }[];
  data_summary?: Record<string, unknown>;
  follow_up_suggestions: string[];
}

export interface MonitoringSignal {
  id: string;
  vendor_id: string;
  signal_type: 'news' | 'financial' | 'regulatory' | 'cyber' | 'esg';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  summary: string;
  source_url?: string | null;
  ai_confidence: 'high' | 'medium' | 'low';
  created_at: string;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
}

export interface FinancialRiskEstimate {
  vendor_id: string;
  ale_estimate: number;
  loss_range_low: number;
  loss_range_high: number;
  loss_drivers: { driver: string; contribution_pct: number }[];
  calculated_at: string;
}

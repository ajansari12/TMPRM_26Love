// Onboarding Workflow Types

import { DefenseLine } from './organization';
import { ServiceCategory, ProviderType, ContractDuration, BusinessUnit } from './index';

// Onboarding Request Status
export type OnboardingStatus =
  | 'draft'
  | 'submitted'
  | '1b_review'
  | '1b_returned'
  | '2nd_review'
  | '2nd_returned'
  | 'pending_senior_approval'
  | 'conditionally_approved'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'vendor_created';

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  '1b_review': 'Pending 1B Review',
  '1b_returned': 'Returned by 1B',
  '2nd_review': 'Pending 2nd Line Review',
  '2nd_returned': 'Returned by 2nd Line',
  pending_senior_approval: 'Pending Senior Approval',
  conditionally_approved: 'Conditionally Approved',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  vendor_created: 'Vendor Created',
};

export const ONBOARDING_STATUS_COLORS: Record<OnboardingStatus, string> = {
  draft: 'bg-slate-100 text-slate-800',
  submitted: 'bg-blue-100 text-blue-800',
  '1b_review': 'bg-indigo-100 text-indigo-800',
  '1b_returned': 'bg-amber-100 text-amber-800',
  '2nd_review': 'bg-cyan-100 text-cyan-800',
  '2nd_returned': 'bg-amber-100 text-amber-800',
  pending_senior_approval: 'bg-rose-100 text-rose-800',
  conditionally_approved: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-slate-100 text-slate-800',
  vendor_created: 'bg-emerald-100 text-emerald-800',
};

// Task Status
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'escalated'
  | 'cancelled';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  escalated: 'Escalated',
  cancelled: 'Cancelled',
};

// Review Decision Types
export type ReviewDecision =
  | 'confirmed'
  | 'returned'
  | 'escalated'
  | 'accepted'
  | 'rejected'
  | 'conditionally_approved';

// Senior Management Review Decision Types
export type SeniorReviewDecision =
  | 'approved'
  | 'approved_with_conditions'
  | 'request_info'
  | 'rejected';

export const SENIOR_REVIEW_DECISION_LABELS: Record<SeniorReviewDecision, string> = {
  approved: 'Approved',
  approved_with_conditions: 'Approved with Conditions',
  request_info: 'Request Additional Information',
  rejected: 'Rejected',
};

export const SENIOR_REVIEW_DECISION_COLORS: Record<SeniorReviewDecision, string> = {
  approved: 'bg-green-100 text-green-800',
  approved_with_conditions: 'bg-yellow-100 text-yellow-800',
  request_info: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

// Priority Levels
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export type RiskTier = 'critical' | 'high' | 'medium' | 'low';

export const RISK_TIER_LABELS: Record<RiskTier, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const RISK_TIER_COLORS: Record<RiskTier, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-green-100 text-green-800',
};

// Sensitive Data Types
export type SensitiveDataType =
  | 'pii'
  | 'financial'
  | 'health'
  | 'credentials'
  | 'proprietary'
  | 'regulatory';

// Onboarding Request
export interface OnboardingRequest {
  id: string;
  organization_id: string;
  request_number: string;
  
  // Vendor Information
  vendor_legal_name: string;
  vendor_trading_name?: string;
  vendor_description?: string;
  vendor_website?: string;
  vendor_country: string;
  vendor_province_state?: string;
  vendor_city?: string;
  vendor_number_of_employees?: number;
  vendor_years_in_operation?: number;
  vendor_primary_contact_name?: string;
  vendor_primary_contact_email?: string;
  vendor_primary_contact_phone?: string;
  
  // Service Details
  service_category: ServiceCategory;
  service_description?: string;
  provider_type: ProviderType;
  
  // Business Context
  requesting_business_unit: BusinessUnit | string;
  business_justification?: string;
  strategic_rationale?: string;
  alternatives_considered?: string;
  
  // Financial Information
  estimated_contract_value_cad?: number;
  contract_duration?: ContractDuration;
  payment_terms?: string;
  budget_approved: boolean;
  budget_approval_reference?: string;
  
  // Risk Indicators
  is_critical_service: boolean;
  supports_essential_operations: boolean;
  failure_impact_description?: string;
  
  handles_sensitive_data: boolean;
  sensitive_data_types?: SensitiveDataType[];
  data_location?: string;
  has_system_access: boolean;
  system_access_description?: string;
  
  is_outsourcing: boolean;
  outsourcing_type?: string;
  
  uses_subcontractors: boolean;
  known_subcontractors?: string;
  
  offshore_components: boolean;
  offshore_locations?: string[];
  
  // Auto-calculated
  preliminary_risk_tier?: string;
  preliminary_risk_score?: number;
  requires_2nd_line_review: boolean;
  
  // Workflow State
  status: OnboardingStatus;
  current_defense_line: DefenseLine;
  priority: Priority;
  
  // SLA
  submitted_at?: string;
  target_completion_date?: string;
  sla_breached: boolean;
  
  // 1A - Requestor
  requested_by?: string;
  requested_at?: string;
  
  // 1B Review
  assigned_1b_reviewer?: string;
  assigned_1b_at?: string;
  reviewed_by_1b?: string;
  reviewed_at_1b?: string;
  review_decision_1b?: ReviewDecision;
  review_notes_1b?: string;
  completeness_confirmed: boolean;
  business_need_validated: boolean;
  initial_risk_acknowledged: boolean;
  
  // 2nd Line Review
  assigned_2nd_reviewer?: string;
  assigned_2nd_at?: string;
  reviewed_by_2nd?: string;
  reviewed_at_2nd?: string;
  review_decision_2nd?: ReviewDecision;
  review_notes_2nd?: string;
  risk_assessment_2nd?: string;
  risk_appetite_alignment?: 'within' | 'exceeds' | 'significantly_exceeds';

  // Senior Management Approval
  requires_senior_approval?: boolean;
  assigned_senior_approver?: string;
  assigned_senior_at?: string;
  reviewed_by_senior?: string;
  reviewed_at_senior?: string;
  review_decision_senior?: SeniorReviewDecision;
  review_notes_senior?: string;
  senior_approval_conditions?: string;

  // Conditions
  approval_conditions?: string[];
  conditions_due_date?: string;
  conditions_owner?: string;
  
  // Final Decision
  final_status?: string;
  final_decision_by?: string;
  final_decision_at?: string;
  final_decision_notes?: string;
  
  // Post-Approval
  created_vendor_id?: string;
  vendor_created_at?: string;
  due_diligence_required: boolean;
  due_diligence_scope?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
  version: number;
  
  // Expanded relations
  requestor?: {
    id: string;
    email: string;
    full_name?: string;
  };
  reviewer_1b?: {
    id: string;
    email: string;
    full_name?: string;
  };
  reviewer_2nd?: {
    id: string;
    email: string;
    full_name?: string;
  };
  tasks?: OnboardingTask[];
  comments?: OnboardingComment[];
  documents?: OnboardingDocument[];
}

// Onboarding Task
export interface OnboardingTask {
  id: string;
  organization_id: string;
  request_id: string;
  
  task_type: 'review' | 'approval' | 'document_request' | 'due_diligence' | 'information_request';
  defense_line: DefenseLine;
  sequence_order: number;
  
  assigned_to?: string;
  assigned_by?: string;
  assigned_at: string;
  
  title: string;
  description?: string;
  instructions?: string;
  
  due_date?: string;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  
  priority: Priority;
  status: TaskStatus;
  
  started_at?: string;
  completed_at?: string;
  completed_by?: string;
  completion_notes?: string;
  outcome?: string;
  
  escalated: boolean;
  escalated_to?: string;
  escalated_at?: string;
  escalation_reason?: string;
  
  created_at: string;
  updated_at: string;
  
  // Expanded relations
  assignee?: {
    id: string;
    email: string;
    full_name?: string;
  };
  request?: OnboardingRequest;
}

// Onboarding Comment
export interface OnboardingComment {
  id: string;
  organization_id: string;
  request_id: string;
  task_id?: string;
  parent_comment_id?: string;
  
  comment_type: 'general' | 'question' | 'response' | 'decision' | 'system';
  defense_line?: DefenseLine;
  
  content: string;
  
  is_internal: boolean;
  visible_to_lines: DefenseLine[];
  
  author_id?: string;
  author_name?: string;
  author_role?: string;
  
  mentioned_users?: string[];
  attachment_ids?: string[];
  
  is_edited: boolean;
  edited_at?: string;
  
  created_at: string;
  
  // Expanded relations
  author?: {
    id: string;
    email: string;
    full_name?: string;
  };
  replies?: OnboardingComment[];
}

// Onboarding Document
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
  uploaded_at: string;
  
  reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  
  created_at: string;
  
  // Expanded
  uploader?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

// Onboarding Audit Log Entry
export interface OnboardingAuditEntry {
  id: string;
  organization_id: string;
  request_id: string;
  
  action_type: string;
  action_description?: string;
  
  previous_status?: OnboardingStatus;
  new_status?: OnboardingStatus;
  previous_defense_line?: DefenseLine;
  new_defense_line?: DefenseLine;
  
  changed_fields?: Record<string, unknown>;
  previous_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  
  performed_by?: string;
  performed_by_name?: string;
  performed_by_defense_line?: DefenseLine;
  
  ip_address?: string;
  user_agent?: string;
  
  performed_at: string;
}

// Form Types for Creating/Editing Requests
export interface OnboardingRequestFormData {
  // Vendor Information
  vendor_legal_name: string;
  vendor_trading_name?: string;
  vendor_description?: string;
  vendor_website?: string;
  vendor_country: string;
  vendor_province_state?: string;
  vendor_city?: string;
  vendor_number_of_employees?: number;
  vendor_years_in_operation?: number;
  vendor_primary_contact_name?: string;
  vendor_primary_contact_email?: string;
  vendor_primary_contact_phone?: string;
  
  // Service Details
  service_category: ServiceCategory;
  service_description?: string;
  provider_type: ProviderType;
  requesting_business_unit: string;
  business_justification?: string;
  strategic_rationale?: string;
  alternatives_considered?: string;
  
  // Financial
  estimated_contract_value_cad?: number;
  contract_duration?: ContractDuration;
  payment_terms?: string;
  budget_approved: boolean;
  budget_approval_reference?: string;
  
  // Risk Indicators
  is_critical_service: boolean;
  supports_essential_operations: boolean;
  failure_impact_description?: string;
  handles_sensitive_data: boolean;
  sensitive_data_types?: SensitiveDataType[];
  data_location?: string;
  has_system_access: boolean;
  system_access_description?: string;
  is_outsourcing: boolean;
  outsourcing_type?: string;
  uses_subcontractors: boolean;
  known_subcontractors?: string;
  offshore_components: boolean;
  offshore_locations?: string[];
}

// Workflow Summary for Dashboard
export interface OnboardingWorkflowSummary {
  total_requests: number;
  draft: number;
  pending_1b_review: number;
  pending_2nd_review: number;
  pending_senior_approval: number;
  approved_this_month: number;
  rejected_this_month: number;
  average_processing_days: number;
  overdue_tasks: number;

  by_business_unit: Record<string, number>;
  by_service_category: Record<string, number>;
  by_risk_tier: Record<string, number>;
}

// Senior Approval Configuration
export interface SeniorApprovalConfig {
  id: string;
  organization_id: string;
  tiers_requiring_approval: string[];
  contract_value_threshold_cad?: number;
  require_for_outsourcing: boolean;
  auto_escalate_after_days: number;
  reminder_after_days: number;
  notify_on_assignment: boolean;
  notify_on_completion: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Senior Approver
export interface SeniorApprover {
  id: string;
  organization_id: string;
  user_id: string;
  title?: string;
  approval_authority_level: number;
  can_approve_tiers: string[];
  max_contract_value_cad?: number;
  is_delegate: boolean;
  delegate_for_user_id?: string;
  delegation_start_date?: string;
  delegation_end_date?: string;
  is_available: boolean;
  unavailable_until?: string;
  backup_approver_id?: string;
  notification_email?: string;
  receive_notifications: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

// My Tasks View
export interface MyTasksSummary {
  pending: number;
  in_progress: number;
  overdue: number;
  completed_this_week: number;
  tasks: OnboardingTask[];
}

// Platform Admin and Workflow Configuration Types
// Supports super admin capabilities, shared third party registry, and configurable workflows

// ============================================================================
// PLATFORM ADMIN TYPES
// ============================================================================

export type PlatformRole = 'super_admin' | 'platform_support' | 'platform_viewer';

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: 'Super Admin',
  platform_support: 'Platform Support',
  platform_viewer: 'Platform Viewer',
};

export const PLATFORM_ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  super_admin: 'Full access to all platform features, tenants, and configurations',
  platform_support: 'Can view and support tenants, but cannot modify platform settings',
  platform_viewer: 'Read-only access to platform data and reports',
};

export interface PlatformAdminPermissions {
  can_manage_tenants: boolean;
  can_manage_platform_admins: boolean;
  can_view_all_data: boolean;
  can_impersonate_users: boolean;
  can_manage_global_config: boolean;
  can_access_audit_logs: boolean;
  can_manage_billing: boolean;
}

export interface PlatformAdmin {
  id: string;
  user_id: string;
  role: PlatformRole;
  permissions: PlatformAdminPermissions;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  is_active: boolean;
  // Joined data
  user_email?: string;
  user_name?: string;
}

export interface PlatformAuditEntry {
  id: string;
  admin_id: string;
  action: string;
  resource_type: 'tenant' | 'platform_admin' | 'global_config' | 'workflow_template' | 'global_third_party';
  resource_id?: string;
  organization_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  // Joined data
  admin_name?: string;
  organization_name?: string;
}

// ============================================================================
// GLOBAL THIRD PARTY REGISTRY
// ============================================================================

export type CompanyType = 'public' | 'private' | 'government' | 'non_profit';

export interface GlobalThirdParty {
  id: string;
  legal_name: string;
  trading_names?: string[];
  lei?: string; // Legal Entity Identifier
  duns_number?: string;
  headquarters_country: string;
  headquarters_address?: {
    street?: string;
    city?: string;
    state_province?: string;
    postal_code?: string;
    country?: string;
  };
  operating_countries?: string[];
  company_type?: CompanyType;
  industry_codes?: string[];
  website?: string;
  global_risk_score?: number;
  known_incidents?: number;
  regulatory_actions?: string[];
  verified_at?: string;
  verified_by?: string;
  verification_source?: 'manual' | 'd_and_b' | 'bloomberg' | 'refinitiv';
  created_at: string;
  updated_at: string;
}

export interface VendorGlobalLink {
  id: string;
  organization_id: string;
  vendor_id: string;
  global_third_party_id: string;
  link_confidence: 'confirmed' | 'suggested' | 'manual';
  linked_at: string;
  linked_by?: string;
  // Joined data
  vendor_name?: string;
  organization_name?: string;
  global_third_party?: GlobalThirdParty;
}

export interface ThirdPartyConcentration {
  global_third_party_id: string;
  legal_name: string;
  headquarters_country: string;
  fi_count: number;
  total_relationships: number;
  institution_types: string[];
}

// ============================================================================
// WORKFLOW CONFIGURATION
// ============================================================================

export interface WorkflowStepDefinition {
  order: number;
  id: string;
  name: string;
  defense_line: '1a' | '1b' | '2nd' | '3rd' | null;
  actions: string[];
  required_fields?: string[];
  sla_hours?: number;
  auto_transition?: boolean;
  auto_transition_delay_minutes?: number;
  next_step?: string;
  next_step_on_confirm?: string;
  next_step_on_return?: string;
  next_step_on_accept?: string;
  next_step_on_reject?: string;
  is_terminal?: boolean;
}

export interface WorkflowConditions {
  skip_1b_for_low_risk?: boolean;
  skip_1b_contract_threshold?: number | null;
  require_2nd_line_for_all?: boolean;
  require_additional_approval_above?: number;
  auto_approve_renewals_under?: number | null;
  eligible_risk_tiers?: string[];
  max_contract_value?: number;
  excluded_service_categories?: string[];
}

export interface WorkflowSLAConfig {
  warning_threshold_percent: number;
  escalation_enabled: boolean;
  escalation_recipients: string[];
  max_extensions?: number;
  extension_hours?: number;
}

export interface WorkflowNotificationConfig {
  on_submit?: { recipients: string[]; template: string };
  on_1b_confirm?: { recipients: string[]; template: string };
  on_return?: { recipients: string[]; template: string };
  on_approve?: { recipients: string[]; template: string };
  on_reject?: { recipients: string[]; template: string };
  on_sla_warning?: { recipients: string[]; template: string };
  on_sla_breach?: { recipients: string[]; template: string };
}

export interface WorkflowTemplate {
  id: string;
  organization_id?: string; // null = platform default
  name: string;
  code: string;
  description?: string;
  version: number;
  is_active: boolean;
  is_default: boolean;
  steps: WorkflowStepDefinition[];
  conditions: WorkflowConditions;
  sla_config: WorkflowSLAConfig;
  notification_config: WorkflowNotificationConfig;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepConfig {
  id: string;
  organization_id: string;
  workflow_template_id: string;
  step_id: string;
  defense_line: '1a' | '1b' | '2nd' | '3rd' | 'admin';
  auto_assign_to?: {
    type: 'role' | 'user' | 'round_robin';
    value: string;
  };
  fallback_assignees?: string[];
  sla_hours?: number;
  warning_hours?: number;
  escalation_hours?: number;
  escalation_to?: {
    type: 'role' | 'user';
    value: string;
  };
  required_attachments?: string[];
  required_approvals?: number;
  skip_conditions?: {
    when: Array<{
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
      value: any;
    }>;
    logic: 'AND' | 'OR';
  };
  created_at: string;
  updated_at: string;
}

// ============================================================================
// WORKFLOW APPROVALS
// ============================================================================

export type ApprovalDecision = 'approved' | 'rejected' | 'abstained' | 'delegated';

export interface WorkflowApproval {
  id: string;
  organization_id: string;
  workflow_type: 'onboarding' | 'contract' | 'incident';
  workflow_item_id: string;
  step_id: string;
  approver_id: string;
  decision: ApprovalDecision;
  delegated_to?: string;
  conditions?: string[];
  notes?: string;
  risk_assessment_score?: number;
  requested_at: string;
  decided_at?: string;
  sla_deadline?: string;
  created_at: string;
  // Joined data
  approver_name?: string;
  delegate_name?: string;
}

// ============================================================================
// DELEGATION
// ============================================================================

export type DelegationType = 'all' | 'specific_workflows' | 'approval_only';
export type DelegationReason = 'vacation' | 'leave' | 'temporary_assignment' | 'other';

export interface UserDelegation {
  id: string;
  organization_id: string;
  delegator_id: string;
  delegate_id: string;
  delegation_type: DelegationType;
  workflow_types?: string[];
  effective_from: string;
  effective_until?: string;
  reason?: DelegationReason;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  // Joined data
  delegator_name?: string;
  delegate_name?: string;
}

// ============================================================================
// PLATFORM ADMIN VIEWS
// ============================================================================

export interface TenantOverview {
  id: string;
  name: string;
  institution_type: string;
  user_count: number;
  vendor_count: number;
  created_at: string;
  is_active: boolean;
  // Additional stats
  active_requests?: number;
  pending_reviews?: number;
  total_contract_value?: number;
}

export interface CrossFIUsage {
  organization_id: string;
  organization_name: string;
  vendor_id: string;
  vendor_name: string;
  risk_tier: string;
  contract_count: number;
  total_contract_value: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const canPlatformAdminPerform = (
  admin: PlatformAdmin,
  action: keyof PlatformAdminPermissions
): boolean => {
  if (admin.role === 'super_admin') return true;
  return admin.permissions[action] ?? false;
};

export const getWorkflowStepByStatus = (
  template: WorkflowTemplate,
  status: string
): WorkflowStepDefinition | undefined => {
  return template.steps.find(step => step.id === status);
};

export const getNextStep = (
  step: WorkflowStepDefinition,
  action: string
): string | undefined => {
  switch (action) {
    case 'submit':
    case 'auto_transition':
      return step.next_step;
    case 'confirm':
      return step.next_step_on_confirm;
    case 'return':
      return step.next_step_on_return;
    case 'accept':
    case 'accept_with_conditions':
      return step.next_step_on_accept;
    case 'reject':
      return step.next_step_on_reject;
    default:
      return step.next_step;
  }
};

export const isStepSkippable = (
  stepConfig: WorkflowStepConfig,
  requestData: Record<string, any>
): boolean => {
  if (!stepConfig.skip_conditions?.when?.length) return false;
  
  const { when, logic } = stepConfig.skip_conditions;
  
  const evaluateCondition = (condition: typeof when[0]): boolean => {
    const fieldValue = requestData[condition.field];
    
    switch (condition.operator) {
      case 'eq': return fieldValue === condition.value;
      case 'ne': return fieldValue !== condition.value;
      case 'gt': return fieldValue > condition.value;
      case 'lt': return fieldValue < condition.value;
      case 'gte': return fieldValue >= condition.value;
      case 'lte': return fieldValue <= condition.value;
      case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      default: return false;
    }
  };
  
  if (logic === 'AND') {
    return when.every(evaluateCondition);
  } else {
    return when.some(evaluateCondition);
  }
};

export const WORKFLOW_ACTION_LABELS: Record<string, string> = {
  save_draft: 'Save Draft',
  submit: 'Submit for Review',
  delete: 'Delete',
  recall: 'Recall Submission',
  confirm: 'Confirm & Forward',
  return: 'Return to Requestor',
  escalate: 'Escalate',
  accept: 'Accept',
  accept_with_conditions: 'Accept with Conditions',
  reject: 'Reject',
  create_vendor: 'Create Vendor Record',
  resubmit: 'Resubmit',
  archive: 'Archive',
};

export const WORKFLOW_ACTION_COLORS: Record<string, string> = {
  save_draft: 'gray',
  submit: 'blue',
  delete: 'red',
  recall: 'yellow',
  confirm: 'green',
  return: 'orange',
  escalate: 'red',
  accept: 'green',
  accept_with_conditions: 'yellow',
  reject: 'red',
  create_vendor: 'blue',
  resubmit: 'blue',
  archive: 'gray',
};

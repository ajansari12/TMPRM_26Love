// Organization and Multi-Tenant Types

// Institution types (OSFI FRFI categories)
export type InstitutionType =
  | 'bank'
  | 'foreign_bank_branch'
  | 'trust_company'
  | 'loan_company'
  | 'life_insurance'
  | 'property_casualty_insurance'
  | 'fraternal_benefit_society'
  | 'credit_union'
  | 'other';

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  bank: 'Bank',
  foreign_bank_branch: 'Foreign Bank Branch',
  trust_company: 'Trust Company',
  loan_company: 'Loan Company',
  life_insurance: 'Life Insurance Company',
  property_casualty_insurance: 'Property & Casualty Insurance',
  fraternal_benefit_society: 'Fraternal Benefit Society',
  credit_union: 'Credit Union',
  other: 'Other',
};

// Defense Line Types (Three Lines of Defense + Senior Management)
export type DefenseLine = '1a' | '1b' | '2nd' | '3rd' | 'admin' | 'senior_management';

export const DEFENSE_LINE_LABELS: Record<DefenseLine, string> = {
  '1a': '1st Line (Business)',
  '1b': '1st Line (Coordinator)',
  '2nd': '2nd Line (Risk/Compliance)',
  '3rd': '3rd Line (Audit)',
  'admin': 'Administrator',
  'senior_management': 'Senior Management',
};

export const DEFENSE_LINE_COLORS: Record<DefenseLine, string> = {
  '1a': 'bg-blue-100 text-blue-800',
  '1b': 'bg-indigo-100 text-indigo-800',
  '2nd': 'bg-cyan-100 text-cyan-800',
  '3rd': 'bg-orange-100 text-orange-800',
  'admin': 'bg-slate-100 text-slate-800',
  'senior_management': 'bg-rose-100 text-rose-800',
};

// Organization (Tenant)
export interface Organization {
  id: string;
  name: string;
  trading_name?: string;
  institution_type: InstitutionType;
  
  // Regulatory
  osfi_registration_number?: string;
  lei?: string;
  
  // Address
  street_address?: string;
  city?: string;
  province_state?: string;
  postal_code?: string;
  country: string;
  
  // Primary Contact
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  
  // Risk Appetite
  risk_appetite_statement?: string;
  max_critical_vendors?: number;
  max_single_vendor_concentration_pct?: number;
  
  // Settings
  settings: OrganizationSettings;
  
  // Branding
  logo_url?: string;
  primary_color?: string;
  
  // Status
  is_active: boolean;
  onboarded_at?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface OrganizationSettings {
  require_1b_review: boolean;
  require_2nd_line_for_critical: boolean;
  auto_approve_low_risk: boolean;
  onboarding_sla_days: number;
  due_diligence_reminder_days: number[];
  default_review_frequency_days: number;
}

// Organization User (User's membership and role in an organization)
export interface OrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  
  // Role & Defense Line
  defense_line: DefenseLine;
  role_title?: string;
  
  // Business Unit
  business_unit?: string;
  department?: string;
  
  // Permissions
  can_create_requests: boolean;
  can_review: boolean;
  can_approve: boolean;
  can_manage_users: boolean;
  can_configure_workflows: boolean;
  
  // Approval Authority
  approval_limit_cad?: number;
  can_approve_critical: boolean;
  
  // Delegation
  delegate_to_user_id?: string;
  delegation_start_date?: string;
  delegation_end_date?: string;
  
  // Contact
  notification_email?: string;
  receive_task_notifications: boolean;
  receive_escalation_notifications: boolean;
  
  // Status
  is_active: boolean;
  
  // Audit
  created_at: string;
  updated_at: string;
  invited_by?: string;
  
  // Expanded relations (for queries)
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
  organization?: Organization;
}

// Defense Line Configuration
export interface DefenseLineConfig {
  id: string;
  organization_id: string;
  defense_line: DefenseLine;
  
  display_name: string;
  description?: string;
  
  // Workflow Settings
  is_required_in_workflow: boolean;
  can_skip_for_low_risk: boolean;
  review_sla_hours: number;
  escalation_after_hours: number;
  
  // Notifications
  notify_on_new_request: boolean;
  notify_on_overdue: boolean;
  escalation_email?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
}

// Workflow Routing Rule
export interface WorkflowRoutingRule {
  id: string;
  organization_id: string;
  
  rule_name: string;
  description?: string;
  rule_type: 'auto_assign' | 'escalation' | 'skip';
  
  conditions: WorkflowConditions;
  
  action_type: 'assign_to_user' | 'assign_to_role' | 'skip_step' | 'require_step';
  action_target?: string;
  action_parameters: Record<string, unknown>;
  
  priority: number;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface WorkflowConditions {
  service_category?: string[];
  estimated_value_min?: number;
  estimated_value_max?: number;
  is_critical?: boolean;
  is_outsourcing?: boolean;
  business_unit?: string[];
  provider_type?: string[];
  risk_tier?: string[];
}

// Organization Statistics (for dashboard)
export interface OrganizationStats {
  total_vendors: number;
  critical_vendors: number;
  active_onboarding_requests: number;
  pending_reviews_1b: number;
  pending_reviews_2nd: number;
  pendingReviews?: number;
  overdue_tasks: number;
  average_onboarding_days: number;
}

// Invitation for new organization users
export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  defense_line: DefenseLine;
  role_title?: string;
  business_unit?: string;
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
  expires_at: string;
  token: string;
  is_used: boolean;
}

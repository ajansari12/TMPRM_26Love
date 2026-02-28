import type { OrganizationSettings } from '../../types/organization';

export type SettingsTab =
  | 'profile'
  | 'organization'
  | 'workflow'
  | 'weights'
  | 'tiers'
  | 'auto-critical'
  | 'templates'
  | 'kri'
  | 'lifecycle'
  | 'users';

export interface TierRoutingRule {
  require_2nd_line: boolean;
  default_reviewer: string;
  auto_approve_eligible: boolean;
}

export interface TierRoutingRules {
  tier_1: TierRoutingRule;
  tier_2: TierRoutingRule;
  tier_3: TierRoutingRule;
  tier_4: TierRoutingRule;
  tier_5: TierRoutingRule;
}

export interface ReassessmentFrequencies {
  tier_1: number;
  tier_2: number;
  tier_3: number;
  tier_4: number;
  tier_5: number;
}

export interface TierConfigItem {
  id: string;
  organization_id: string;
  tier_level: string;
  min_risk_score: number;
  review_frequency_days: number | null;
  tier_label: string;
  tier_description: string;
  tier_color: string;
  display_order: number;
}

export interface OSFIWeights {
  id?: string;
  organization_id?: string;
  exit_strategy_weight: number;
  bcp_weight: number;
  incident_response_weight: number;
  audit_rights_weight: number;
  financial_viability_weight: number;
  insurance_weight: number;
}

export interface UserNotificationPrefs {
  notification_email: string;
  receive_task_notifications: boolean;
  receive_escalation_notifications: boolean;
}

export const DEFAULT_TIER_ROUTING: TierRoutingRules = {
  tier_1: { require_2nd_line: false, default_reviewer: '1b', auto_approve_eligible: true },
  tier_2: { require_2nd_line: false, default_reviewer: '1b', auto_approve_eligible: true },
  tier_3: { require_2nd_line: true, default_reviewer: '2nd', auto_approve_eligible: false },
  tier_4: { require_2nd_line: true, default_reviewer: '2nd', auto_approve_eligible: false },
  tier_5: { require_2nd_line: true, default_reviewer: '2nd', auto_approve_eligible: false },
};

export const DEFAULT_REASSESSMENT_FREQUENCIES: ReassessmentFrequencies = {
  tier_1: 36,
  tier_2: 24,
  tier_3: 12,
  tier_4: 12,
  tier_5: 6,
};

export const DEFAULT_OSFI_WEIGHTS: OSFIWeights = {
  exit_strategy_weight: 0.10,
  bcp_weight: 0.15,
  incident_response_weight: 0.10,
  audit_rights_weight: 0.05,
  financial_viability_weight: 0.10,
  insurance_weight: 0.05,
};

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  require_1b_review: true,
  require_2nd_line_for_critical: true,
  auto_approve_low_risk: false,
  onboarding_sla_days: 30,
  due_diligence_reminder_days: [30, 14, 7],
  default_review_frequency_days: 365,
};

export const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
};

export const ROLE_OPTIONS = [
  { value: 'risk_manager', label: 'Risk Manager' },
  { value: 'vendor_owner', label: 'Vendor Owner' },
  { value: 'compliance_analyst', label: 'Compliance Analyst' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'executive', label: 'Executive' },
  { value: 'business_user', label: 'Business User' },
];

export const IMPACT_FACTORS = [
  { key: 'weight_criticality', label: 'Criticality', description: 'Supports essential operations' },
  { key: 'weight_product_type', label: 'Product/Service Type', description: 'Nature of service provided' },
  { key: 'weight_dependency', label: 'Dependency Level', description: 'Reliance on the provider' },
  { key: 'weight_financial_resilience', label: 'Financial Impact', description: 'Cost and financial exposure' },
  { key: 'weight_strategic_reputational', label: 'Strategic/Reputational', description: 'Public perception impact' },
  { key: 'weight_data_sensitivity', label: 'Data Sensitivity', description: 'Data handling requirements' },
];

export const LIKELIHOOD_FACTORS = [
  { key: 'weight_concentration', label: 'Concentration Risk', description: 'Provider availability' },
  { key: 'weight_access_level', label: 'Access Level', description: 'System and data access' },
  { key: 'weight_subcontractor', label: 'Subcontractor Risk', description: 'Fourth-party exposure' },
  { key: 'weight_legal_regulatory', label: 'Legal/Regulatory', description: 'Compliance requirements' },
  { key: 'weight_operational_maturity', label: 'Operational Maturity', description: 'Provider capability' },
  { key: 'weight_other_risks', label: 'Other Risk Factors', description: 'ESG, geopolitical, etc.' },
];

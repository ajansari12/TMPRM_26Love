import { TieringAssessment, Vendor, CategoryWeights, TierLevel } from '../types';
import { VendorArchetype, ARCHETYPE_WEIGHT_ADJUSTMENTS, determineVendorArchetype } from './vendorProfiles';

export interface TierConfig {
  label: string;
  description: string;
  color: string;
  bgClass: string;
  dotClass: string;
  reviewFrequency: string;
  reviewDays: number | null;
}

export interface OrganizationTierConfig {
  id: string;
  organization_id: string;
  tier_level: TierLevel;
  min_risk_score: number;
  review_frequency_days: number | null;
  tier_label: string;
  tier_description: string | null;
  tier_color: string;
  display_order: number;
}

export interface OrganizationOSFIWeights {
  id: string;
  organization_id: string;
  exit_strategy_weight: number;
  bcp_weight: number;
  incident_response_weight: number;
  audit_rights_weight: number;
  financial_viability_weight: number;
  insurance_weight: number;
}

export const DEFAULT_TIER_THRESHOLDS: Record<TierLevel, number> = {
  tier_5_critical: 15,
  tier_4_high: 10,
  tier_3_moderate: 5,
  tier_2_low: 2,
  tier_1_informational: 0,
};

export const DEFAULT_OSFI_WEIGHTS: OrganizationOSFIWeights = {
  id: '',
  organization_id: '',
  exit_strategy_weight: 0.10,
  bcp_weight: 0.15,
  incident_response_weight: 0.10,
  audit_rights_weight: 0.05,
  financial_viability_weight: 0.10,
  insurance_weight: 0.05,
};

export const tierConfig: Record<TierLevel, TierConfig> = {
  tier_5_critical: {
    label: 'Critical',
    description: 'Directly Impacts Core Business',
    color: 'red',
    bgClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
    reviewFrequency: 'quarterly',
    reviewDays: 90,
  },
  tier_4_high: {
    label: 'High Risk',
    description: 'Important but not mission-critical',
    color: 'orange',
    bgClass: 'bg-orange-100 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
    reviewFrequency: 'semi-annual',
    reviewDays: 180,
  },
  tier_3_moderate: {
    label: 'Moderate Risk',
    description: 'Support functions with moderate impact',
    color: 'amber',
    bgClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    reviewFrequency: 'annual',
    reviewDays: 365,
  },
  tier_2_low: {
    label: 'Low Risk',
    description: 'Support functions with minimal impact',
    color: 'emerald',
    bgClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
    reviewFrequency: 'biennial',
    reviewDays: 730,
  },
  tier_1_informational: {
    label: 'Informational',
    description: 'No formal contract or direct engagement',
    color: 'slate',
    bgClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
    reviewFrequency: 'as-needed',
    reviewDays: null,
  },
};

interface ScoreBreakdown {
  impact: {
    criticality: number;
    product: number;
    dependency: number;
    financial: number;
    strategic: number;
    data: number;
  };
  likelihood: {
    concentration: number;
    access: number;
    subcontractor: number;
    legal: number;
    maturity: number;
    other_risks: number;
  };
  osfiCompliance: {
    exit_strategy: number;
    bcp: number;
    incident_response: number;
    audit_rights: number;
    financial_viability: number;
    insurance: number;
  };
}

export interface AutoCriticalRule {
  id: string;
  organization_id: string;
  rule_name: string;
  rule_description: string | null;
  conditions: AutoCriticalCondition[];
  is_active: boolean;
  priority: number;
}

export interface AutoCriticalCondition {
  field: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in' | 'contains';
  value: string | number | boolean | string[] | number[];
}

export interface AutoCriticalMatch {
  rule_id: string;
  rule_name: string;
  matched_conditions: string[];
}

export interface TierCalculationResult {
  tier: TierLevel;
  is_auto_critical: boolean;
  auto_critical_rule_id?: string;
  auto_critical_rule_name?: string;
  auto_critical_matched_conditions?: string[];
  criticality_score?: number;
  impact_score: number;
  likelihood_score: number;
  risk_rating: number;
  reason?: string;
  score_breakdown?: ScoreBreakdown;
  exit_strategy_score?: number;
  bcp_score?: number;
  incident_response_score?: number;
  audit_rights_score?: number;
  financial_viability_score?: number;
  insurance_score?: number;
  vendor_archetype?: VendorArchetype;
}

const getScore = (value: string | number | undefined): number => {
  if (value === undefined || value === null) return 1;
  const str = String(value);
  const match = str.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 1;
};

const criticalityMap: Record<string, number> = {
  yes_disruption_stops_operations: 5,
  yes_critical: 4,
  yes_important: 3,
  no: 1,
};

function calculateExitStrategyScore(assessment: Partial<TieringAssessment>): number {
  const scores: number[] = [];

  if (assessment.q27b_exit_plan_documented) {
    scores.push(getScore(assessment.q27b_exit_plan_documented));
  }
  if (assessment.q27c_transition_period) {
    scores.push(getScore(assessment.q27c_transition_period));
  }
  if (assessment.q27d_data_portability) {
    scores.push(getScore(assessment.q27d_data_portability));
  }
  if (assessment.q27e_exit_fees) {
    scores.push(getScore(assessment.q27e_exit_fees));
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateBCPScore(assessment: Partial<TieringAssessment>): number {
  const scores: number[] = [];

  if (assessment.q27f_bcp_documented) {
    scores.push(getScore(assessment.q27f_bcp_documented));
  }
  if (assessment.q27g_bcp_tested) {
    scores.push(getScore(assessment.q27g_bcp_tested));
  }
  if (assessment.q27h_rto_rpo) {
    scores.push(getScore(assessment.q27h_rto_rpo));
  }
  if (assessment.q27i_geographic_redundancy) {
    scores.push(getScore(assessment.q27i_geographic_redundancy));
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateIncidentResponseScore(assessment: Partial<TieringAssessment>): number {
  const scores: number[] = [];

  if (assessment.q32b_incident_response_plan) {
    scores.push(getScore(assessment.q32b_incident_response_plan));
  }
  if (assessment.q32c_notification_period) {
    scores.push(getScore(assessment.q32c_notification_period));
  }
  if (assessment.q32d_past_incidents) {
    scores.push(getScore(assessment.q32d_past_incidents));
  }
  if (assessment.q32e_incident_testing) {
    scores.push(getScore(assessment.q32e_incident_testing));
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateAuditRightsScore(assessment: Partial<TieringAssessment>): number {
  const scores: number[] = [];

  if (assessment.q43b_audit_rights) {
    scores.push(getScore(assessment.q43b_audit_rights));
  }
  if (assessment.q43c_osfi_access) {
    scores.push(getScore(assessment.q43c_osfi_access));
  }
  if (assessment.q43e_audit_exercised) {
    scores.push(getScore(assessment.q43e_audit_exercised));
  }

  if (assessment.q43d_certifications && Array.isArray(assessment.q43d_certifications)) {
    const certCount = assessment.q43d_certifications.filter(c => c !== 'none').length;
    if (certCount >= 3) scores.push(1);
    else if (certCount >= 2) scores.push(2);
    else if (certCount >= 1) scores.push(3);
    else scores.push(5);
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateFinancialViabilityScore(assessment: Partial<TieringAssessment>): number {
  const scores: number[] = [];

  if (assessment.q45b_financial_stability) {
    scores.push(getScore(assessment.q45b_financial_stability));
  }
  if (assessment.q45c_ownership_changes) {
    scores.push(getScore(assessment.q45c_ownership_changes));
  }
  if (assessment.q45d_ownership_type) {
    scores.push(getScore(assessment.q45d_ownership_type));
  }
  if (assessment.q45e_going_concern) {
    scores.push(getScore(assessment.q45e_going_concern));
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateInsuranceScore(assessment: Partial<TieringAssessment>): number {
  const scores: number[] = [];

  if (assessment.q53b_professional_liability) {
    scores.push(getScore(assessment.q53b_professional_liability));
  }
  if (assessment.q53c_cyber_liability) {
    scores.push(getScore(assessment.q53c_cyber_liability));
  }
  if (assessment.q53d_coverage_adequacy) {
    scores.push(getScore(assessment.q53d_coverage_adequacy));
  }
  if (assessment.q53e_indemnification) {
    scores.push(getScore(assessment.q53e_indemnification));
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function evaluateCondition(
  condition: AutoCriticalCondition,
  assessment: Partial<TieringAssessment>,
  vendor: Partial<Vendor>
): boolean {
  const { field, operator, value } = condition;

  let fieldValue: unknown;

  if (field.startsWith('q') && field.includes('_')) {
    fieldValue = (assessment as Record<string, unknown>)[field];
  } else if (field in vendor) {
    fieldValue = (vendor as Record<string, unknown>)[field];
  } else if (field in assessment) {
    fieldValue = (assessment as Record<string, unknown>)[field];
  }

  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  switch (operator) {
    case '=':
      return fieldValue === value;
    case '!=':
      return fieldValue !== value;
    case '>':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
    case '>=':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue >= value;
    case '<':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
    case '<=':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue <= value;
    case 'in':
      if (Array.isArray(value)) {
        return value.includes(fieldValue as string | number);
      }
      return false;
    case 'not_in':
      if (Array.isArray(value)) {
        return !value.includes(fieldValue as string | number);
      }
      return false;
    case 'contains':
      if (typeof fieldValue === 'string' && typeof value === 'string') {
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      }
      return false;
    default:
      return false;
  }
}

function formatConditionDescription(condition: AutoCriticalCondition): string {
  const fieldLabels: Record<string, string> = {
    contract_value_cad: 'Contract Value',
    handles_sensitive_data: 'Handles Sensitive Data',
    service_category: 'Service Category',
    q14_customer_facing: 'Customer Facing (Q14)',
    q15_operational_impact: 'Operational Impact (Q15)',
    q15_supports_essential_operations: 'Essential Operations (Q15)',
    q16_essential_to_business: 'Business Essentiality (Q16)',
    q22_substitutability: 'Substitutability (Q22)',
    q22_dependency_level: 'Dependency Level (Q22)',
    q31_data_sensitivity: 'Data Sensitivity (Q31)',
    q32_cybersecurity_risk: 'Cybersecurity Risk (Q32)',
  };

  const operatorLabels: Record<string, string> = {
    '=': 'equals',
    '!=': 'not equals',
    '>': 'greater than',
    '>=': 'at least',
    '<': 'less than',
    '<=': 'at most',
    'in': 'is one of',
    'not_in': 'is not one of',
    'contains': 'contains',
  };

  const fieldLabel = fieldLabels[condition.field] || condition.field;
  const operatorLabel = operatorLabels[condition.operator] || condition.operator;
  const valueStr = Array.isArray(condition.value)
    ? condition.value.join(', ')
    : String(condition.value);

  return `${fieldLabel} ${operatorLabel} ${valueStr}`;
}

export function checkAutoCriticalRules(
  rules: AutoCriticalRule[],
  assessment: Partial<TieringAssessment>,
  vendor: Partial<Vendor>
): AutoCriticalMatch | null {
  const activeRules = rules
    .filter(rule => rule.is_active)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    if (!rule.conditions || rule.conditions.length === 0) {
      continue;
    }

    const allConditionsMet = rule.conditions.every(condition =>
      evaluateCondition(condition, assessment, vendor)
    );

    if (allConditionsMet) {
      return {
        rule_id: rule.id,
        rule_name: rule.rule_name,
        matched_conditions: rule.conditions.map(formatConditionDescription),
      };
    }
  }

  return null;
}

function applyArchetypeWeights(
  baseWeights: CategoryWeights,
  archetype: VendorArchetype
): CategoryWeights {
  const adjustments = ARCHETYPE_WEIGHT_ADJUSTMENTS[archetype] || {};
  const adjustedWeights = { ...baseWeights };

  Object.entries(adjustments).forEach(([key, multiplier]) => {
    if (key in adjustedWeights && typeof multiplier === 'number') {
      (adjustedWeights as Record<string, number>)[key] *= multiplier;
    }
  });

  const impactSum =
    adjustedWeights.weight_criticality +
    adjustedWeights.weight_product_type +
    adjustedWeights.weight_dependency +
    adjustedWeights.weight_financial_resilience +
    adjustedWeights.weight_strategic_reputational +
    adjustedWeights.weight_data_sensitivity;

  if (impactSum > 1) {
    adjustedWeights.weight_criticality /= impactSum;
    adjustedWeights.weight_product_type /= impactSum;
    adjustedWeights.weight_dependency /= impactSum;
    adjustedWeights.weight_financial_resilience /= impactSum;
    adjustedWeights.weight_strategic_reputational /= impactSum;
    adjustedWeights.weight_data_sensitivity /= impactSum;
  }

  const likelihoodSum =
    adjustedWeights.weight_concentration +
    adjustedWeights.weight_access_level +
    adjustedWeights.weight_subcontractor +
    adjustedWeights.weight_legal_regulatory +
    adjustedWeights.weight_operational_maturity +
    adjustedWeights.weight_other_risks;

  if (likelihoodSum > 1) {
    adjustedWeights.weight_concentration /= likelihoodSum;
    adjustedWeights.weight_access_level /= likelihoodSum;
    adjustedWeights.weight_subcontractor /= likelihoodSum;
    adjustedWeights.weight_legal_regulatory /= likelihoodSum;
    adjustedWeights.weight_operational_maturity /= likelihoodSum;
    adjustedWeights.weight_other_risks /= likelihoodSum;
  }

  return adjustedWeights;
}

export function calculateTierAssessment(
  assessment: Partial<TieringAssessment>,
  vendor: Partial<Vendor>,
  categoryWeights: CategoryWeights,
  archetype?: VendorArchetype,
  tierThresholds?: Record<TierLevel, number>,
  osfiWeights?: OrganizationOSFIWeights,
  autoCriticalRules?: AutoCriticalRule[]
): TierCalculationResult {
  const thresholds = tierThresholds || DEFAULT_TIER_THRESHOLDS;
  const osfi = osfiWeights || DEFAULT_OSFI_WEIGHTS;
  const vendorArchetype = archetype || (vendor.service_category && vendor.provider_type
    ? determineVendorArchetype(vendor.service_category, vendor.provider_type)
    : 'general');

  const adjustedWeights = applyArchetypeWeights(categoryWeights, vendorArchetype);

  if (autoCriticalRules && autoCriticalRules.length > 0) {
    const ruleMatch = checkAutoCriticalRules(autoCriticalRules, assessment, vendor);
    if (ruleMatch) {
      return {
        tier: 'tier_5_critical',
        is_auto_critical: true,
        auto_critical_rule_id: ruleMatch.rule_id,
        auto_critical_rule_name: ruleMatch.rule_name,
        auto_critical_matched_conditions: ruleMatch.matched_conditions,
        impact_score: 5.0,
        likelihood_score: 5.0,
        risk_rating: 25.0,
        reason: `Auto-critical triggered by rule: ${ruleMatch.rule_name}`,
        vendor_archetype: vendorArchetype,
      };
    }
  }

  if (assessment.q15_supports_essential_operations === 'yes_disruption_stops_operations') {
    return {
      tier: 'tier_5_critical',
      is_auto_critical: true,
      auto_critical_rule_name: 'Essential Operations (Built-in)',
      auto_critical_matched_conditions: ['Supports essential banking operations - disruption would stop operations'],
      impact_score: 5.0,
      likelihood_score: 5.0,
      risk_rating: 25.0,
      reason: 'Auto-critical: Supports essential banking operations',
      vendor_archetype: vendorArchetype,
    };
  }

  const q15Score = criticalityMap[assessment.q15_supports_essential_operations || ''] || 1;
  const q16Score = getScore(assessment.q16_essential_to_business);
  const q17Score = getScore(assessment.q17_failure_impact);
  const criticalityScore = (q15Score + q16Score + q17Score) / 3;

  if (criticalityScore >= 4.5) {
    return {
      tier: 'tier_5_critical',
      is_auto_critical: true,
      auto_critical_rule_name: 'High Criticality Score (Built-in)',
      auto_critical_matched_conditions: [`Criticality score (${criticalityScore.toFixed(2)}) >= 4.5`],
      criticality_score: criticalityScore,
      impact_score: 5.0,
      likelihood_score: criticalityScore,
      risk_rating: 25.0,
      reason: 'Auto-critical: Criticality score >= 4.5',
      vendor_archetype: vendorArchetype,
    };
  }

  const productScore = getScore(assessment.q26_replacement_complexity);
  const dependencyScore = getScore(assessment.q22_dependency_level);

  const financialScore =
    (getScore(assessment.q24_total_financial_input) +
      getScore(assessment.q25_operational_effort) +
      getScore(assessment.q27_disruption_downtime)) / 3;

  const strategicScore =
    (getScore(assessment.q28_reputational_impact) +
      getScore(assessment.q29_public_association)) / 2;

  const dataScore =
    (getScore(assessment.q31_data_sensitivity) +
      getScore(assessment.q32_cybersecurity_risk)) / 2;

  const impactScore =
    adjustedWeights.weight_criticality * criticalityScore +
    adjustedWeights.weight_product_type * productScore +
    adjustedWeights.weight_dependency * dependencyScore +
    adjustedWeights.weight_financial_resilience * financialScore +
    adjustedWeights.weight_strategic_reputational * strategicScore +
    adjustedWeights.weight_data_sensitivity * dataScore;

  const concentrationScore =
    (getScore(assessment.q33_provider_availability) +
      getScore(assessment.q34_services_relied_on)) / 2;

  const accessScore =
    (getScore(assessment.q36_system_access_level) +
      getScore(assessment.q37_sensitive_data_access)) / 2;

  let subcontractorScore = 1;
  if (assessment.q38_uses_subcontractors) {
    const oversightScore = 6 - getScore(assessment.q39_subcontractor_oversight);
    const subAccessScore = getScore(assessment.q40_subcontractor_access);
    subcontractorScore = (oversightScore + subAccessScore) / 2;
  }

  const legalScore =
    (getScore(assessment.q41_regulatory_oversight) +
      getScore(assessment.q42_non_compliance_consequences) +
      getScore(assessment.q43_fraud_misconduct_history)) / 3;

  const maturityScore =
    ((6 - getScore(assessment.q44_operational_maturity)) +
      (6 - getScore(assessment.q45_reliability_track_record))) / 2;

  const otherRisksScore =
    (getScore(assessment.q46_geopolitical_risk) +
      getScore(assessment.q47_negative_coverage) +
      getScore(assessment.q48_esg_concerns)) / 3;

  const likelihoodScore =
    adjustedWeights.weight_concentration * concentrationScore +
    adjustedWeights.weight_access_level * accessScore +
    adjustedWeights.weight_subcontractor * subcontractorScore +
    adjustedWeights.weight_legal_regulatory * legalScore +
    adjustedWeights.weight_operational_maturity * maturityScore +
    adjustedWeights.weight_other_risks * otherRisksScore;

  const exitStrategyScore = calculateExitStrategyScore(assessment);
  const bcpScore = calculateBCPScore(assessment);
  const incidentResponseScore = calculateIncidentResponseScore(assessment);
  const auditRightsScore = calculateAuditRightsScore(assessment);
  const financialViabilityScore = calculateFinancialViabilityScore(assessment);
  const insuranceScore = calculateInsuranceScore(assessment);

  let osfiAdjustment = 0;
  let osfiFactorCount = 0;

  if (exitStrategyScore > 0) {
    osfiAdjustment += (exitStrategyScore - 3) * osfi.exit_strategy_weight;
    osfiFactorCount++;
  }
  if (bcpScore > 0) {
    osfiAdjustment += (bcpScore - 3) * osfi.bcp_weight;
    osfiFactorCount++;
  }
  if (incidentResponseScore > 0) {
    osfiAdjustment += (incidentResponseScore - 3) * osfi.incident_response_weight;
    osfiFactorCount++;
  }
  if (auditRightsScore > 0) {
    osfiAdjustment += (auditRightsScore - 3) * osfi.audit_rights_weight;
    osfiFactorCount++;
  }
  if (financialViabilityScore > 0) {
    osfiAdjustment += (financialViabilityScore - 3) * osfi.financial_viability_weight;
    osfiFactorCount++;
  }
  if (insuranceScore > 0) {
    osfiAdjustment += (insuranceScore - 3) * osfi.insurance_weight;
    osfiFactorCount++;
  }

  if (osfiFactorCount > 0) {
    osfiAdjustment /= osfiFactorCount;
  }

  const adjustedLikelihoodScore = Math.max(1, Math.min(5, likelihoodScore + osfiAdjustment));
  const riskRating = impactScore * adjustedLikelihoodScore;

  let tier: TierLevel;
  if (riskRating >= thresholds.tier_5_critical) {
    tier = 'tier_5_critical';
  } else if (riskRating >= thresholds.tier_4_high) {
    tier = 'tier_4_high';
  } else if (riskRating >= thresholds.tier_3_moderate) {
    tier = 'tier_3_moderate';
  } else if (riskRating >= thresholds.tier_2_low) {
    tier = 'tier_2_low';
  } else {
    tier = 'tier_1_informational';
  }

  return {
    tier,
    is_auto_critical: false,
    criticality_score: Math.round(criticalityScore * 100) / 100,
    impact_score: Math.round(impactScore * 100) / 100,
    likelihood_score: Math.round(adjustedLikelihoodScore * 100) / 100,
    risk_rating: Math.round(riskRating * 100) / 100,
    exit_strategy_score: exitStrategyScore > 0 ? Math.round(exitStrategyScore * 100) / 100 : undefined,
    bcp_score: bcpScore > 0 ? Math.round(bcpScore * 100) / 100 : undefined,
    incident_response_score: incidentResponseScore > 0 ? Math.round(incidentResponseScore * 100) / 100 : undefined,
    audit_rights_score: auditRightsScore > 0 ? Math.round(auditRightsScore * 100) / 100 : undefined,
    financial_viability_score: financialViabilityScore > 0 ? Math.round(financialViabilityScore * 100) / 100 : undefined,
    insurance_score: insuranceScore > 0 ? Math.round(insuranceScore * 100) / 100 : undefined,
    vendor_archetype: vendorArchetype,
    score_breakdown: {
      impact: {
        criticality: Math.round(criticalityScore * 100) / 100,
        product: productScore,
        dependency: dependencyScore,
        financial: Math.round(financialScore * 100) / 100,
        strategic: Math.round(strategicScore * 100) / 100,
        data: Math.round(dataScore * 100) / 100,
      },
      likelihood: {
        concentration: Math.round(concentrationScore * 100) / 100,
        access: Math.round(accessScore * 100) / 100,
        subcontractor: Math.round(subcontractorScore * 100) / 100,
        legal: Math.round(legalScore * 100) / 100,
        maturity: Math.round(maturityScore * 100) / 100,
        other_risks: Math.round(otherRisksScore * 100) / 100,
      },
      osfiCompliance: {
        exit_strategy: Math.round((exitStrategyScore || 0) * 100) / 100,
        bcp: Math.round((bcpScore || 0) * 100) / 100,
        incident_response: Math.round((incidentResponseScore || 0) * 100) / 100,
        audit_rights: Math.round((auditRightsScore || 0) * 100) / 100,
        financial_viability: Math.round((financialViabilityScore || 0) * 100) / 100,
        insurance: Math.round((insuranceScore || 0) * 100) / 100,
      },
    },
  };
}

export function getRiskMatrixPosition(
  impactScore: number,
  likelihoodScore: number
): { row: number; col: number } {
  const impactRow = Math.min(5, Math.max(1, Math.round(impactScore)));
  const likelihoodCol = Math.min(5, Math.max(1, Math.round(likelihoodScore)));
  return { row: impactRow, col: likelihoodCol };
}

export function getNextReviewDate(
  tier: TierLevel,
  fromDate: Date = new Date(),
  orgTierConfig?: OrganizationTierConfig[]
): Date | null {
  let reviewDays: number | null = null;

  if (orgTierConfig) {
    const orgConfig = orgTierConfig.find(c => c.tier_level === tier);
    reviewDays = orgConfig?.review_frequency_days ?? null;
  } else {
    const config = tierConfig[tier];
    reviewDays = config.reviewDays;
  }

  if (!reviewDays) return null;

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + reviewDays);
  return nextDate;
}

export function convertOrgTierConfigToThresholds(
  orgConfig: OrganizationTierConfig[]
): Record<TierLevel, number> {
  const thresholds = { ...DEFAULT_TIER_THRESHOLDS };

  for (const config of orgConfig) {
    if (config.tier_level in thresholds) {
      thresholds[config.tier_level] = config.min_risk_score;
    }
  }

  return thresholds;
}

export function getContractCompliancePercentage(contract: Record<string, unknown>): number {
  const provisions = [
    'has_scope_definition',
    'has_roles_responsibilities',
    'has_subcontractor_provisions',
    'has_pricing_terms',
    'has_performance_measures',
    'has_ownership_access',
    'has_data_security',
    'has_notification_requirements',
    'has_dispute_resolution',
    'has_regulatory_compliance',
    'has_bcp_requirements',
    'has_termination_provisions',
    'has_insurance_requirements',
    'has_audit_rights',
    'has_osfi_access_clause',
  ];

  const totalProvisions = provisions.length;
  const completedProvisions = provisions.filter((p) => contract[p] === true).length;

  return Math.round((completedProvisions / totalProvisions) * 100);
}

export function calculateRiskScores(
  answers: Record<string, unknown>,
  _averageScore: number,
  vendor?: Partial<Vendor>,
  archetype?: VendorArchetype,
  tierThresholds?: Record<TierLevel, number>,
  osfiWeights?: OrganizationOSFIWeights,
  autoCriticalRules?: AutoCriticalRule[]
) {
  const defaultWeights: CategoryWeights = {
    weight_criticality: 0.25,
    weight_product_type: 0.10,
    weight_dependency: 0.15,
    weight_financial_resilience: 0.10,
    weight_strategic_reputational: 0.15,
    weight_data_sensitivity: 0.15,
    weight_concentration: 0.10,
    weight_access_level: 0.15,
    weight_subcontractor: 0.10,
    weight_legal_regulatory: 0.10,
    weight_operational_maturity: 0.15,
    weight_other_risks: 0.10,
  } as CategoryWeights;

  const result = calculateTierAssessment(
    answers as Partial<TieringAssessment>,
    vendor || {},
    defaultWeights,
    archetype,
    tierThresholds,
    osfiWeights,
    autoCriticalRules
  );

  return {
    calculated_tier: result.tier,
    criticality_score: result.criticality_score,
    impact_score: result.impact_score,
    likelihood_score: result.likelihood_score,
    risk_rating: result.risk_rating,
    is_auto_critical: result.is_auto_critical,
    exit_strategy_score: result.exit_strategy_score,
    bcp_score: result.bcp_score,
    incident_response_score: result.incident_response_score,
    audit_rights_score: result.audit_rights_score,
    financial_viability_score: result.financial_viability_score,
    insurance_score: result.insurance_score,
    vendor_archetype: result.vendor_archetype,
  };
}

export function getOSFIComplianceGaps(assessment: Partial<TieringAssessment>): string[] {
  const gaps: string[] = [];

  if (!assessment.q27b_exit_plan_documented || assessment.q27b_exit_plan_documented === 'none') {
    gaps.push('Missing documented exit/transition plan (B-10 4.4)');
  }

  if (!assessment.q27f_bcp_documented || assessment.q27f_bcp_documented === 'none') {
    gaps.push('Missing documented Business Continuity Plan (B-10 4.3)');
  }

  if (!assessment.q32b_incident_response_plan || assessment.q32b_incident_response_plan === 'none') {
    gaps.push('Missing incident response plan (B-10 4.2)');
  }

  if (!assessment.q43b_audit_rights || assessment.q43b_audit_rights === 'none') {
    gaps.push('No audit rights specified in contract (B-10 5.2)');
  }

  if (!assessment.q43c_osfi_access || assessment.q43c_osfi_access === 'none' || assessment.q43c_osfi_access === 'refused') {
    gaps.push('Missing OSFI access clause (B-10 5.2)');
  }

  if (!assessment.q53e_indemnification || assessment.q53e_indemnification === 'none') {
    gaps.push('No indemnification provisions in contract (B-10 5.3)');
  }

  return gaps;
}

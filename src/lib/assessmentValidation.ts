import { TierLevel, tierConfig } from './riskCalculations';
import { extractScoreFromValue } from './assessmentColumnMapping';

export { extractScoreFromValue };

export interface OnboardingAssessmentData {
  q14_customer_facing?: number;
  q15_supports_essential_operations?: string;
  q16_essential_to_business?: string;
  q17_failure_impact?: string;
  q18_product_service_types?: string[];
  q19_service_description?: string;
  q20_service_recipient?: string;
  q21_provider_type?: string;
  q22_dependency_level?: string;
  q23_contract_value_cad?: number;
  q24_total_financial_input?: string;
  q25_operational_effort?: string;
  q26_replacement_complexity?: string;
  q27_disruption_downtime?: string;
  q28_reputational_impact?: string;
  q29_public_association?: string;
  q30_has_system_access?: boolean;
  q31_data_sensitivity?: string;
  q32_cybersecurity_risk?: string;
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
  q44_operational_maturity?: string;
  q45_reliability_track_record?: string;
  q46_geopolitical_risk?: string;
  q47_negative_coverage?: string;
  q48_esg_concerns?: string;
  q49_child_labor_verification?: string;
  q50_has_formal_contract?: boolean;
  q51_contract_type?: string;
  q52_contract_duration?: string;
  q53_requires_formal_contract?: boolean;
  calculated_criticality_score?: number;
  calculated_impact_score?: number;
  calculated_likelihood_score?: number;
  calculated_risk_rating?: number;
  calculated_tier?: string;
  is_auto_critical?: boolean;
  auto_critical_rule_name?: string;
  assessment_completed?: boolean;
  assessment_completed_at?: string;
  assessment_completed_by?: string;
  assessment_validated?: boolean;
  assessment_validated_by?: string;
  assessment_validated_at?: string;
  validated_tier?: string;
  tier_adjustment_reason?: string;
  due_diligence_requirements?: string[];
  due_diligence_level?: string;
  [key: string]: unknown;
}

export interface AssessmentDisplaySection {
  id: string;
  title: string;
  description?: string;
  questions: AssessmentDisplayQuestion[];
}

export interface AssessmentDisplayQuestion {
  id: string;
  label: string;
  fieldKey: keyof OnboardingAssessmentData;
  type: 'score' | 'text' | 'array' | 'boolean';
  scoreLabels?: Record<number, string>;
}

export const TIER_DISPLAY_CONFIG: Record<string, { label: string; color: string; bgClass: string }> = {
  tier_5_critical: { label: 'Critical (Tier 5)', color: 'red', bgClass: 'bg-red-100 text-red-800' },
  tier_4_high: { label: 'High (Tier 4)', color: 'orange', bgClass: 'bg-orange-100 text-orange-800' },
  tier_3_moderate: { label: 'Moderate (Tier 3)', color: 'amber', bgClass: 'bg-amber-100 text-amber-800' },
  tier_2_low: { label: 'Low (Tier 2)', color: 'emerald', bgClass: 'bg-emerald-100 text-emerald-800' },
  tier_1_informational: { label: 'Informational (Tier 1)', color: 'slate', bgClass: 'bg-slate-100 text-slate-600' },
};

export const DUE_DILIGENCE_OPTIONS = [
  { id: 'soc2_report', label: 'SOC 2 Type II Report', tier: ['tier_5_critical', 'tier_4_high'] },
  { id: 'security_questionnaire', label: 'Security Questionnaire (SIG Lite)', tier: ['tier_5_critical', 'tier_4_high', 'tier_3_moderate'] },
  { id: 'sig_core', label: 'Full SIG Core Assessment', tier: ['tier_5_critical'] },
  { id: 'on_site_assessment', label: 'On-site Assessment', tier: ['tier_5_critical'] },
  { id: 'financial_statements', label: 'Financial Statement Review', tier: ['tier_5_critical', 'tier_4_high'] },
  { id: 'penetration_test', label: 'Penetration Test Results', tier: ['tier_5_critical'] },
  { id: 'bcp_plan', label: 'Business Continuity Plan', tier: ['tier_5_critical', 'tier_4_high'] },
  { id: 'insurance_certificates', label: 'Insurance Certificate Review', tier: ['tier_5_critical', 'tier_4_high', 'tier_3_moderate'] },
  { id: 'disaster_recovery', label: 'Disaster Recovery Plan', tier: ['tier_5_critical'] },
  { id: 'regulatory_attestation', label: 'Regulatory Compliance Attestation', tier: ['tier_5_critical', 'tier_4_high'] },
  { id: 'reference_checks', label: 'Reference Checks', tier: ['tier_5_critical', 'tier_4_high', 'tier_3_moderate'] },
  { id: 'basic_vendor_info', label: 'Basic Vendor Information', tier: ['tier_2_low', 'tier_1_informational'] },
];

export function getDefaultDueDiligence(tier: string): string[] {
  return DUE_DILIGENCE_OPTIONS
    .filter(opt => opt.tier.includes(tier))
    .map(opt => opt.id);
}

export function calculateNextReviewDateFromTier(
  tier: string,
  fromDate: Date = new Date()
): string | null {
  const tierLevel = tier as TierLevel;
  const config = tierConfig[tierLevel];
  if (!config || !config.reviewDays) return null;

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + config.reviewDays);
  return nextDate.toISOString().split('T')[0];
}

export function extractAssessmentFieldsForVendor(
  request: OnboardingAssessmentData
): Record<string, unknown> {
  return {
    q15_supports_essential_operations: request.q15_supports_essential_operations ?? null,
    q16_essential_to_business: request.q16_essential_to_business ?? null,
    q17_failure_impact: request.q17_failure_impact ?? null,
    q22_dependency_level: request.q22_dependency_level ?? null,
    q24_total_financial_input: request.q24_total_financial_input ?? null,
    q25_operational_effort: request.q25_operational_effort ?? null,
    q26_replacement_complexity: request.q26_replacement_complexity ?? null,
    q27_disruption_downtime: request.q27_disruption_downtime ?? null,
    q28_reputational_impact: request.q28_reputational_impact ?? null,
    q29_public_association: request.q29_public_association ?? null,
    q31_data_sensitivity: request.q31_data_sensitivity ?? null,
    q32_cybersecurity_risk: request.q32_cybersecurity_risk ?? null,
    q33_provider_availability: request.q33_provider_availability ?? null,
    q34_services_relied_on: request.q34_services_relied_on ?? null,
    q36_system_access_level: request.q36_system_access_level ?? null,
    q37_sensitive_data_access: request.q37_sensitive_data_access ?? null,
    q38_uses_subcontractors: request.q38_uses_subcontractors ?? false,
    q39_subcontractor_oversight: request.q39_subcontractor_oversight ?? null,
    q41_regulatory_oversight: request.q41_regulatory_oversight ?? null,
    q42_non_compliance_consequences: request.q42_non_compliance_consequences ?? null,
    q43_fraud_misconduct_history: request.q43_fraud_misconduct_history ?? null,
    q44_operational_maturity: request.q44_operational_maturity ?? null,
    q45_reliability_track_record: request.q45_reliability_track_record ?? null,
    q46_geopolitical_risk: request.q46_geopolitical_risk ?? null,
    q48_esg_concerns: request.q48_esg_concerns ?? null,
  };
}

export const ASSESSMENT_DISPLAY_SECTIONS: AssessmentDisplaySection[] = [
  {
    id: 'criticality',
    title: 'Criticality & Impact',
    description: 'Assessment of operational criticality and failure impact',
    questions: [
      {
        id: 'q15',
        label: 'Q15. Essential Operations',
        fieldKey: 'q15_supports_essential_operations',
        type: 'score',
        scoreLabels: {
          5: 'Critical - Disruption stops core operations',
          4: 'Critical to operations',
          3: 'Important but not critical',
          1: 'Supports non-critical activities',
        },
      },
      {
        id: 'q16',
        label: 'Q16. Business Essentiality',
        fieldKey: 'q16_essential_to_business',
        type: 'score',
        scoreLabels: {
          5: 'Essential and irreplaceable',
          4: 'Very important to operations',
          3: 'Important but replaceable',
          2: 'Supportive role',
          1: 'Not essential',
        },
      },
      {
        id: 'q17',
        label: 'Q17. Failure Impact',
        fieldKey: 'q17_failure_impact',
        type: 'score',
        scoreLabels: {
          5: 'Severe - Immediate operational disruption',
          4: 'Major - Significant disruption within hours',
          3: 'Moderate - Disruption within days',
          2: 'Minor - Limited disruption',
          1: 'Minimal - Negligible impact',
        },
      },
    ],
  },
  {
    id: 'dependency',
    title: 'Dependency & Substitutability',
    questions: [
      {
        id: 'q22',
        label: 'Q22. Dependency Level',
        fieldKey: 'q22_dependency_level',
        type: 'score',
        scoreLabels: {
          5: 'Sole source - No viable alternatives',
          4: 'Limited alternatives - Difficult to replace',
          3: 'Moderate alternatives - Could replace with effort',
          2: 'Many alternatives - Easy to replace',
          1: 'Easily replaceable - Abundant alternatives',
        },
      },
    ],
  },
  {
    id: 'financial',
    title: 'Financial & Operational Significance',
    questions: [
      {
        id: 'q24',
        label: 'Q24. Financial Exposure',
        fieldKey: 'q24_total_financial_input',
        type: 'score',
        scoreLabels: {
          5: 'Over 5% of total spend',
          4: '2-5% of total spend',
          3: '1-2% of total spend',
          2: '0.5-1% of total spend',
          1: 'Under 0.5% of total spend',
        },
      },
      {
        id: 'q25',
        label: 'Q25. Operational Effort',
        fieldKey: 'q25_operational_effort',
        type: 'score',
        scoreLabels: {
          4: 'Extensive - Multiple FTEs dedicated',
          3: 'Significant - 1+ FTE',
          2: 'Moderate - Part-time management',
          1: 'Minimal - Little ongoing management',
        },
      },
      {
        id: 'q26',
        label: 'Q26. Replacement Complexity',
        fieldKey: 'q26_replacement_complexity',
        type: 'score',
        scoreLabels: {
          5: 'Extremely complex - 12+ months',
          4: 'Very complex - 6-12 months',
          3: 'Moderately complex - 3-6 months',
          2: 'Somewhat complex - 1-3 months',
          1: 'Simple - Less than 1 month',
        },
      },
      {
        id: 'q27',
        label: 'Q27. Disruption Tolerance',
        fieldKey: 'q27_disruption_downtime',
        type: 'score',
        scoreLabels: {
          5: 'Zero tolerance - Requires 24/7 availability',
          4: 'Less than 1 hour',
          3: '1-4 hours',
          2: '4-24 hours',
          1: 'More than 1 day',
        },
      },
    ],
  },
  {
    id: 'reputational',
    title: 'Strategic & Reputational Risk',
    questions: [
      {
        id: 'q28',
        label: 'Q28. Reputational Impact',
        fieldKey: 'q28_reputational_impact',
        type: 'score',
        scoreLabels: {
          5: 'Severe - Major public/media attention likely',
          4: 'Major - Significant reputational damage',
          3: 'Moderate - Some reputational concern',
          2: 'Minor - Limited reputational impact',
          1: 'Minimal - No significant impact',
        },
      },
      {
        id: 'q29',
        label: 'Q29. Public Association',
        fieldKey: 'q29_public_association',
        type: 'score',
        scoreLabels: {
          5: 'Highly visible - Co-branded or public partnership',
          3: 'Visible - Known to customers/public',
          1: 'Not visible - Internal relationship only',
        },
      },
    ],
  },
  {
    id: 'data_cyber',
    title: 'Data Sensitivity & Cybersecurity',
    questions: [
      {
        id: 'q30',
        label: 'Q30. Has System Access',
        fieldKey: 'q30_has_system_access',
        type: 'boolean',
      },
      {
        id: 'q31',
        label: 'Q31. Data Sensitivity',
        fieldKey: 'q31_data_sensitivity',
        type: 'score',
        scoreLabels: {
          5: 'Highly sensitive - Customer PII, financial data',
          4: 'Sensitive - Internal confidential data',
          3: 'Internal - Non-confidential internal data',
          1: 'Public - No sensitive data',
        },
      },
      {
        id: 'q32',
        label: 'Q32. Cybersecurity Risk',
        fieldKey: 'q32_cybersecurity_risk',
        type: 'score',
        scoreLabels: {
          5: 'Critical - Direct access to critical systems',
          4: 'High - Access to important systems/data',
          3: 'Moderate - Limited system access',
          2: 'Low - Minimal system interaction',
          1: 'Minimal - No system access',
        },
      },
    ],
  },
  {
    id: 'concentration',
    title: 'Concentration Risk',
    questions: [
      {
        id: 'q33',
        label: 'Q33. Provider Availability',
        fieldKey: 'q33_provider_availability',
        type: 'score',
        scoreLabels: {
          5: 'Sole provider - No alternatives',
          4: 'Very few (1-2 alternatives)',
          3: 'Limited (3-5 alternatives)',
          2: 'Several (6-10 alternatives)',
          1: 'Many (10+ alternatives)',
        },
      },
      {
        id: 'q34',
        label: 'Q34. Services Relied On',
        fieldKey: 'q34_services_relied_on',
        type: 'score',
        scoreLabels: {
          5: 'All or nearly all services',
          4: 'Majority of services (>50%)',
          3: 'Several key services (25-50%)',
          2: 'Few services (<25%)',
          1: 'Single service or product line',
        },
      },
    ],
  },
  {
    id: 'access_location',
    title: 'Access Level & Data Location',
    questions: [
      {
        id: 'q35',
        label: 'Q35. Data Location',
        fieldKey: 'q35_data_access_location',
        type: 'score',
        scoreLabels: {
          5: 'Non-equivalent jurisdiction with weak privacy laws',
          4: 'Multiple jurisdictions including non-equivalent',
          2: 'Foreign but equivalent jurisdiction',
          1: 'Canada only',
        },
      },
      {
        id: 'q36',
        label: 'Q36. System Access Level',
        fieldKey: 'q36_system_access_level',
        type: 'score',
        scoreLabels: {
          5: 'Administrative/Privileged access',
          4: 'Read and write access',
          3: 'Read-only access',
          2: 'Limited/restricted access',
          1: 'No direct system access',
        },
      },
      {
        id: 'q37',
        label: 'Q37. Sensitive Data Access',
        fieldKey: 'q37_sensitive_data_access',
        type: 'score',
        scoreLabels: {
          5: 'Full customer data including financial details',
          4: 'Limited customer data',
          2: 'Aggregated/anonymized data only',
          1: 'No customer or sensitive data',
        },
      },
    ],
  },
  {
    id: 'subcontractors',
    title: 'Subcontractors & Fourth Parties',
    questions: [
      {
        id: 'q38',
        label: 'Q38. Uses Subcontractors',
        fieldKey: 'q38_uses_subcontractors',
        type: 'boolean',
      },
      {
        id: 'q39',
        label: 'Q39. Subcontractor Oversight',
        fieldKey: 'q39_subcontractor_oversight',
        type: 'score',
        scoreLabels: {
          5: 'None - No visibility or control',
          4: 'Minimal - Limited information',
          3: 'Moderate - Some oversight mechanisms',
          2: 'Significant - Regular monitoring',
          1: 'Comprehensive - Full visibility and approval rights',
        },
      },
      {
        id: 'q40',
        label: 'Q40. Subcontractor Data Access',
        fieldKey: 'q40_subcontractor_access',
        type: 'score',
        scoreLabels: {
          5: 'Direct access to sensitive data',
          4: 'Unknown access',
          3: 'Indirect access through third party',
          1: 'No access',
        },
      },
    ],
  },
  {
    id: 'regulatory',
    title: 'Legal & Regulatory Risk',
    questions: [
      {
        id: 'q41',
        label: 'Q41. Regulatory Oversight',
        fieldKey: 'q41_regulatory_oversight',
        type: 'score',
        scoreLabels: {
          4: 'No regulatory oversight',
          3: 'Limited or foreign oversight',
          2: 'Canadian provincial oversight',
          1: 'Canadian federal oversight (OSFI, etc.)',
        },
      },
      {
        id: 'q42',
        label: 'Q42. Non-Compliance Consequences',
        fieldKey: 'q42_non_compliance_consequences',
        type: 'score',
        scoreLabels: {
          5: 'Severe - Regulatory sanctions, license risk',
          4: 'Major - Significant penalties likely',
          3: 'Moderate - Some regulatory concern',
          2: 'Minor - Limited regulatory impact',
          1: 'Minimal - No regulatory impact',
        },
      },
      {
        id: 'q43',
        label: 'Q43. Fraud/Misconduct History',
        fieldKey: 'q43_fraud_misconduct_history',
        type: 'score',
        scoreLabels: {
          5: 'Significant history of issues',
          3: 'Some past issues',
          1: 'No known issues',
        },
      },
    ],
  },
  {
    id: 'maturity',
    title: 'Operational Maturity',
    questions: [
      {
        id: 'q44',
        label: 'Q44. Operational Maturity',
        fieldKey: 'q44_operational_maturity',
        type: 'score',
        scoreLabels: {
          4: 'Startup - Less than 2 years, unproven',
          3: 'Emerging - 2-5 years, developing track record',
          2: 'Established - 5-10 years, proven capabilities',
          1: 'Mature - 10+ years, industry leader',
        },
      },
      {
        id: 'q45',
        label: 'Q45. Reliability Track Record',
        fieldKey: 'q45_reliability_track_record',
        type: 'score',
        scoreLabels: {
          5: 'Poor - Frequent issues and service disruptions',
          3: 'Fair - Occasional issues',
          2: 'Good - Reliable with rare issues',
          1: 'Excellent - Consistently reliable',
        },
      },
    ],
  },
  {
    id: 'geopolitical',
    title: 'Geographic & ESG Risk',
    questions: [
      {
        id: 'q46',
        label: 'Q46. Geopolitical Risk',
        fieldKey: 'q46_geopolitical_risk',
        type: 'score',
        scoreLabels: {
          5: 'High risk - Sanctions, instability concerns',
          3: 'Moderate risk - Some concerns',
          1: 'Low risk - Stable jurisdiction',
        },
      },
      {
        id: 'q48',
        label: 'Q48. ESG Concerns',
        fieldKey: 'q48_esg_concerns',
        type: 'score',
        scoreLabels: {
          4: 'Significant ESG concerns identified',
          3: 'Moderate concerns',
          2: 'Minor concerns',
          1: 'No known ESG concerns',
        },
      },
    ],
  },
  {
    id: 'contract',
    title: 'Contract Information',
    questions: [
      {
        id: 'q50',
        label: 'Q50. Has Formal Contract',
        fieldKey: 'q50_has_formal_contract',
        type: 'boolean',
      },
      {
        id: 'q52',
        label: 'Q52. Contract Duration',
        fieldKey: 'q52_contract_duration',
        type: 'text',
      },
      {
        id: 'q53',
        label: 'Q53. Requires Formal Contract',
        fieldKey: 'q53_requires_formal_contract',
        type: 'boolean',
      },
    ],
  },
];

export function getAssessmentCompletionStats(data: OnboardingAssessmentData): {
  total: number;
  answered: number;
  percentage: number;
} {
  const questionFields: (keyof OnboardingAssessmentData)[] = [
    'q15_supports_essential_operations', 'q16_essential_to_business', 'q17_failure_impact',
    'q22_dependency_level', 'q24_total_financial_input', 'q25_operational_effort',
    'q26_replacement_complexity', 'q27_disruption_downtime', 'q28_reputational_impact',
    'q29_public_association', 'q30_has_system_access', 'q31_data_sensitivity',
    'q32_cybersecurity_risk', 'q33_provider_availability', 'q34_services_relied_on',
    'q35_data_access_location', 'q36_system_access_level', 'q37_sensitive_data_access',
    'q38_uses_subcontractors', 'q41_regulatory_oversight', 'q42_non_compliance_consequences',
    'q43_fraud_misconduct_history', 'q44_operational_maturity', 'q45_reliability_track_record',
    'q46_geopolitical_risk', 'q48_esg_concerns', 'q50_has_formal_contract',
    'q52_contract_duration', 'q53_requires_formal_contract',
  ];

  const total = questionFields.length;
  const answered = questionFields.filter(field => {
    const val = data[field];
    return val !== undefined && val !== null && val !== '';
  }).length;
  const percentage = Math.round((answered / total) * 100);

  return { total, answered, percentage };
}

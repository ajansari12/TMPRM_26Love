import { assessmentSections } from './assessmentQuestions';

export const VALID_QUESTION_IDS = new Set(
  assessmentSections.flatMap((s) => s.questions.map((q) => q.id))
);

export const OLD_TO_NEW_COLUMN_MAP: Record<string, string> = {
  q15_operational_impact: 'q15_supports_essential_operations',
  q16_business_essential: 'q16_essential_to_business',
  q22_substitutability: 'q22_dependency_level',
  q24_financial_exposure: 'q24_total_financial_input',
  q27_disruption_tolerance: 'q27_disruption_downtime',
  q33_market_concentration: 'q33_provider_availability',
  q34_service_bundling: 'q34_services_relied_on',
  q35_data_location: 'q35_data_access_location',
  q36_remote_access: 'q36_system_access_level',
  q37_privileged_access: 'q37_sensitive_data_access',
  q40_subcontractor_data_access: 'q40_subcontractor_access',
  q41_regulatory_requirements: 'q41_regulatory_oversight',
  q42_compliance_history: 'q42_non_compliance_consequences',
  q43_litigation_risk: 'q43_fraud_misconduct_history',
  q44_vendor_maturity: 'q44_operational_maturity',
  q45_performance_history: 'q45_reliability_track_record',
  q46_geographic_risk: 'q46_geopolitical_risk',
  q47_political_stability: 'q47_negative_coverage',
  q48_esg_risk: 'q48_esg_concerns',
  q49_sanctions_exposure: 'q49_child_labor_verification',
  q51_contract_terms: 'q51_contract_type',
  q52_exit_provisions: 'q52_contract_duration',
};

export const OLD_SCORE_TO_BOOLEAN_MAP: Record<string, (score: number) => boolean> = {
  q30_system_access_level: (score) => score >= 2,
  q38_subcontractor_use: (score) => score >= 2,
  q50_contract_formality: (score) => score < 5,
};

export const NEW_BOOLEAN_COLUMN_MAP: Record<string, string> = {
  q30_system_access_level: 'q30_has_system_access',
  q38_subcontractor_use: 'q38_uses_subcontractors',
  q50_contract_formality: 'q50_has_formal_contract',
};

export function extractScoreFromValue(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d+)/);
    if (match) return parseInt(match[1], 10);
    if (value === 'yes_disruption_stops_operations') return 5;
    if (value === 'yes_critical') return 4;
    if (value === 'yes_important') return 3;
    if (value === 'no') return 1;
  }
  return null;
}

export function loadAssessmentAnswersFromRow(
  data: Record<string, unknown>
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  Object.keys(data).forEach((key) => {
    if (VALID_QUESTION_IDS.has(key) && data[key] !== null && data[key] !== undefined) {
      answers[key] = data[key];
    }
  });

  Object.entries(OLD_TO_NEW_COLUMN_MAP).forEach(([oldKey, newKey]) => {
    if (answers[newKey] !== undefined) return;
    const oldValue = data[oldKey];
    if (oldValue === null || oldValue === undefined) return;

    if (typeof oldValue === 'number') {
      const question = assessmentSections
        .flatMap((s) => s.questions)
        .find((q) => q.id === newKey);
      if (question?.options) {
        const matchingOption = question.options.find((opt) => opt.score === oldValue);
        if (matchingOption) {
          answers[newKey] = matchingOption.value;
          return;
        }
      }
      answers[newKey] = String(oldValue);
    } else {
      answers[newKey] = oldValue;
    }
  });

  Object.entries(NEW_BOOLEAN_COLUMN_MAP).forEach(([oldKey, newKey]) => {
    if (answers[newKey] !== undefined) return;
    const oldValue = data[oldKey];
    if (oldValue === null || oldValue === undefined) return;

    const converter = OLD_SCORE_TO_BOOLEAN_MAP[oldKey];
    if (converter && typeof oldValue === 'number') {
      answers[newKey] = converter(oldValue);
    }
  });

  const sameNameColumns = [
    'q17_failure_impact',
    'q25_operational_effort',
    'q26_replacement_complexity',
    'q28_reputational_impact',
    'q29_public_association',
    'q31_data_sensitivity',
    'q32_cybersecurity_risk',
    'q39_subcontractor_oversight',
  ];

  sameNameColumns.forEach((colName) => {
    const value = answers[colName];
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const score = parseInt(value, 10);
      const question = assessmentSections
        .flatMap((s) => s.questions)
        .find((q) => q.id === colName);
      if (question?.options) {
        const matchingOption = question.options.find((opt) => opt.score === score);
        if (matchingOption) {
          answers[colName] = matchingOption.value;
        }
      }
    }
  });

  return answers;
}

export function buildOldColumnPayload(
  assessmentAnswers: Record<string, unknown>
): Record<string, unknown> {
  const oldPayload: Record<string, unknown> = {};

  const reverseMap: Record<string, string> = {};
  Object.entries(OLD_TO_NEW_COLUMN_MAP).forEach(([oldKey, newKey]) => {
    reverseMap[newKey] = oldKey;
  });

  Object.entries(assessmentAnswers).forEach(([newKey, value]) => {
    const oldKey = reverseMap[newKey];
    if (oldKey) {
      const score = extractScoreFromValue(value);
      if (score !== null) {
        oldPayload[oldKey] = score;
      }
    }
  });

  if (assessmentAnswers.q30_has_system_access !== undefined) {
    oldPayload.q30_system_access_level = assessmentAnswers.q30_has_system_access ? 3 : 1;
  }
  if (assessmentAnswers.q38_uses_subcontractors !== undefined) {
    oldPayload.q38_subcontractor_use = assessmentAnswers.q38_uses_subcontractors ? 3 : 1;
  }
  if (assessmentAnswers.q50_has_formal_contract !== undefined) {
    oldPayload.q50_contract_formality = assessmentAnswers.q50_has_formal_contract ? 2 : 5;
  }

  const sameNameColumns = [
    'q17_failure_impact',
    'q25_operational_effort',
    'q26_replacement_complexity',
    'q28_reputational_impact',
    'q29_public_association',
    'q31_data_sensitivity',
    'q32_cybersecurity_risk',
    'q39_subcontractor_oversight',
  ];

  sameNameColumns.forEach((colName) => {
    if (colName in reverseMap) return;
    // same-name columns don't need old column backfill; they ARE the column
  });

  return oldPayload;
}

/*
  # Backfill New Assessment Columns from Old Data

  Populates the new assessment question columns (added in previous migration) from
  existing data stored in the old column names. This ensures existing onboarding
  requests display correctly in both the form and detail views.

  ## Changes

  1. Different-Name Columns (old integer -> new text)
    - Converts integer scores (1-5) to text option values matching the form schema
    - Examples: q15_operational_impact (int) -> q15_supports_essential_operations (text)
    - Only updates rows where the new column is NULL and old column has data

  2. Same-Name Columns (integer strings -> text option values)
    - Columns already converted from integer to text type now contain bare integers ("4", "5")
    - Converts these to proper option values ("4_major", "5_severe", etc.)
    - Only updates values that are bare single-digit strings

  3. Boolean Columns (old integer -> new boolean)
    - Derives boolean values from old integer scores
    - q30_has_system_access = true if old q30_system_access_level >= 2
    - q38_uses_subcontractors = true if old q38_subcontractor_use >= 2
    - q50_has_formal_contract = true if old q50_contract_formality < 5

  ## Important Notes
  - Only updates NULL new columns (won't overwrite data already in new format)
  - Old columns are preserved unchanged
  - Safe to run multiple times (idempotent)
*/

-- 1. Backfill different-name columns from old integer columns

UPDATE onboarding_requests
SET q15_supports_essential_operations = CASE q15_operational_impact
  WHEN 5 THEN 'yes_disruption_stops_operations'
  WHEN 4 THEN 'yes_critical'
  WHEN 3 THEN 'yes_important'
  WHEN 2 THEN 'no'
  WHEN 1 THEN 'no'
  END
WHERE q15_operational_impact IS NOT NULL AND q15_supports_essential_operations IS NULL;

UPDATE onboarding_requests
SET q16_essential_to_business = CASE q16_business_essential
  WHEN 5 THEN '5_essential'
  WHEN 4 THEN '4_very_important'
  WHEN 3 THEN '3_important'
  WHEN 2 THEN '2_supportive'
  WHEN 1 THEN '1_not_essential'
  END
WHERE q16_business_essential IS NOT NULL AND q16_essential_to_business IS NULL;

UPDATE onboarding_requests
SET q22_dependency_level = CASE q22_substitutability
  WHEN 5 THEN '5_sole_source'
  WHEN 4 THEN '4_limited'
  WHEN 3 THEN '3_moderate'
  WHEN 2 THEN '2_many'
  WHEN 1 THEN '1_abundant'
  END
WHERE q22_substitutability IS NOT NULL AND q22_dependency_level IS NULL;

UPDATE onboarding_requests
SET q24_total_financial_input = CASE q24_financial_exposure
  WHEN 5 THEN '5_over_5'
  WHEN 4 THEN '4_2_to_5'
  WHEN 3 THEN '3_1_to_2'
  WHEN 2 THEN '2_half_to_1'
  WHEN 1 THEN '1_under_half'
  END
WHERE q24_financial_exposure IS NOT NULL AND q24_total_financial_input IS NULL;

UPDATE onboarding_requests
SET q27_disruption_downtime = CASE q27_disruption_tolerance
  WHEN 5 THEN '5_zero'
  WHEN 4 THEN '4_hour'
  WHEN 3 THEN '3_4hours'
  WHEN 2 THEN '2_24hours'
  WHEN 1 THEN '1_day'
  END
WHERE q27_disruption_tolerance IS NOT NULL AND q27_disruption_downtime IS NULL;

UPDATE onboarding_requests
SET q33_provider_availability = CASE q33_market_concentration
  WHEN 5 THEN '5_sole'
  WHEN 4 THEN '4_very_few'
  WHEN 3 THEN '3_limited'
  WHEN 2 THEN '2_several'
  WHEN 1 THEN '1_many'
  END
WHERE q33_market_concentration IS NOT NULL AND q33_provider_availability IS NULL;

UPDATE onboarding_requests
SET q34_services_relied_on = CASE q34_service_bundling
  WHEN 5 THEN '5_all'
  WHEN 4 THEN '4_majority'
  WHEN 3 THEN '3_several'
  WHEN 2 THEN '2_few'
  WHEN 1 THEN '1_single'
  END
WHERE q34_service_bundling IS NOT NULL AND q34_services_relied_on IS NULL;

UPDATE onboarding_requests
SET q35_data_access_location = CASE q35_data_location
  WHEN 5 THEN '5_non_equivalent'
  WHEN 4 THEN '4_multiple'
  WHEN 3 THEN '3_mixed'
  WHEN 2 THEN '2_foreign_equivalent'
  WHEN 1 THEN '1_canada'
  END
WHERE q35_data_location IS NOT NULL AND q35_data_access_location IS NULL;

UPDATE onboarding_requests
SET q36_system_access_level = CASE q36_remote_access
  WHEN 5 THEN '5_admin'
  WHEN 4 THEN '4_read_write'
  WHEN 3 THEN '3_read_only'
  WHEN 2 THEN '2_limited'
  WHEN 1 THEN '1_none'
  END
WHERE q36_remote_access IS NOT NULL AND q36_system_access_level IS NULL;

UPDATE onboarding_requests
SET q37_sensitive_data_access = CASE q37_privileged_access
  WHEN 5 THEN '5_full'
  WHEN 4 THEN '4_limited'
  WHEN 3 THEN '3_moderate'
  WHEN 2 THEN '2_aggregated'
  WHEN 1 THEN '1_none'
  END
WHERE q37_privileged_access IS NOT NULL AND q37_sensitive_data_access IS NULL;

UPDATE onboarding_requests
SET q40_subcontractor_access = CASE q40_subcontractor_data_access
  WHEN 5 THEN '5_direct'
  WHEN 4 THEN '4_unknown'
  WHEN 3 THEN '3_indirect'
  WHEN 2 THEN '2_limited'
  WHEN 1 THEN '1_none'
  END
WHERE q40_subcontractor_data_access IS NOT NULL AND q40_subcontractor_access IS NULL;

UPDATE onboarding_requests
SET q41_regulatory_oversight = CASE q41_regulatory_requirements
  WHEN 5 THEN '4_none'
  WHEN 4 THEN '4_none'
  WHEN 3 THEN '3_limited'
  WHEN 2 THEN '2_provincial'
  WHEN 1 THEN '1_federal'
  END
WHERE q41_regulatory_requirements IS NOT NULL AND q41_regulatory_oversight IS NULL;

UPDATE onboarding_requests
SET q42_non_compliance_consequences = CASE q42_compliance_history
  WHEN 5 THEN '5_severe'
  WHEN 4 THEN '4_major'
  WHEN 3 THEN '3_moderate'
  WHEN 2 THEN '2_minor'
  WHEN 1 THEN '1_minimal'
  END
WHERE q42_compliance_history IS NOT NULL AND q42_non_compliance_consequences IS NULL;

UPDATE onboarding_requests
SET q43_fraud_misconduct_history = CASE q43_litigation_risk
  WHEN 5 THEN '5_significant'
  WHEN 4 THEN '5_significant'
  WHEN 3 THEN '3_some'
  WHEN 2 THEN '1_none'
  WHEN 1 THEN '1_none'
  END
WHERE q43_litigation_risk IS NOT NULL AND q43_fraud_misconduct_history IS NULL;

UPDATE onboarding_requests
SET q44_operational_maturity = CASE q44_vendor_maturity
  WHEN 5 THEN '4_startup'
  WHEN 4 THEN '4_startup'
  WHEN 3 THEN '3_emerging'
  WHEN 2 THEN '2_established'
  WHEN 1 THEN '1_mature'
  END
WHERE q44_vendor_maturity IS NOT NULL AND q44_operational_maturity IS NULL;

UPDATE onboarding_requests
SET q45_reliability_track_record = CASE q45_performance_history
  WHEN 5 THEN '5_poor'
  WHEN 4 THEN '5_poor'
  WHEN 3 THEN '3_fair'
  WHEN 2 THEN '2_good'
  WHEN 1 THEN '1_excellent'
  END
WHERE q45_performance_history IS NOT NULL AND q45_reliability_track_record IS NULL;

UPDATE onboarding_requests
SET q46_geopolitical_risk = CASE q46_geographic_risk
  WHEN 5 THEN '5_high'
  WHEN 4 THEN '5_high'
  WHEN 3 THEN '3_moderate'
  WHEN 2 THEN '1_low'
  WHEN 1 THEN '1_low'
  END
WHERE q46_geographic_risk IS NOT NULL AND q46_geopolitical_risk IS NULL;

UPDATE onboarding_requests
SET q47_negative_coverage = CASE q47_political_stability
  WHEN 5 THEN '4_significant'
  WHEN 4 THEN '4_significant'
  WHEN 3 THEN '3_some'
  WHEN 2 THEN '2_minor'
  WHEN 1 THEN '1_none'
  END
WHERE q47_political_stability IS NOT NULL AND q47_negative_coverage IS NULL;

UPDATE onboarding_requests
SET q48_esg_concerns = CASE q48_esg_risk
  WHEN 5 THEN '4_significant'
  WHEN 4 THEN '4_significant'
  WHEN 3 THEN '3_moderate'
  WHEN 2 THEN '2_minor'
  WHEN 1 THEN '1_none'
  END
WHERE q48_esg_risk IS NOT NULL AND q48_esg_concerns IS NULL;

UPDATE onboarding_requests
SET q49_child_labor_verification = CASE q49_sanctions_exposure
  WHEN 5 THEN '4_not_verified'
  WHEN 4 THEN '4_not_verified'
  WHEN 3 THEN '3_partial'
  WHEN 2 THEN '1_verified'
  WHEN 1 THEN '1_verified'
  END
WHERE q49_sanctions_exposure IS NOT NULL AND q49_child_labor_verification IS NULL;

UPDATE onboarding_requests
SET q51_contract_type = CASE q51_contract_terms
  WHEN 5 THEN '5_none'
  WHEN 4 THEN '4_basic'
  WHEN 3 THEN '3_standard'
  WHEN 2 THEN '2_comprehensive'
  WHEN 1 THEN '1_master'
  END
WHERE q51_contract_terms IS NOT NULL AND q51_contract_type IS NULL;

UPDATE onboarding_requests
SET q52_contract_duration = CASE q52_exit_provisions
  WHEN 5 THEN '5_over_5_years'
  WHEN 4 THEN '4_3_to_5_years'
  WHEN 3 THEN '3_1_to_3_years'
  WHEN 2 THEN '2_6_to_12_months'
  WHEN 1 THEN '1_under_6_months'
  END
WHERE q52_exit_provisions IS NOT NULL AND q52_contract_duration IS NULL;

-- 2. Convert same-name columns from bare integer strings to option values

UPDATE onboarding_requests
SET q17_failure_impact = CASE q17_failure_impact
  WHEN '5' THEN '5_severe'
  WHEN '4' THEN '4_major'
  WHEN '3' THEN '3_moderate'
  WHEN '2' THEN '2_minor'
  WHEN '1' THEN '1_minimal'
  ELSE q17_failure_impact
  END
WHERE q17_failure_impact IS NOT NULL AND q17_failure_impact ~ '^\d$';

UPDATE onboarding_requests
SET q25_operational_effort = CASE q25_operational_effort
  WHEN '4' THEN '4_extensive'
  WHEN '3' THEN '3_significant'
  WHEN '2' THEN '2_moderate'
  WHEN '1' THEN '1_minimal'
  ELSE q25_operational_effort
  END
WHERE q25_operational_effort IS NOT NULL AND q25_operational_effort ~ '^\d$';

UPDATE onboarding_requests
SET q26_replacement_complexity = CASE q26_replacement_complexity
  WHEN '5' THEN '5_extremely'
  WHEN '4' THEN '4_very'
  WHEN '3' THEN '3_moderately'
  WHEN '2' THEN '2_somewhat'
  WHEN '1' THEN '1_simple'
  ELSE q26_replacement_complexity
  END
WHERE q26_replacement_complexity IS NOT NULL AND q26_replacement_complexity ~ '^\d$';

UPDATE onboarding_requests
SET q28_reputational_impact = CASE q28_reputational_impact
  WHEN '5' THEN '5_severe'
  WHEN '4' THEN '4_major'
  WHEN '3' THEN '3_moderate'
  WHEN '2' THEN '2_minor'
  WHEN '1' THEN '1_minimal'
  ELSE q28_reputational_impact
  END
WHERE q28_reputational_impact IS NOT NULL AND q28_reputational_impact ~ '^\d$';

UPDATE onboarding_requests
SET q29_public_association = CASE q29_public_association
  WHEN '5' THEN '5_cobranded'
  WHEN '4' THEN '5_cobranded'
  WHEN '3' THEN '3_visible'
  WHEN '2' THEN '1_internal'
  WHEN '1' THEN '1_internal'
  ELSE q29_public_association
  END
WHERE q29_public_association IS NOT NULL AND q29_public_association ~ '^\d$';

UPDATE onboarding_requests
SET q31_data_sensitivity = CASE q31_data_sensitivity
  WHEN '5' THEN '5_highly_sensitive'
  WHEN '4' THEN '4_sensitive'
  WHEN '3' THEN '3_internal'
  WHEN '2' THEN '3_internal'
  WHEN '1' THEN '1_public'
  ELSE q31_data_sensitivity
  END
WHERE q31_data_sensitivity IS NOT NULL AND q31_data_sensitivity ~ '^\d$';

UPDATE onboarding_requests
SET q32_cybersecurity_risk = CASE q32_cybersecurity_risk
  WHEN '5' THEN '5_critical'
  WHEN '4' THEN '4_high'
  WHEN '3' THEN '3_moderate'
  WHEN '2' THEN '2_low'
  WHEN '1' THEN '1_minimal'
  ELSE q32_cybersecurity_risk
  END
WHERE q32_cybersecurity_risk IS NOT NULL AND q32_cybersecurity_risk ~ '^\d$';

UPDATE onboarding_requests
SET q39_subcontractor_oversight = CASE q39_subcontractor_oversight
  WHEN '5' THEN '5_none'
  WHEN '4' THEN '4_minimal'
  WHEN '3' THEN '3_moderate'
  WHEN '2' THEN '2_significant'
  WHEN '1' THEN '1_comprehensive'
  ELSE q39_subcontractor_oversight
  END
WHERE q39_subcontractor_oversight IS NOT NULL AND q39_subcontractor_oversight ~ '^\d$';

-- 3. Backfill boolean columns from old integer scores

UPDATE onboarding_requests
SET q30_has_system_access = (q30_system_access_level >= 2)
WHERE q30_system_access_level IS NOT NULL AND q30_has_system_access IS NULL;

UPDATE onboarding_requests
SET q38_uses_subcontractors = (q38_subcontractor_use >= 2)
WHERE q38_subcontractor_use IS NOT NULL AND q38_uses_subcontractors IS NULL;

UPDATE onboarding_requests
SET q50_has_formal_contract = (q50_contract_formality < 5)
WHERE q50_contract_formality IS NOT NULL AND q50_has_formal_contract IS NULL;

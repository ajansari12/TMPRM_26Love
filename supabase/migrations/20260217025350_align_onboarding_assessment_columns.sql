/*
  # Align Onboarding Request Assessment Columns with Application Code

  The `onboarding_requests` table had assessment question columns with names and types
  that did not match the application code's question IDs. The `tiering_assessments` table
  already had the correct column names and types. This migration aligns `onboarding_requests`
  to match.

  ## Problem
  - Code uses question IDs like `q15_supports_essential_operations` (text), but the DB had
    columns like `q15_operational_impact` (integer) -- different names AND types.
  - ~24 sub-question columns (q27b-q53e) used by the application were missing entirely.
  - This caused all assessment answer inserts/updates to fail.

  ## Changes

  1. Altered Columns (integer -> text)
    - `q17_failure_impact`, `q20_service_recipient`, `q25_operational_effort`,
      `q26_replacement_complexity`, `q28_reputational_impact`, `q29_public_association`,
      `q31_data_sensitivity`, `q32_cybersecurity_risk`, `q39_subcontractor_oversight`
    - These columns had matching names but wrong types (integer instead of text).
    - The application stores option values like '5_severe', '4_major', etc.

  2. New Text Columns (mismatched names -- old columns preserved)
    - `q15_supports_essential_operations`, `q16_essential_to_business`,
      `q22_dependency_level`, `q24_total_financial_input`, `q27_disruption_downtime`,
      `q33_provider_availability`, `q34_services_relied_on`, `q35_data_access_location`,
      `q36_system_access_level`, `q37_sensitive_data_access`, `q40_subcontractor_access`,
      `q41_regulatory_oversight`, `q42_non_compliance_consequences`,
      `q43_fraud_misconduct_history`, `q44_operational_maturity`,
      `q45_reliability_track_record`, `q46_geopolitical_risk`, `q47_negative_coverage`,
      `q48_esg_concerns`, `q49_child_labor_verification`, `q51_contract_type`,
      `q52_contract_duration`

  3. New Boolean Columns
    - `q30_has_system_access`, `q38_uses_subcontractors`, `q50_has_formal_contract`,
      `q53_requires_formal_contract`

  4. New Sub-Question Columns (entirely missing)
    - Exit strategy: `q27b` through `q27i`
    - Incident response: `q32b` through `q32e`
    - Audit rights: `q43b` through `q43e`
    - Financial viability: `q45b` through `q45e`
    - Insurance: `q53b` through `q53e`

  5. Type Fix
    - `preliminary_risk_score` changed from integer to numeric to accept decimal values

  ## Security
  - No changes to RLS policies (existing policies remain in effect)

  ## Important Notes
  - Old columns (e.g., `q15_operational_impact`) are NOT dropped to preserve any existing data
  - All new columns are nullable with no default (assessment answers are optional)
*/

-- 1. Alter existing columns from integer to text where name matches but type is wrong
ALTER TABLE onboarding_requests ALTER COLUMN q17_failure_impact TYPE text USING q17_failure_impact::text;
ALTER TABLE onboarding_requests ALTER COLUMN q20_service_recipient TYPE text USING q20_service_recipient::text;
ALTER TABLE onboarding_requests ALTER COLUMN q25_operational_effort TYPE text USING q25_operational_effort::text;
ALTER TABLE onboarding_requests ALTER COLUMN q26_replacement_complexity TYPE text USING q26_replacement_complexity::text;
ALTER TABLE onboarding_requests ALTER COLUMN q28_reputational_impact TYPE text USING q28_reputational_impact::text;
ALTER TABLE onboarding_requests ALTER COLUMN q29_public_association TYPE text USING q29_public_association::text;
ALTER TABLE onboarding_requests ALTER COLUMN q31_data_sensitivity TYPE text USING q31_data_sensitivity::text;
ALTER TABLE onboarding_requests ALTER COLUMN q32_cybersecurity_risk TYPE text USING q32_cybersecurity_risk::text;
ALTER TABLE onboarding_requests ALTER COLUMN q39_subcontractor_oversight TYPE text USING q39_subcontractor_oversight::text;

-- 2. Add new text columns for mismatched question IDs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q15_supports_essential_operations') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q15_supports_essential_operations text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q16_essential_to_business') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q16_essential_to_business text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q22_dependency_level') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q22_dependency_level text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q24_total_financial_input') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q24_total_financial_input text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27_disruption_downtime') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27_disruption_downtime text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q33_provider_availability') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q33_provider_availability text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q34_services_relied_on') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q34_services_relied_on text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q35_data_access_location') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q35_data_access_location text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q36_system_access_level') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q36_system_access_level text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q37_sensitive_data_access') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q37_sensitive_data_access text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q40_subcontractor_access') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q40_subcontractor_access text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q41_regulatory_oversight') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q41_regulatory_oversight text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q42_non_compliance_consequences') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q42_non_compliance_consequences text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q43_fraud_misconduct_history') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q43_fraud_misconduct_history text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q44_operational_maturity') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q44_operational_maturity text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q45_reliability_track_record') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q45_reliability_track_record text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q46_geopolitical_risk') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q46_geopolitical_risk text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q47_negative_coverage') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q47_negative_coverage text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q48_esg_concerns') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q48_esg_concerns text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q49_child_labor_verification') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q49_child_labor_verification text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q51_contract_type') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q51_contract_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q52_contract_duration') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q52_contract_duration text;
  END IF;
END $$;

-- 3. Add new boolean columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q30_has_system_access') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q30_has_system_access boolean;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q38_uses_subcontractors') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q38_uses_subcontractors boolean;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q50_has_formal_contract') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q50_has_formal_contract boolean;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q53_requires_formal_contract') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q53_requires_formal_contract boolean;
  END IF;
END $$;

-- 4. Add sub-question columns (exit strategy)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27b_exit_plan_documented') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27b_exit_plan_documented text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27c_transition_period') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27c_transition_period text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27d_data_portability') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27d_data_portability text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27e_exit_fees') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27e_exit_fees text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27f_bcp_documented') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27f_bcp_documented text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27g_bcp_tested') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27g_bcp_tested text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27h_rto_rpo') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27h_rto_rpo text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27i_geographic_redundancy') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27i_geographic_redundancy text;
  END IF;
END $$;

-- 5. Add sub-question columns (incident response)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q32b_incident_response_plan') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q32b_incident_response_plan text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q32c_notification_period') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q32c_notification_period text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q32d_past_incidents') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q32d_past_incidents text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q32e_incident_testing') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q32e_incident_testing text;
  END IF;
END $$;

-- 6. Add sub-question columns (audit rights & certifications)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q43b_audit_rights') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q43b_audit_rights text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q43c_osfi_access') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q43c_osfi_access text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q43d_certifications') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q43d_certifications text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q43e_audit_exercised') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q43e_audit_exercised text;
  END IF;
END $$;

-- 7. Add sub-question columns (financial viability)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q45b_financial_stability') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q45b_financial_stability text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q45c_ownership_changes') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q45c_ownership_changes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q45d_ownership_type') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q45d_ownership_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q45e_going_concern') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q45e_going_concern text;
  END IF;
END $$;

-- 8. Add sub-question columns (insurance)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q53b_professional_liability') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q53b_professional_liability text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q53c_cyber_liability') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q53c_cyber_liability text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q53d_coverage_adequacy') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q53d_coverage_adequacy text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q53e_indemnification') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q53e_indemnification text;
  END IF;
END $$;

-- 9. Fix preliminary_risk_score type from integer to numeric
ALTER TABLE onboarding_requests ALTER COLUMN preliminary_risk_score TYPE numeric USING preliminary_risk_score::numeric;

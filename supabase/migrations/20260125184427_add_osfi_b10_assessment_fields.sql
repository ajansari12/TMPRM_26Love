/*
  # Add OSFI B-10 Compliant Assessment Fields

  This migration adds new assessment fields required for comprehensive OSFI B-10 compliance.
  The fields cover six key areas previously missing from the tiering assessment:

  1. Exit Strategy & Transition Planning (Q27b-e)
     - Documented exit plans
     - Transition period estimates
     - Data portability
     - Exit fees and lock-in provisions

  2. Business Continuity Planning (Q27f-i)
     - BCP documentation
     - BCP testing
     - RTO/RPO objectives
     - Geographic redundancy

  3. Incident Response (Q32b-e)
     - Incident response plans
     - Notification periods
     - Past incident history
     - Incident testing

  4. Audit Rights & Certifications (Q43b-e)
     - FRFI audit rights
     - OSFI access clauses
     - Third-party certifications
     - Audit exercise history

  5. Financial Viability (Q45b-e)
     - Financial stability ratings
     - Ownership changes
     - Ownership type
     - Going concern issues

  6. Insurance & Liability (Q53b-e)
     - Professional liability insurance
     - Cyber liability insurance
     - Coverage adequacy
     - Indemnification provisions

  ## Security
  - No changes to RLS policies (existing policies apply)
  - All new fields are nullable to support gradual adoption
*/

-- Exit Strategy & Transition Planning Fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27b_exit_plan_documented'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27b_exit_plan_documented text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27c_transition_period'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27c_transition_period text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27d_data_portability'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27d_data_portability text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27e_exit_fees'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27e_exit_fees text;
  END IF;
END $$;

-- Business Continuity Planning Fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27f_bcp_documented'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27f_bcp_documented text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27g_bcp_tested'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27g_bcp_tested text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27h_rto_rpo'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27h_rto_rpo text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q27i_geographic_redundancy'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q27i_geographic_redundancy text;
  END IF;
END $$;

-- Incident Response Fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q32b_incident_response_plan'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q32b_incident_response_plan text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q32c_notification_period'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q32c_notification_period text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q32d_past_incidents'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q32d_past_incidents text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q32e_incident_testing'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q32e_incident_testing text;
  END IF;
END $$;

-- Audit Rights & Certifications Fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q43b_audit_rights'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q43b_audit_rights text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q43c_osfi_access'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q43c_osfi_access text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q43d_certifications'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q43d_certifications text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q43e_audit_exercised'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q43e_audit_exercised text;
  END IF;
END $$;

-- Financial Viability Fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q45b_financial_stability'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q45b_financial_stability text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q45c_ownership_changes'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q45c_ownership_changes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q45d_ownership_type'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q45d_ownership_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q45e_going_concern'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q45e_going_concern text;
  END IF;
END $$;

-- Insurance & Liability Fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q53b_professional_liability'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q53b_professional_liability text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q53c_cyber_liability'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q53c_cyber_liability text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q53d_coverage_adequacy'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q53d_coverage_adequacy text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'q53e_indemnification'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN q53e_indemnification text;
  END IF;
END $$;

-- Additional assessment metadata fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'assessment_notes'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN assessment_notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'vendor_archetype'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN vendor_archetype text;
  END IF;
END $$;

-- Composite risk scores for new categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'exit_strategy_score'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN exit_strategy_score numeric(4,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'bcp_score'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN bcp_score numeric(4,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'incident_response_score'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN incident_response_score numeric(4,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'audit_rights_score'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN audit_rights_score numeric(4,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'financial_viability_score'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN financial_viability_score numeric(4,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'insurance_score'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN insurance_score numeric(4,2);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN tiering_assessments.vendor_archetype IS 'Vendor archetype classification: technology_data_processor, financial_services, professional_services, operational_support, strategic_partner, general';
COMMENT ON COLUMN tiering_assessments.exit_strategy_score IS 'Composite score for exit strategy readiness (1-5 scale)';
COMMENT ON COLUMN tiering_assessments.bcp_score IS 'Composite score for business continuity planning (1-5 scale)';
COMMENT ON COLUMN tiering_assessments.incident_response_score IS 'Composite score for incident response capabilities (1-5 scale)';
COMMENT ON COLUMN tiering_assessments.audit_rights_score IS 'Composite score for audit rights and certifications (1-5 scale)';
COMMENT ON COLUMN tiering_assessments.financial_viability_score IS 'Composite score for financial viability assessment (1-5 scale)';
COMMENT ON COLUMN tiering_assessments.insurance_score IS 'Composite score for insurance and liability coverage (1-5 scale)';

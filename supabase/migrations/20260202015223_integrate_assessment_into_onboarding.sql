/*
  # Integrate OSFI B-10 Risk Assessment into Onboarding Workflow

  This migration embeds the full 53-question risk assessment directly into the
  onboarding request workflow, eliminating the need for a separate post-approval
  assessment step.

  ## Summary of Changes

  1. New Columns on `onboarding_requests` Table
    - Full assessment questions (Q15-Q53) covering all 13 risk sections
    - Calculated risk scores and tier determination
    - Auto-critical designation tracking
    - Second line validation and audit fields
    - Schema versioning for migration tracking

  2. New Table: `onboarding_assessment_audit`
    - Tracks all changes to assessment fields
    - Records who made changes and from which defense line
    - Stores before/after values for regulatory examination
    - Supports override justification requirements

  3. Updated Triggers
    - Enhanced risk calculation incorporating full assessment
    - Automatic audit logging for assessment field changes
    - Auto-critical rule evaluation

  4. Vendor Table Updates
    - Links approved vendors to their onboarding assessment source

  ## Security
    - RLS policies for new audit table
    - Audit trail meets OSFI examination requirements

  ## Migration Strategy
    - Existing records retain NULL for new assessment fields
    - assessment_schema_version distinguishes legacy vs new records
    - No destructive changes to existing data
*/

-- ============================================
-- SECTION 1: ADD ASSESSMENT QUESTIONS TO ONBOARDING_REQUESTS
-- ============================================

DO $$
BEGIN
  -- Schema Version Tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_schema_version') THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_schema_version integer DEFAULT 1;
  END IF;

  -- ============================================
  -- Section 1: Criticality (Q15-Q17)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q15_operational_impact') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q15_operational_impact integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q16_business_essential') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q16_business_essential integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q17_failure_impact') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q17_failure_impact integer;
  END IF;

  -- ============================================
  -- Section 2: Service Classification (Q18-Q21)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q18_product_service_types') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q18_product_service_types text[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q19_service_description') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q19_service_description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q20_service_recipient') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q20_service_recipient integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q21_provider_type') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q21_provider_type text;
  END IF;

  -- ============================================
  -- Section 3: Dependency & Substitutability (Q22)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q22_substitutability') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q22_substitutability integer;
  END IF;

  -- ============================================
  -- Section 4: Financial & Operational (Q23-Q27)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q23_contract_value_cad') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q23_contract_value_cad decimal(15,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q24_financial_exposure') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q24_financial_exposure integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q25_operational_effort') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q25_operational_effort integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q26_replacement_complexity') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q26_replacement_complexity integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q27_disruption_tolerance') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q27_disruption_tolerance integer;
  END IF;

  -- ============================================
  -- Section 5: Strategic & Reputational (Q28-Q29)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q28_reputational_impact') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q28_reputational_impact integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q29_public_association') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q29_public_association integer;
  END IF;

  -- ============================================
  -- Section 6: Data Sensitivity & Cybersecurity (Q30-Q32)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q30_system_access_level') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q30_system_access_level integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q31_data_sensitivity') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q31_data_sensitivity integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q32_cybersecurity_risk') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q32_cybersecurity_risk integer;
  END IF;

  -- ============================================
  -- Section 7: Concentration Risk (Q33-Q34)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q33_market_concentration') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q33_market_concentration integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q34_service_bundling') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q34_service_bundling integer;
  END IF;

  -- ============================================
  -- Section 8: Access & Data Location (Q35-Q37)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q35_data_location') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q35_data_location integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q36_remote_access') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q36_remote_access integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q37_privileged_access') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q37_privileged_access integer;
  END IF;

  -- ============================================
  -- Section 9: Subcontractors & Fourth Parties (Q38-Q40)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q38_subcontractor_use') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q38_subcontractor_use integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q39_subcontractor_oversight') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q39_subcontractor_oversight integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q40_subcontractor_data_access') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q40_subcontractor_data_access integer;
  END IF;

  -- ============================================
  -- Section 10: Legal & Regulatory (Q41-Q43)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q41_regulatory_requirements') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q41_regulatory_requirements integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q42_compliance_history') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q42_compliance_history integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q43_litigation_risk') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q43_litigation_risk integer;
  END IF;

  -- ============================================
  -- Section 11: Operational Maturity (Q44-Q45)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q44_vendor_maturity') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q44_vendor_maturity integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q45_performance_history') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q45_performance_history integer;
  END IF;

  -- ============================================
  -- Section 12: Geographic & ESG Risk (Q46-Q49)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q46_geographic_risk') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q46_geographic_risk integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q47_political_stability') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q47_political_stability integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q48_esg_risk') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q48_esg_risk integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q49_sanctions_exposure') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q49_sanctions_exposure integer;
  END IF;

  -- ============================================
  -- Section 13: Contract Information (Q50-Q53)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q50_contract_formality') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q50_contract_formality integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q51_contract_terms') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q51_contract_terms integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q52_exit_provisions') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q52_exit_provisions integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q53_audit_rights') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q53_audit_rights integer;
  END IF;

  -- ============================================
  -- Customer Facing Assessment (Q14)
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'q14_customer_facing') THEN
    ALTER TABLE onboarding_requests ADD COLUMN q14_customer_facing integer;
  END IF;

END $$;

-- ============================================
-- SECTION 2: ADD CALCULATED SCORES AND TIER FIELDS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'calculated_criticality_score') THEN
    ALTER TABLE onboarding_requests ADD COLUMN calculated_criticality_score decimal(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'calculated_impact_score') THEN
    ALTER TABLE onboarding_requests ADD COLUMN calculated_impact_score decimal(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'calculated_likelihood_score') THEN
    ALTER TABLE onboarding_requests ADD COLUMN calculated_likelihood_score decimal(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'calculated_risk_rating') THEN
    ALTER TABLE onboarding_requests ADD COLUMN calculated_risk_rating decimal(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'calculated_tier') THEN
    ALTER TABLE onboarding_requests ADD COLUMN calculated_tier text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_completed') THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_completed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_completed_at') THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_completed_by') THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_completed_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- ============================================
-- SECTION 3: ADD AUTO-CRITICAL TRACKING FIELDS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'is_auto_critical') THEN
    ALTER TABLE onboarding_requests ADD COLUMN is_auto_critical boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'auto_critical_rule_id') THEN
    ALTER TABLE onboarding_requests ADD COLUMN auto_critical_rule_id uuid REFERENCES auto_critical_rules(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'auto_critical_rule_name') THEN
    ALTER TABLE onboarding_requests ADD COLUMN auto_critical_rule_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'auto_critical_triggered_at') THEN
    ALTER TABLE onboarding_requests ADD COLUMN auto_critical_triggered_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'auto_critical_override') THEN
    ALTER TABLE onboarding_requests ADD COLUMN auto_critical_override boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'auto_critical_override_reason') THEN
    ALTER TABLE onboarding_requests ADD COLUMN auto_critical_override_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'auto_critical_override_by') THEN
    ALTER TABLE onboarding_requests ADD COLUMN auto_critical_override_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'auto_critical_override_at') THEN
    ALTER TABLE onboarding_requests ADD COLUMN auto_critical_override_at timestamptz;
  END IF;
END $$;

-- ============================================
-- SECTION 4: ADD SECOND LINE VALIDATION FIELDS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_validated') THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_validated boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_validated_by') THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_validated_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_validated_at') THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_validated_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'validated_tier') THEN
    ALTER TABLE onboarding_requests ADD COLUMN validated_tier text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'tier_adjustment_reason') THEN
    ALTER TABLE onboarding_requests ADD COLUMN tier_adjustment_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'second_line_override_count') THEN
    ALTER TABLE onboarding_requests ADD COLUMN second_line_override_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'independent_assessment_conducted') THEN
    ALTER TABLE onboarding_requests ADD COLUMN independent_assessment_conducted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'due_diligence_level') THEN
    ALTER TABLE onboarding_requests ADD COLUMN due_diligence_level text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_requests' AND column_name = 'due_diligence_requirements') THEN
    ALTER TABLE onboarding_requests ADD COLUMN due_diligence_requirements text[];
  END IF;
END $$;

-- ============================================
-- SECTION 5: CREATE ASSESSMENT AUDIT TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_assessment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  onboarding_request_id uuid NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,

  action_type text NOT NULL,
  field_name text NOT NULL,
  original_value jsonb,
  new_value jsonb,

  changed_by uuid NOT NULL REFERENCES auth.users(id),
  changed_by_name text,
  changed_by_defense_line defense_line,
  changed_at timestamptz DEFAULT now(),

  reason text,
  is_override boolean DEFAULT false,
  override_approved_by uuid REFERENCES auth.users(id),

  session_id uuid,
  batch_id uuid
);

CREATE INDEX IF NOT EXISTS idx_assessment_audit_request ON onboarding_assessment_audit(onboarding_request_id);
CREATE INDEX IF NOT EXISTS idx_assessment_audit_org ON onboarding_assessment_audit(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_audit_changed_by ON onboarding_assessment_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_assessment_audit_changed_at ON onboarding_assessment_audit(changed_at);
CREATE INDEX IF NOT EXISTS idx_assessment_audit_field ON onboarding_assessment_audit(field_name);
CREATE INDEX IF NOT EXISTS idx_assessment_audit_action ON onboarding_assessment_audit(action_type);

ALTER TABLE onboarding_assessment_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view assessment audit in their org"
  ON onboarding_assessment_audit
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "System can insert assessment audit"
  ON onboarding_assessment_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SECTION 6: ADD VENDOR TABLE ASSESSMENT SOURCE
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'assessment_source') THEN
    ALTER TABLE vendors ADD COLUMN assessment_source text DEFAULT 'tiering_assessment';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'initial_onboarding_request_id') THEN
    ALTER TABLE vendors ADD COLUMN initial_onboarding_request_id uuid REFERENCES onboarding_requests(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'onboarding_assessment_date') THEN
    ALTER TABLE vendors ADD COLUMN onboarding_assessment_date timestamptz;
  END IF;
END $$;

-- ============================================
-- SECTION 7: CREATE COMPREHENSIVE RISK CALCULATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_onboarding_comprehensive_risk()
RETURNS TRIGGER AS $$
DECLARE
  preliminary_score integer := 0;
  preliminary_tier text;
  criticality_score decimal(5,2) := 0;
  impact_score decimal(5,2) := 0;
  likelihood_score decimal(5,2) := 0;
  risk_rating decimal(5,2);
  final_tier text;
  assessment_count integer := 0;
  has_full_assessment boolean := false;
  matched_rule RECORD;
  dd_level text;
  dd_requirements text[] := ARRAY[]::text[];
  effective_tier text;
BEGIN
  -- ============================================
  -- PART 1: Calculate preliminary risk from boolean indicators
  -- ============================================
  IF NEW.is_critical_service THEN preliminary_score := preliminary_score + 30; END IF;
  IF NEW.supports_essential_operations THEN preliminary_score := preliminary_score + 25; END IF;
  IF NEW.handles_sensitive_data THEN preliminary_score := preliminary_score + 20; END IF;
  IF NEW.has_system_access THEN preliminary_score := preliminary_score + 15; END IF;
  IF NEW.is_outsourcing THEN preliminary_score := preliminary_score + 15; END IF;
  IF NEW.uses_subcontractors THEN preliminary_score := preliminary_score + 10; END IF;
  IF NEW.offshore_components THEN preliminary_score := preliminary_score + 10; END IF;

  IF NEW.estimated_contract_value_cad IS NOT NULL THEN
    IF NEW.estimated_contract_value_cad >= 1000000 THEN preliminary_score := preliminary_score + 20;
    ELSIF NEW.estimated_contract_value_cad >= 500000 THEN preliminary_score := preliminary_score + 15;
    ELSIF NEW.estimated_contract_value_cad >= 100000 THEN preliminary_score := preliminary_score + 10;
    ELSIF NEW.estimated_contract_value_cad >= 50000 THEN preliminary_score := preliminary_score + 5;
    END IF;
  END IF;

  IF preliminary_score >= 80 THEN
    preliminary_tier := 'tier_5_critical';
    NEW.requires_2nd_line_review := true;
  ELSIF preliminary_score >= 60 THEN
    preliminary_tier := 'tier_4_high';
    NEW.requires_2nd_line_review := true;
  ELSIF preliminary_score >= 40 THEN
    preliminary_tier := 'tier_3_moderate';
    NEW.requires_2nd_line_review := true;
  ELSIF preliminary_score >= 20 THEN
    preliminary_tier := 'tier_2_low';
    NEW.requires_2nd_line_review := false;
  ELSE
    preliminary_tier := 'tier_1_informational';
    NEW.requires_2nd_line_review := false;
  END IF;

  NEW.preliminary_risk_score := preliminary_score;
  NEW.preliminary_risk_tier := preliminary_tier;

  IF NEW.is_critical_service THEN
    NEW.requires_2nd_line_review := true;
  END IF;

  -- ============================================
  -- PART 2: Calculate comprehensive risk from full assessment (if provided)
  -- ============================================

  IF NEW.q15_operational_impact IS NOT NULL THEN assessment_count := assessment_count + 1; END IF;
  IF NEW.q16_business_essential IS NOT NULL THEN assessment_count := assessment_count + 1; END IF;
  IF NEW.q17_failure_impact IS NOT NULL THEN assessment_count := assessment_count + 1; END IF;
  IF NEW.q22_substitutability IS NOT NULL THEN assessment_count := assessment_count + 1; END IF;
  IF NEW.q31_data_sensitivity IS NOT NULL THEN assessment_count := assessment_count + 1; END IF;

  IF assessment_count >= 3 THEN
    has_full_assessment := true;

    criticality_score := (
      COALESCE(NEW.q15_operational_impact, 0) * 0.35 +
      COALESCE(NEW.q16_business_essential, 0) * 0.25 +
      COALESCE(NEW.q17_failure_impact, 0) * 0.25 +
      COALESCE(NEW.q22_substitutability, 0) * 0.15
    );

    impact_score := (
      COALESCE(NEW.q28_reputational_impact, 0) * 0.20 +
      COALESCE(NEW.q31_data_sensitivity, 0) * 0.25 +
      COALESCE(NEW.q32_cybersecurity_risk, 0) * 0.20 +
      COALESCE(NEW.q24_financial_exposure, 0) * 0.15 +
      COALESCE(NEW.q41_regulatory_requirements, 0) * 0.20
    );

    likelihood_score := (
      COALESCE(NEW.q44_vendor_maturity, 0) * 0.20 +
      COALESCE(NEW.q45_performance_history, 0) * 0.20 +
      COALESCE(NEW.q42_compliance_history, 0) * 0.15 +
      COALESCE(NEW.q46_geographic_risk, 0) * 0.15 +
      COALESCE(NEW.q38_subcontractor_use, 0) * 0.15 +
      COALESCE(NEW.q33_market_concentration, 0) * 0.15
    );

    risk_rating := (criticality_score * 0.40) + (impact_score * 0.35) + (likelihood_score * 0.25);

    IF risk_rating >= 4.0 OR criticality_score >= 4.5 THEN
      final_tier := 'tier_5_critical';
      NEW.requires_2nd_line_review := true;
    ELSIF risk_rating >= 3.0 THEN
      final_tier := 'tier_4_high';
      NEW.requires_2nd_line_review := true;
    ELSIF risk_rating >= 2.0 THEN
      final_tier := 'tier_3_moderate';
      NEW.requires_2nd_line_review := true;
    ELSIF risk_rating >= 1.0 THEN
      final_tier := 'tier_2_low';
    ELSE
      final_tier := 'tier_1_informational';
    END IF;

    NEW.calculated_criticality_score := criticality_score;
    NEW.calculated_impact_score := impact_score;
    NEW.calculated_likelihood_score := likelihood_score;
    NEW.calculated_risk_rating := risk_rating;
    NEW.calculated_tier := final_tier;

    IF NOT COALESCE(NEW.assessment_completed, false) AND assessment_count >= 10 THEN
      NEW.assessment_completed := true;
      NEW.assessment_completed_at := now();
    END IF;
  END IF;

  -- ============================================
  -- PART 3: Check auto-critical rules
  -- ============================================

  IF NEW.organization_id IS NOT NULL AND NOT COALESCE(NEW.auto_critical_override, false) THEN
    FOR matched_rule IN
      SELECT id, rule_name, conditions
      FROM auto_critical_rules
      WHERE organization_id = NEW.organization_id
      AND is_active = true
      ORDER BY priority ASC
    LOOP
      DECLARE
        rule_matches boolean := true;
        condition jsonb;
        field_value text;
        cond_field text;
        cond_operator text;
        cond_value text;
      BEGIN
        FOR condition IN SELECT * FROM jsonb_array_elements(matched_rule.conditions)
        LOOP
          cond_field := condition->>'field';
          cond_operator := condition->>'operator';
          cond_value := condition->>'value';

          CASE cond_field
            WHEN 'contract_value_cad' THEN
              field_value := COALESCE(NEW.estimated_contract_value_cad, NEW.q23_contract_value_cad)::text;
            WHEN 'handles_sensitive_data' THEN
              field_value := NEW.handles_sensitive_data::text;
            WHEN 'q14_customer_facing' THEN
              field_value := NEW.q14_customer_facing::text;
            WHEN 'q15_operational_impact' THEN
              field_value := NEW.q15_operational_impact::text;
            WHEN 'q22_substitutability' THEN
              field_value := NEW.q22_substitutability::text;
            WHEN 'service_category' THEN
              field_value := NEW.service_category;
            ELSE
              field_value := NULL;
          END CASE;

          IF field_value IS NULL THEN
            rule_matches := false;
            EXIT;
          END IF;

          CASE cond_operator
            WHEN '=' THEN
              IF field_value != cond_value THEN rule_matches := false; END IF;
            WHEN '>=' THEN
              IF field_value::numeric < cond_value::numeric THEN rule_matches := false; END IF;
            WHEN '>' THEN
              IF field_value::numeric <= cond_value::numeric THEN rule_matches := false; END IF;
            WHEN '<=' THEN
              IF field_value::numeric > cond_value::numeric THEN rule_matches := false; END IF;
            WHEN '<' THEN
              IF field_value::numeric >= cond_value::numeric THEN rule_matches := false; END IF;
            WHEN 'in' THEN
              IF NOT (field_value = ANY(ARRAY(SELECT jsonb_array_elements_text(condition->'value')))) THEN
                rule_matches := false;
              END IF;
            ELSE
              rule_matches := false;
          END CASE;

          IF NOT rule_matches THEN EXIT; END IF;
        END LOOP;

        IF rule_matches THEN
          NEW.is_auto_critical := true;
          NEW.auto_critical_rule_id := matched_rule.id;
          NEW.auto_critical_rule_name := matched_rule.rule_name;
          NEW.auto_critical_triggered_at := now();
          NEW.calculated_tier := 'tier_5_critical';
          NEW.requires_2nd_line_review := true;
          EXIT;
        END IF;
      END;
    END LOOP;
  END IF;

  -- ============================================
  -- PART 4: Determine due diligence requirements
  -- ============================================

  effective_tier := COALESCE(NEW.calculated_tier, NEW.preliminary_risk_tier);

  CASE effective_tier
    WHEN 'tier_5_critical' THEN
      dd_level := 'comprehensive';
      dd_requirements := ARRAY[
        'financial_statements',
        'security_assessment',
        'soc2_report',
        'business_continuity_plan',
        'disaster_recovery_plan',
        'insurance_certificates',
        'regulatory_compliance_attestation',
        'reference_checks',
        'on_site_assessment',
        'penetration_test_results'
      ];
    WHEN 'tier_4_high' THEN
      dd_level := 'enhanced';
      dd_requirements := ARRAY[
        'financial_statements',
        'security_questionnaire',
        'soc2_report',
        'business_continuity_plan',
        'insurance_certificates',
        'regulatory_compliance_attestation'
      ];
    WHEN 'tier_3_moderate' THEN
      dd_level := 'standard';
      dd_requirements := ARRAY[
        'security_questionnaire',
        'insurance_certificates',
        'business_references'
      ];
    WHEN 'tier_2_low' THEN
      dd_level := 'basic';
      dd_requirements := ARRAY[
        'basic_vendor_information',
        'insurance_certificates'
      ];
    ELSE
      dd_level := 'minimal';
      dd_requirements := ARRAY['basic_vendor_information'];
  END CASE;

  NEW.due_diligence_level := dd_level;
  NEW.due_diligence_requirements := dd_requirements;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_onboarding_risk ON onboarding_requests;
CREATE TRIGGER calculate_onboarding_risk
  BEFORE INSERT OR UPDATE ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION calculate_onboarding_comprehensive_risk();

-- ============================================
-- SECTION 8: CREATE ASSESSMENT AUDIT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION log_assessment_field_changes()
RETURNS TRIGGER AS $$
DECLARE
  assessment_fields text[] := ARRAY[
    'q14_customer_facing', 'q15_operational_impact', 'q16_business_essential', 'q17_failure_impact',
    'q18_product_service_types', 'q19_service_description', 'q20_service_recipient', 'q21_provider_type',
    'q22_substitutability', 'q23_contract_value_cad', 'q24_financial_exposure', 'q25_operational_effort',
    'q26_replacement_complexity', 'q27_disruption_tolerance', 'q28_reputational_impact', 'q29_public_association',
    'q30_system_access_level', 'q31_data_sensitivity', 'q32_cybersecurity_risk', 'q33_market_concentration',
    'q34_service_bundling', 'q35_data_location', 'q36_remote_access', 'q37_privileged_access',
    'q38_subcontractor_use', 'q39_subcontractor_oversight', 'q40_subcontractor_data_access',
    'q41_regulatory_requirements', 'q42_compliance_history', 'q43_litigation_risk',
    'q44_vendor_maturity', 'q45_performance_history', 'q46_geographic_risk', 'q47_political_stability',
    'q48_esg_risk', 'q49_sanctions_exposure', 'q50_contract_formality', 'q51_contract_terms',
    'q52_exit_provisions', 'q53_audit_rights', 'calculated_tier', 'validated_tier',
    'is_auto_critical', 'auto_critical_override'
  ];
  field_name text;
  old_value jsonb;
  new_value jsonb;
  user_defense_line defense_line;
  user_name text;
  batch_uuid uuid;
  action text;
BEGIN
  IF NEW.assessment_schema_version IS NULL OR NEW.assessment_schema_version < 1 THEN
    RETURN NEW;
  END IF;

  batch_uuid := gen_random_uuid();

  SELECT ou.defense_line, p.full_name
  INTO user_defense_line, user_name
  FROM organization_users ou
  LEFT JOIN profiles p ON p.id = auth.uid()
  WHERE ou.organization_id = NEW.organization_id
  AND ou.user_id = auth.uid()
  AND ou.is_active = true
  LIMIT 1;

  FOREACH field_name IN ARRAY assessment_fields
  LOOP
    EXECUTE format('SELECT to_jsonb($1.%I), to_jsonb($2.%I)', field_name, field_name)
    INTO old_value, new_value
    USING OLD, NEW;

    IF old_value IS DISTINCT FROM new_value THEN
      IF old_value IS NULL THEN
        action := 'initial_entry';
      ELSIF user_defense_line = '2nd' AND OLD.assessment_completed THEN
        action := 'second_line_override';
      ELSE
        action := 'update';
      END IF;

      INSERT INTO onboarding_assessment_audit (
        organization_id,
        onboarding_request_id,
        action_type,
        field_name,
        original_value,
        new_value,
        changed_by,
        changed_by_name,
        changed_by_defense_line,
        is_override,
        batch_id
      ) VALUES (
        NEW.organization_id,
        NEW.id,
        action,
        field_name,
        old_value,
        new_value,
        auth.uid(),
        user_name,
        user_defense_line,
        action = 'second_line_override',
        batch_uuid
      );

      IF action = 'second_line_override' THEN
        NEW.second_line_override_count := COALESCE(NEW.second_line_override_count, 0) + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_assessment_changes ON onboarding_requests;
CREATE TRIGGER log_assessment_changes
  BEFORE UPDATE ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION log_assessment_field_changes();

-- ============================================
-- SECTION 9: CREATE HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_onboarding_assessment_history(p_request_id uuid)
RETURNS TABLE (
  audit_id uuid,
  action_type text,
  field_name text,
  original_value jsonb,
  new_value jsonb,
  changed_by_name text,
  defense_line defense_line,
  changed_at timestamptz,
  is_override boolean
) AS $$
  SELECT
    oaa.id AS audit_id,
    oaa.action_type,
    oaa.field_name,
    oaa.original_value,
    oaa.new_value,
    oaa.changed_by_name,
    oaa.changed_by_defense_line AS defense_line,
    oaa.changed_at,
    oaa.is_override
  FROM onboarding_assessment_audit oaa
  WHERE oaa.onboarding_request_id = p_request_id
  ORDER BY oaa.changed_at DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION validate_onboarding_assessment(
  p_request_id uuid,
  p_validated_tier text,
  p_adjustment_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  req onboarding_requests%ROWTYPE;
  user_line defense_line;
BEGIN
  SELECT * INTO req FROM onboarding_requests WHERE id = p_request_id;

  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  SELECT ou.defense_line INTO user_line
  FROM organization_users ou
  WHERE ou.organization_id = req.organization_id
  AND ou.user_id = auth.uid()
  AND ou.is_active = true
  LIMIT 1;

  IF user_line NOT IN ('2nd', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only 2nd line or admin can validate assessments');
  END IF;

  UPDATE onboarding_requests
  SET
    assessment_validated = true,
    assessment_validated_by = auth.uid(),
    assessment_validated_at = now(),
    validated_tier = p_validated_tier,
    tier_adjustment_reason = p_adjustment_reason,
    independent_assessment_conducted = true
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'validated_tier', p_validated_tier,
    'validated_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION override_auto_critical(
  p_request_id uuid,
  p_override_reason text
)
RETURNS jsonb AS $$
DECLARE
  req onboarding_requests%ROWTYPE;
  user_line defense_line;
BEGIN
  SELECT * INTO req FROM onboarding_requests WHERE id = p_request_id;

  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF NOT req.is_auto_critical THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not auto-critical');
  END IF;

  SELECT ou.defense_line INTO user_line
  FROM organization_users ou
  WHERE ou.organization_id = req.organization_id
  AND ou.user_id = auth.uid()
  AND ou.is_active = true
  LIMIT 1;

  IF user_line NOT IN ('2nd', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only 2nd line or admin can override auto-critical');
  END IF;

  IF p_override_reason IS NULL OR length(trim(p_override_reason)) < 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Override reason must be at least 20 characters');
  END IF;

  UPDATE onboarding_requests
  SET
    auto_critical_override = true,
    auto_critical_override_reason = p_override_reason,
    auto_critical_override_by = auth.uid(),
    auto_critical_override_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Auto-critical override applied',
    'override_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 10: CREATE INDEXES FOR NEW FIELDS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_onboarding_calculated_tier ON onboarding_requests(calculated_tier);
CREATE INDEX IF NOT EXISTS idx_onboarding_validated_tier ON onboarding_requests(validated_tier);
CREATE INDEX IF NOT EXISTS idx_onboarding_is_auto_critical ON onboarding_requests(is_auto_critical);
CREATE INDEX IF NOT EXISTS idx_onboarding_assessment_completed ON onboarding_requests(assessment_completed);
CREATE INDEX IF NOT EXISTS idx_onboarding_assessment_validated ON onboarding_requests(assessment_validated);
CREATE INDEX IF NOT EXISTS idx_onboarding_schema_version ON onboarding_requests(assessment_schema_version);

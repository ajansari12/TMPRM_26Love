/*
  # Create Tiering Assessments Table

  1. New Tables
    - `tiering_assessments` - Full 53-question risk assessment
      - Stores all 13 sections of questions
      - Calculated scores and tier determination
      - Review and approval workflow
      
  2. Security
    - Enable RLS
    - Authenticated users can read assessments
    - Risk managers and compliance analysts can create/update assessments
*/

CREATE TABLE IF NOT EXISTS tiering_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id text UNIQUE NOT NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  assessment_date date DEFAULT CURRENT_DATE,
  assessor_name text,
  assessment_type text DEFAULT 'initial',
  status text DEFAULT 'draft',

  -- Section 1: Criticality (Q15-Q17)
  q15_supports_essential_operations text,
  q16_essential_to_business text,
  q17_failure_impact text,

  -- Section 2: Service Classification (Q18-Q21)
  q18_product_service_types text[],
  q19_service_description text,
  q20_service_recipient text,
  q21_provider_type text,

  -- Section 3: Dependency (Q22)
  q22_dependency_level text,

  -- Section 4: Financial & Operational (Q23-Q27)
  q23_contract_value_cad decimal(15,2),
  q24_total_financial_input text,
  q25_operational_effort text,
  q26_replacement_complexity text,
  q27_disruption_downtime text,

  -- Section 5: Strategic & Reputational (Q28-Q29)
  q28_reputational_impact text,
  q29_public_association text,

  -- Section 6: Data Sensitivity (Q30-Q32)
  q30_has_system_access boolean,
  q31_data_sensitivity text,
  q32_cybersecurity_risk text,

  -- Section 7: Concentration (Q33-Q34)
  q33_provider_availability text,
  q34_services_relied_on text,

  -- Section 8: Access Level (Q35-Q37)
  q35_data_access_location text,
  q36_system_access_level text,
  q37_sensitive_data_access text,

  -- Section 9: Subcontractors (Q38-Q40)
  q38_uses_subcontractors boolean,
  q39_subcontractor_oversight text,
  q40_subcontractor_access text,

  -- Section 10: Legal & Regulatory (Q41-Q43)
  q41_regulatory_oversight text,
  q42_non_compliance_consequences text,
  q43_fraud_misconduct_history text,

  -- Section 11: Operational Maturity (Q44-Q45)
  q44_operational_maturity text,
  q45_reliability_track_record text,

  -- Section 12: Other Risk Factors (Q46-Q49)
  q46_geopolitical_risk text,
  q47_negative_coverage text,
  q48_esg_concerns text,
  q49_child_labor_verification text,

  -- Section 13: Contract Information (Q50-Q53)
  q50_has_formal_contract boolean,
  q51_contract_type text,
  q52_contract_duration text,
  q53_requires_formal_contract boolean,

  -- Calculated scores
  criticality_score decimal(3,2),
  impact_score decimal(3,2),
  likelihood_score decimal(3,2),
  risk_rating decimal(5,2),
  calculated_tier text,
  is_auto_critical boolean DEFAULT false,

  -- Review & Approval
  reviewer_name text,
  review_date date,
  review_comments text,
  approved_by text,
  approval_date date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to generate assessment_id
CREATE OR REPLACE FUNCTION generate_assessment_id()
RETURNS text AS $$
DECLARE
  next_num int;
  year_str text;
  new_id text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN assessment_id ~ '^TA-[0-9]{4}-[0-9]+$' THEN
        CAST(substring(assessment_id from 'TA-[0-9]{4}-([0-9]+)') AS int)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM tiering_assessments
  WHERE assessment_id LIKE 'TA-' || year_str || '-%';
  
  new_id := 'TA-' || year_str || '-' || lpad(next_num::text, 3, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate assessment_id
CREATE OR REPLACE FUNCTION set_assessment_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assessment_id IS NULL OR NEW.assessment_id = '' THEN
    NEW.assessment_id := generate_assessment_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_assessment_id ON tiering_assessments;
CREATE TRIGGER trigger_set_assessment_id
  BEFORE INSERT ON tiering_assessments
  FOR EACH ROW
  EXECUTE FUNCTION set_assessment_id();

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_assessments_updated_at ON tiering_assessments;
CREATE TRIGGER trigger_assessments_updated_at
  BEFORE UPDATE ON tiering_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assessments_vendor_id ON tiering_assessments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON tiering_assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_assessment_id ON tiering_assessments(assessment_id);

-- Enable RLS
ALTER TABLE tiering_assessments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read assessments
CREATE POLICY "Authenticated users can read assessments"
  ON tiering_assessments
  FOR SELECT
  TO authenticated
  USING (true);

-- Risk managers and compliance analysts can insert assessments
CREATE POLICY "Authorized users can insert assessments"
  ON tiering_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')
    )
  );

-- Risk managers and compliance analysts can update assessments
CREATE POLICY "Authorized users can update assessments"
  ON tiering_assessments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')
    )
  );

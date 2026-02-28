/*
  # Create OSFI B-10 Compliance Tracking Tables

  This migration creates the tables necessary for tracking OSFI B-10 regulatory compliance.

  1. New Tables
    - `osfi_b10_requirements`
      - `id` (uuid, primary key)
      - `requirement_code` (text) - Unique code like "B10-GOV-1"
      - `requirement_text` (text) - Full requirement description
      - `category` (text) - Governance, Risk Management, Due Diligence, etc.
      - `subcategory` (text) - More specific grouping
      - `is_mandatory` (boolean) - Whether requirement is mandatory
      - `applies_to_tier` (text[]) - Which vendor tiers this applies to
      - `guidance_notes` (text) - Additional OSFI guidance

    - `osfi_b10_compliance_status`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `requirement_id` (uuid, foreign key)
      - `vendor_id` (uuid, nullable foreign key) - Optional vendor-specific compliance
      - `status` (text) - compliant, non_compliant, partially_compliant, not_applicable, not_assessed
      - `evidence_document_id` (uuid, nullable) - Link to evidence
      - `notes` (text) - Assessment notes
      - `last_assessed_date` (timestamptz)
      - `assessed_by` (uuid)
      - `next_review_date` (timestamptz)
      - `remediation_plan` (text)
      - `remediation_due_date` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Organization users can read/write their compliance status
    - Requirements table is read-only for authenticated users

  3. Seed Data
    - Populates with OSFI B-10 requirements
*/

-- Create osfi_b10_requirements table
CREATE TABLE IF NOT EXISTS osfi_b10_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_code text UNIQUE NOT NULL,
  requirement_text text NOT NULL,
  category text NOT NULL,
  subcategory text,
  is_mandatory boolean DEFAULT true,
  applies_to_tier text[] DEFAULT ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low', 'tier_1_informational'],
  guidance_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create osfi_b10_compliance_status table
CREATE TABLE IF NOT EXISTS osfi_b10_compliance_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES osfi_b10_requirements(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_assessed' CHECK (status IN ('compliant', 'non_compliant', 'partially_compliant', 'not_applicable', 'not_assessed')),
  evidence_document_id uuid REFERENCES vendor_documents(id) ON DELETE SET NULL,
  notes text,
  last_assessed_date timestamptz,
  assessed_by uuid REFERENCES auth.users(id),
  next_review_date timestamptz,
  remediation_plan text,
  remediation_due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique indexes for compliance status
CREATE UNIQUE INDEX IF NOT EXISTS idx_osfi_compliance_org_req_vendor 
  ON osfi_b10_compliance_status(organization_id, requirement_id, vendor_id) 
  WHERE vendor_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_osfi_compliance_org_req_no_vendor 
  ON osfi_b10_compliance_status(organization_id, requirement_id) 
  WHERE vendor_id IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_osfi_compliance_org ON osfi_b10_compliance_status(organization_id);
CREATE INDEX IF NOT EXISTS idx_osfi_compliance_req ON osfi_b10_compliance_status(requirement_id);
CREATE INDEX IF NOT EXISTS idx_osfi_compliance_vendor ON osfi_b10_compliance_status(vendor_id);
CREATE INDEX IF NOT EXISTS idx_osfi_compliance_status ON osfi_b10_compliance_status(status);
CREATE INDEX IF NOT EXISTS idx_osfi_requirements_category ON osfi_b10_requirements(category);

-- Enable RLS
ALTER TABLE osfi_b10_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE osfi_b10_compliance_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for osfi_b10_requirements (read-only for authenticated users)
CREATE POLICY "Authenticated users can read requirements"
  ON osfi_b10_requirements
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for osfi_b10_compliance_status
CREATE POLICY "Organization users can view their compliance status"
  ON osfi_b10_compliance_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = osfi_b10_compliance_status.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
    )
  );

CREATE POLICY "Organization users can insert compliance status"
  ON osfi_b10_compliance_status
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = osfi_b10_compliance_status.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
    )
  );

CREATE POLICY "Organization users can update their compliance status"
  ON osfi_b10_compliance_status
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = osfi_b10_compliance_status.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = osfi_b10_compliance_status.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
    )
  );

CREATE POLICY "Organization users can delete their compliance status"
  ON osfi_b10_compliance_status
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = osfi_b10_compliance_status.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
    )
  );

-- Seed OSFI B-10 Requirements
INSERT INTO osfi_b10_requirements (requirement_code, requirement_text, category, subcategory, is_mandatory, applies_to_tier, guidance_notes)
VALUES
  -- Governance
  ('B10-GOV-1', 'Senior Management must approve the third-party risk management framework', 'governance', 'accountability', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low', 'tier_1_informational'], 'Board or Senior Management Committee approval required'),
  ('B10-GOV-2', 'Clear roles and responsibilities for third-party risk management must be defined', 'governance', 'accountability', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low', 'tier_1_informational'], 'Document in TPRM policy'),
  ('B10-GOV-3', 'Adequate resources must be allocated for third-party risk oversight', 'governance', 'resources', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Include staffing, technology, and budget'),
  ('B10-GOV-4', 'Regular reporting to the Board on material third-party arrangements', 'governance', 'reporting', true, ARRAY['tier_5_critical', 'tier_4_high'], 'At least quarterly for critical/high risk'),
  ('B10-GOV-5', 'Third-party risk management policy must be documented and approved', 'governance', 'policy', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low', 'tier_1_informational'], 'Annual review required'),

  -- Risk Management
  ('B10-RM-1', 'Risk assessment must be performed before engaging third parties', 'risk_management', 'assessment', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low'], 'Inherent risk assessment required'),
  ('B10-RM-2', 'Third parties must be tiered based on risk criticality', 'risk_management', 'tiering', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low', 'tier_1_informational'], 'Use consistent tiering methodology'),
  ('B10-RM-3', 'Concentration risk must be identified and monitored', 'risk_management', 'concentration', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Includes geographic, service, and revenue concentration'),
  ('B10-RM-4', 'Fourth-party (subcontractor) risks must be assessed', 'risk_management', 'subcontracting', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Maintain subcontractor inventory'),
  ('B10-RM-5', 'Risk appetite for third-party arrangements must be established', 'risk_management', 'appetite', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Align with enterprise risk appetite'),

  -- Due Diligence
  ('B10-DD-1', 'Pre-engagement due diligence must be performed', 'due_diligence', 'pre_engagement', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low'], 'Proportionate to risk level'),
  ('B10-DD-2', 'Financial viability of third parties must be assessed', 'due_diligence', 'financial', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Review financial statements, credit ratings'),
  ('B10-DD-3', 'Operational capability must be verified', 'due_diligence', 'operational', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Include capacity, expertise, track record'),
  ('B10-DD-4', 'Information security controls must be evaluated', 'due_diligence', 'security', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Review certifications, penetration tests'),
  ('B10-DD-5', 'Business continuity capabilities must be assessed', 'due_diligence', 'continuity', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Review BCP, DRP, test results'),
  ('B10-DD-6', 'Regulatory compliance history must be reviewed', 'due_diligence', 'compliance', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Check for enforcement actions, sanctions'),

  -- Contractual Requirements
  ('B10-CR-1', 'Written agreements must be in place for all material arrangements', 'contractual', 'documentation', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low'], 'Include service descriptions, SLAs'),
  ('B10-CR-2', 'Right to audit must be contractually established', 'contractual', 'audit_rights', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Include OSFI access provisions'),
  ('B10-CR-3', 'Data protection requirements must be specified', 'contractual', 'data_protection', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Include data location, encryption, retention'),
  ('B10-CR-4', 'Incident notification requirements must be defined', 'contractual', 'incidents', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Specify notification timelines'),
  ('B10-CR-5', 'Termination and exit provisions must be included', 'contractual', 'exit', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Include transition assistance, data return'),
  ('B10-CR-6', 'Subcontracting approval requirements must be specified', 'contractual', 'subcontracting', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Prior approval for material subcontracting'),

  -- Ongoing Monitoring
  ('B10-OM-1', 'Performance against SLAs must be monitored', 'ongoing_monitoring', 'performance', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Regular performance reporting'),
  ('B10-OM-2', 'Financial condition must be monitored on an ongoing basis', 'ongoing_monitoring', 'financial', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Annual financial review minimum'),
  ('B10-OM-3', 'Security posture must be continuously monitored', 'ongoing_monitoring', 'security', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Include vulnerability assessments'),
  ('B10-OM-4', 'Periodic reassessment of risk tier must be performed', 'ongoing_monitoring', 'reassessment', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low'], 'Based on tier: annual to triennial'),
  ('B10-OM-5', 'Incident tracking and analysis must be maintained', 'ongoing_monitoring', 'incidents', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Root cause analysis for significant incidents'),

  -- Business Continuity
  ('B10-BC-1', 'Business continuity plans must address third-party dependencies', 'business_continuity', 'planning', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Include in BIA and BCP'),
  ('B10-BC-2', 'Third-party BCP capabilities must be validated', 'business_continuity', 'validation', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Review test results, participate in exercises'),
  ('B10-BC-3', 'Alternative arrangements must be identified for critical services', 'business_continuity', 'alternatives', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Exit strategy for critical arrangements'),
  ('B10-BC-4', 'Recovery time objectives must be aligned', 'business_continuity', 'rto', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Third-party RTO must meet FRFI requirements'),

  -- Exit Strategy
  ('B10-ES-1', 'Exit strategy must be documented for material arrangements', 'exit_strategy', 'documentation', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Include transition plan, timeline'),
  ('B10-ES-2', 'Data portability must be ensured', 'exit_strategy', 'data', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Data format, transfer mechanisms'),
  ('B10-ES-3', 'Transition costs and timelines must be understood', 'exit_strategy', 'planning', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Financial and operational impacts'),

  -- OSFI Notification
  ('B10-ON-1', 'OSFI must be notified of material outsourcing arrangements', 'osfi_notification', 'reporting', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Pre-notification for certain arrangements'),
  ('B10-ON-2', 'Significant incidents must be reported to OSFI', 'osfi_notification', 'incidents', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Within prescribed timelines'),
  ('B10-ON-3', 'Material changes to arrangements must be notified', 'osfi_notification', 'changes', true, ARRAY['tier_5_critical', 'tier_4_high'], 'Scope changes, subcontracting'),

  -- Technology and Cyber
  ('B10-TC-1', 'Technology risk assessments must include third parties', 'technology_cyber', 'assessment', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Align with OSFI Technology Risk Management'),
  ('B10-TC-2', 'Cloud computing arrangements must follow OSFI guidance', 'technology_cyber', 'cloud', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Additional controls for cloud services'),
  ('B10-TC-3', 'Cybersecurity controls must be validated', 'technology_cyber', 'cyber', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Penetration testing, vulnerability scans'),
  ('B10-TC-4', 'Data residency requirements must be addressed', 'technology_cyber', 'data_residency', true, ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate'], 'Canadian data residency where applicable')

ON CONFLICT (requirement_code) DO UPDATE SET
  requirement_text = EXCLUDED.requirement_text,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  is_mandatory = EXCLUDED.is_mandatory,
  applies_to_tier = EXCLUDED.applies_to_tier,
  guidance_notes = EXCLUDED.guidance_notes,
  updated_at = now();

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_osfi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_osfi_requirements_updated_at ON osfi_b10_requirements;
CREATE TRIGGER update_osfi_requirements_updated_at
  BEFORE UPDATE ON osfi_b10_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_osfi_updated_at();

DROP TRIGGER IF EXISTS update_osfi_compliance_updated_at ON osfi_b10_compliance_status;
CREATE TRIGGER update_osfi_compliance_updated_at
  BEFORE UPDATE ON osfi_b10_compliance_status
  FOR EACH ROW
  EXECUTE FUNCTION update_osfi_updated_at();

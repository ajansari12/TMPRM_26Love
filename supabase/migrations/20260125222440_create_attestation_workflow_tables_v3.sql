/*
  # Attestation and Workflow Tables - Clean Install

  Drop existing partial tables and recreate properly.

  1. New Tables
    - `attestation_periods` - Attestation cycle management
    - `attestation_requirements` - Configurable attestation requirements
    - `attestation_submissions` - User attestation submissions
    - `attestation_responses` - Individual requirement responses
    - `workflow_configurations` - Approval workflow definitions
    - `workflow_instances` - Active workflow tracking
    - `workflow_approvals` - Individual approval decisions

  2. Security
    - RLS enabled on all tables
    - Role-based access policies
*/

-- Drop partial table from failed migration
DROP TABLE IF EXISTS workflow_approvals CASCADE;

-- Attestation Periods Table
CREATE TABLE IF NOT EXISTS attestation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type text NOT NULL,
  period_name text NOT NULL,
  description text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'open',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attestation Requirements Table
CREATE TABLE IF NOT EXISTS attestation_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES attestation_periods(id) ON DELETE CASCADE,
  requirement_code text NOT NULL,
  requirement_text text NOT NULL,
  description text,
  is_mandatory boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Attestation Submissions Table
CREATE TABLE IF NOT EXISTS attestation_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES attestation_periods(id) ON DELETE CASCADE NOT NULL,
  submitted_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  submitted_by_name text,
  business_unit text,
  submission_date timestamptz,
  status text DEFAULT 'draft',
  attestation_confirmed boolean DEFAULT false,
  attestation_text text DEFAULT 'I attest that the above responses are accurate and complete to the best of my knowledge.',
  attested_at timestamptz,
  attested_ip_address text,
  attested_user_agent text,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_name text,
  review_date timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attestation Responses Table
CREATE TABLE IF NOT EXISTS attestation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES attestation_submissions(id) ON DELETE CASCADE NOT NULL,
  requirement_id uuid REFERENCES attestation_requirements(id) ON DELETE CASCADE NOT NULL,
  response text NOT NULL,
  evidence_notes text,
  evidence_document_ids uuid[] DEFAULT '{}',
  linked_vendor_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow Configurations Table
CREATE TABLE IF NOT EXISTS workflow_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type text UNIQUE NOT NULL,
  workflow_name text NOT NULL,
  description text,
  trigger_conditions jsonb DEFAULT '{}',
  approval_chain jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow Instances Table
CREATE TABLE IF NOT EXISTS workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_config_id uuid REFERENCES workflow_configurations(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text,
  status text DEFAULT 'pending',
  current_step int DEFAULT 0,
  initiated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  initiated_by_name text,
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completion_notes text,
  created_at timestamptz DEFAULT now()
);

-- Workflow Approvals Table (now created after workflow_instances exists)
CREATE TABLE IF NOT EXISTS workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES workflow_instances(id) ON DELETE CASCADE NOT NULL,
  approver_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approver_name text,
  approver_role text,
  sequence_order int NOT NULL,
  status text DEFAULT 'pending',
  decision_at timestamptz,
  decision_notes text,
  delegated_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  delegated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attestation_submissions_period ON attestation_submissions(period_id);
CREATE INDEX IF NOT EXISTS idx_attestation_submissions_user ON attestation_submissions(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_attestation_responses_submission ON attestation_responses(submission_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_instance ON workflow_approvals(instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver ON workflow_approvals(approver_user_id);

-- Enable RLS
ALTER TABLE attestation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestation_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestation_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Read
CREATE POLICY "Authenticated users can read attestation_periods" ON attestation_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read attestation_requirements" ON attestation_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read attestation_submissions" ON attestation_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read attestation_responses" ON attestation_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read workflow_configurations" ON workflow_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read workflow_instances" ON workflow_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read workflow_approvals" ON workflow_approvals FOR SELECT TO authenticated USING (true);

-- RLS Policies - Write for attestation_periods
CREATE POLICY "Risk managers can insert attestation_periods" ON attestation_periods FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can update attestation_periods" ON attestation_periods FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can delete attestation_periods" ON attestation_periods FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

-- RLS Policies - Write for attestation_requirements
CREATE POLICY "Risk managers can insert attestation_requirements" ON attestation_requirements FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can update attestation_requirements" ON attestation_requirements FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can delete attestation_requirements" ON attestation_requirements FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

-- RLS Policies - Write for attestation_submissions
CREATE POLICY "Users can insert own attestation_submissions" ON attestation_submissions FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = submitted_by_user_id);
CREATE POLICY "Users can update own attestation_submissions" ON attestation_submissions FOR UPDATE TO authenticated 
  USING (auth.uid() = submitted_by_user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst')));

-- RLS Policies - Write for attestation_responses
CREATE POLICY "Users can insert attestation_responses" ON attestation_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update attestation_responses" ON attestation_responses FOR UPDATE TO authenticated USING (true);

-- RLS Policies - Write for workflow_configurations
CREATE POLICY "Risk managers can insert workflow_configurations" ON workflow_configurations FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can update workflow_configurations" ON workflow_configurations FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can delete workflow_configurations" ON workflow_configurations FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

-- RLS Policies - Write for workflow_instances
CREATE POLICY "Authorized users can insert workflow_instances" ON workflow_instances FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')));
CREATE POLICY "Authorized users can update workflow_instances" ON workflow_instances FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')));

-- RLS Policies - Write for workflow_approvals
CREATE POLICY "Approvers can insert workflow_approvals" ON workflow_approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Approvers can update own workflow_approvals" ON workflow_approvals FOR UPDATE TO authenticated 
  USING (approver_user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

-- Insert default workflow configurations
INSERT INTO workflow_configurations (workflow_type, workflow_name, description, trigger_conditions, approval_chain) VALUES
  ('vendor_onboarding', 'New Vendor Onboarding', 'Approval workflow for new vendor requests', 
   '{"all_new_vendors": true}',
   '[{"role": "vendor_owner", "label": "Business Owner"}, {"role": "risk_manager", "label": "Risk Manager"}]'),
  ('tier_1_assignment', 'Critical Tier Assignment', 'Approval for assigning Tier 1 (Critical) status',
   '{"tier": "tier_5_critical"}',
   '[{"role": "risk_manager", "label": "Risk Manager"}, {"role": "executive", "label": "Executive Sponsor"}]'),
  ('high_value_contract', 'High Value Contract', 'Approval for contracts over $1M',
   '{"contract_value_min": 1000000}',
   '[{"role": "vendor_owner", "label": "Business Owner"}, {"role": "compliance_analyst", "label": "Legal Review"}, {"role": "risk_manager", "label": "Risk Manager"}]'),
  ('tier_change', 'Vendor Tier Change', 'Approval for changing vendor tier classification',
   '{"any_tier_change": true}',
   '[{"role": "risk_manager", "label": "Risk Manager"}]')
ON CONFLICT (workflow_type) DO NOTHING;

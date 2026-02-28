/*
  # Create Supporting Entities

  1. New Tables
    - `due_diligence` - OSFI Annex 1 assessments
    - `contracts` - Contract management with OSFI Annex 2 provisions
    - `incidents` - Incident tracking and OSFI notification
    - `subcontractors` - Fourth-party risk tracking
    - `performance_reviews` - Vendor performance monitoring
    - `notifications` - System notifications
    - `audit_logs` - Immutable audit trail

  2. Security
    - Enable RLS on all tables
    - Role-based access policies
*/

-- Due Diligence Table
CREATE TABLE IF NOT EXISTS due_diligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  assessment_id uuid REFERENCES tiering_assessments(id) ON DELETE SET NULL,
  dd_type text DEFAULT 'initial',
  status text DEFAULT 'not_started',

  -- OSFI Annex 1 Factors (16 factors)
  experience_competence text,
  financial_strength text,
  regulatory_compliance text,
  reputation_risk text,
  risk_management_programs text,
  cyber_risk_management text,
  info_security_programs text,
  bcp_capability text,
  subcontractor_management text,
  concentration_impact text,
  geographic_risk text,
  substitutability text,
  portability text,
  insurance_coverage text,
  cultural_alignment text,
  political_legal_risk text,

  -- Document tracking
  financial_statements_uploaded boolean DEFAULT false,
  credit_report_uploaded boolean DEFAULT false,
  soc_report_uploaded boolean DEFAULT false,
  insurance_cert_uploaded boolean DEFAULT false,
  bcp_plan_uploaded boolean DEFAULT false,
  references_checked boolean DEFAULT false,
  sanctions_screened boolean DEFAULT false,
  adverse_media_checked boolean DEFAULT false,
  pii_assessment_completed boolean DEFAULT false,
  nda_signed boolean DEFAULT false,

  -- Determination
  final_rating text,
  conditions text,
  rejection_reason text,

  conducted_by text,
  completion_date date,
  next_due_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  contract_number text,
  title text NOT NULL,
  contract_type text,

  -- Dates
  effective_date date,
  expiry_date date,
  auto_renewal boolean DEFAULT false,
  notice_period_days int,

  -- Financial
  annual_value_cad decimal(15,2),
  total_value_cad decimal(15,2),

  -- OSFI B-10 Annex 2 Provisions (15 provisions)
  has_scope_definition boolean DEFAULT false,
  has_roles_responsibilities boolean DEFAULT false,
  has_subcontractor_provisions boolean DEFAULT false,
  has_pricing_terms boolean DEFAULT false,
  has_performance_measures boolean DEFAULT false,
  has_ownership_access boolean DEFAULT false,
  has_data_security boolean DEFAULT false,
  has_notification_requirements boolean DEFAULT false,
  has_dispute_resolution boolean DEFAULT false,
  has_regulatory_compliance boolean DEFAULT false,
  has_bcp_requirements boolean DEFAULT false,
  has_termination_provisions boolean DEFAULT false,
  has_insurance_requirements boolean DEFAULT false,
  has_audit_rights boolean DEFAULT false,
  has_osfi_access_clause boolean DEFAULT false,

  -- Legal review
  legal_review_status text,
  legal_reviewer text,
  legal_review_date date,
  legal_review_notes text,

  -- Status
  status text DEFAULT 'draft',
  contract_owner text,
  storage_location text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  incident_id text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,

  -- Classification
  incident_type text,
  severity text,
  impact_to_frfi text,

  -- Timeline
  detected_date timestamptz,
  reported_date timestamptz DEFAULT now(),
  contained_date timestamptz,
  resolved_date timestamptz,
  closed_date timestamptz,

  -- Status
  status text DEFAULT 'reported',

  -- Analysis
  root_cause text,
  remediation_actions text,
  lessons_learned text,
  preventive_measures text,

  -- OSFI Notification
  osfi_notifiable boolean DEFAULT false,
  osfi_notified boolean DEFAULT false,
  osfi_notification_date timestamptz,
  osfi_reference_number text,

  -- Assignment
  reporter text,
  assigned_to text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to generate incident_id
CREATE OR REPLACE FUNCTION generate_incident_id()
RETURNS text AS $$
DECLARE
  next_num int;
  year_str text;
  new_id text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN incident_id ~ '^INC-[0-9]{4}-[0-9]+$' THEN
        CAST(substring(incident_id from 'INC-[0-9]{4}-([0-9]+)') AS int)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM incidents
  WHERE incident_id LIKE 'INC-' || year_str || '-%';
  
  new_id := 'INC-' || year_str || '-' || lpad(next_num::text, 3, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate incident_id
CREATE OR REPLACE FUNCTION set_incident_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.incident_id IS NULL OR NEW.incident_id = '' THEN
    NEW.incident_id := generate_incident_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_incident_id ON incidents;
CREATE TRIGGER trigger_set_incident_id
  BEFORE INSERT ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION set_incident_id();

-- Subcontractors Table
CREATE TABLE IF NOT EXISTS subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  service_description text,
  country text,
  data_location text,
  criticality text,
  risk_rating text,
  has_data_access boolean DEFAULT false,
  data_types_accessed text,
  access_level text,
  status text DEFAULT 'pending_review',
  approved_date date,
  next_review_date date,
  concentration_concern boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Performance Reviews Table
CREATE TABLE IF NOT EXISTS performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  review_period_start date NOT NULL,
  review_period_end date NOT NULL,
  review_type text,
  status text DEFAULT 'scheduled',

  -- Metrics
  sla_compliance_percentage decimal(5,2),
  availability_percentage decimal(5,2),
  incident_count int,
  issue_count int,
  response_time_avg_hours decimal(8,2),

  -- Qualitative assessment
  service_quality text,
  communication text,
  responsiveness text,
  innovation text,

  -- Overall
  overall_rating text,
  meeting_expectations boolean,
  action_required boolean DEFAULT false,
  improvement_plan_required boolean DEFAULT false,

  strengths text,
  areas_for_improvement text,
  action_items text,
  reviewer text,
  review_date date,
  next_review_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text,
  priority text DEFAULT 'medium',
  related_entity_type text,
  related_entity_id text,
  action_url text,
  target_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  target_role text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Audit Logs Table (immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  entity_name text,
  changes jsonb,
  ip_address text,
  user_agent text,
  notes text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_due_diligence_vendor_id ON due_diligence(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor_id ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_expiry_date ON contracts(expiry_date);
CREATE INDEX IF NOT EXISTS idx_incidents_vendor_id ON incidents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_subcontractors_vendor_id ON subcontractors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_vendor_id ON performance_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE due_diligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for all tables
CREATE POLICY "Authenticated users can read due_diligence" ON due_diligence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized users can manage due_diligence" ON due_diligence FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst'))
);

CREATE POLICY "Authenticated users can read contracts" ON contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized users can manage contracts" ON contracts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner'))
);

CREATE POLICY "Authenticated users can read incidents" ON incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert incidents" ON incidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authorized users can update incidents" ON incidents FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner'))
);

CREATE POLICY "Authenticated users can read subcontractors" ON subcontractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized users can manage subcontractors" ON subcontractors FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner'))
);

CREATE POLICY "Authenticated users can read performance_reviews" ON performance_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized users can manage performance_reviews" ON performance_reviews FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'vendor_owner'))
);

CREATE POLICY "Users can read their notifications" ON notifications FOR SELECT TO authenticated USING (
  target_user_id = auth.uid() OR target_role IN (SELECT role FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE TO authenticated USING (target_user_id = auth.uid());

CREATE POLICY "Authenticated users can read audit_logs" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

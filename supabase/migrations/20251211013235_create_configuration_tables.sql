/*
  # Create Configuration and Tracking Tables

  1. New Tables
    - `kri_thresholds` - Configurable KRI threshold settings
      - Stores green/amber/red thresholds for each KRI
      - Enables/disables individual KRIs
      - Notification preferences per KRI
    
    - `kri_history` - Daily KRI snapshots for trend analysis
      - Stores calculated KRI values daily
      - Enables historical trend charts
      - Used by KRI calculator Edge Function
    
    - `category_weights` - Service category risk weights
      - Impact factor weights (6 factors)
      - Likelihood factor weights (6 factors)
      - Per-category customization
    
    - `lifecycle_config` - Lifecycle stage configuration
      - Stage display names and order
      - Required actions per stage
      - Auto-advance triggers
    
    - `report_templates` - Saved report configurations
      - User-created report presets
      - Export format preferences
    
    - `scheduled_jobs` - Edge Function job tracking
      - Tracks execution history
      - Stores last run status
    
    - `contract_reviews` - Legal review workflow
      - Review assignments and status
      - Review notes and conditions
    
    - `user_roles` - Role permissions matrix
      - Defines permissions per role
      - Used for access control

  2. Security
    - Enable RLS on all tables
    - Appropriate access policies for each table
*/

-- KRI Thresholds Table
CREATE TABLE IF NOT EXISTS kri_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kri_code text UNIQUE NOT NULL,
  kri_name text NOT NULL,
  description text,
  
  green_min decimal(10,2),
  green_max decimal(10,2),
  amber_min decimal(10,2),
  amber_max decimal(10,2),
  red_min decimal(10,2),
  red_max decimal(10,2),
  
  threshold_type text DEFAULT 'percentage',
  is_higher_better boolean DEFAULT false,
  is_enabled boolean DEFAULT true,
  notify_on_amber boolean DEFAULT false,
  notify_on_red boolean DEFAULT true,
  
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default KRI thresholds
INSERT INTO kri_thresholds (kri_code, kri_name, description, green_min, green_max, amber_min, amber_max, red_min, red_max, threshold_type, is_higher_better, display_order) VALUES
('KRI001', 'Critical Vendor Concentration', 'Percentage of total vendors classified as Tier 5 Critical', 0, 10, 10.01, 20, 20.01, 100, 'percentage', false, 1),
('KRI002', 'Assessment Completion Rate', 'Percentage of required assessments completed on time', 90, 100, 70, 89.99, 0, 69.99, 'percentage', true, 2),
('KRI003', 'Due Diligence Compliance', 'Percentage of vendors with completed due diligence', 90, 100, 70, 89.99, 0, 69.99, 'percentage', true, 3),
('KRI004', 'Contract Expiry Alert', 'Number of contracts expiring within 90 days', 0, 5, 6, 15, 16, 1000, 'count', false, 4),
('KRI005', 'Open Incident Count', 'Number of open vendor-related incidents', 0, 3, 4, 10, 11, 1000, 'count', false, 5),
('KRI006', 'Critical Incident Rate', 'Critical incidents as percentage of total', 0, 5, 5.01, 15, 15.01, 100, 'percentage', false, 6),
('KRI007', 'Subcontractor Oversight', 'Percentage of subcontractors with approved status', 80, 100, 60, 79.99, 0, 59.99, 'percentage', true, 7),
('KRI008', 'Performance SLA Compliance', 'Average SLA compliance across monitored vendors', 95, 100, 85, 94.99, 0, 84.99, 'percentage', true, 8)
ON CONFLICT (kri_code) DO NOTHING;

-- KRI History Table
CREATE TABLE IF NOT EXISTS kri_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  kri_code text NOT NULL REFERENCES kri_thresholds(kri_code) ON DELETE CASCADE,
  
  calculated_value decimal(10,2) NOT NULL,
  previous_value decimal(10,2),
  change_amount decimal(10,2),
  change_direction text,
  
  status text NOT NULL,
  threshold_breached boolean DEFAULT false,
  
  details jsonb,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(recorded_date, kri_code)
);

-- Category Weights Table
CREATE TABLE IF NOT EXISTS category_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text UNIQUE NOT NULL,
  category_display_name text NOT NULL,
  
  weight_criticality decimal(4,3) DEFAULT 0.200,
  weight_product_type decimal(4,3) DEFAULT 0.150,
  weight_dependency decimal(4,3) DEFAULT 0.200,
  weight_financial_resilience decimal(4,3) DEFAULT 0.150,
  weight_strategic_reputational decimal(4,3) DEFAULT 0.150,
  weight_data_sensitivity decimal(4,3) DEFAULT 0.150,
  
  weight_concentration decimal(4,3) DEFAULT 0.150,
  weight_access_level decimal(4,3) DEFAULT 0.200,
  weight_subcontractor decimal(4,3) DEFAULT 0.150,
  weight_legal_regulatory decimal(4,3) DEFAULT 0.200,
  weight_operational_maturity decimal(4,3) DEFAULT 0.150,
  weight_other_risks decimal(4,3) DEFAULT 0.150,
  
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Insert default category weights
INSERT INTO category_weights (category, category_display_name) VALUES
('facilities_real_estate', 'Facilities & Real Estate'),
('financial_insurance_services', 'Financial & Insurance Services'),
('it_telecom_services', 'IT & Telecom Services'),
('legal_audit_consulting', 'Legal, Audit & Consulting Services'),
('office_support_supplies', 'Office Support & Supplies'),
('physical_security', 'Physical Security'),
('cloud_data_services', 'Cloud & Data Services'),
('exchange_clearing_services', 'Exchange & Clearing Services'),
('human_resources_services', 'Human Resources Services'),
('info_cyber_security', 'Information & Cyber Security'),
('transport_delivery', 'Transport & Delivery'),
('marketing_services', 'Marketing Services'),
('external_portals_platforms', 'External Portals & Platforms'),
('data_research_subscription', 'Data & Research Subscription'),
('other', 'Other')
ON CONFLICT (category) DO NOTHING;

-- Lifecycle Config Table
CREATE TABLE IF NOT EXISTS lifecycle_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code text UNIQUE NOT NULL,
  stage_name text NOT NULL,
  description text,
  display_order int NOT NULL,
  
  is_active boolean DEFAULT true,
  required_actions text[],
  auto_advance_enabled boolean DEFAULT false,
  auto_advance_trigger text,
  
  notification_on_enter boolean DEFAULT true,
  notification_on_exit boolean DEFAULT false,
  days_until_escalation int,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default lifecycle stages
INSERT INTO lifecycle_config (stage_code, stage_name, description, display_order, required_actions) VALUES
('identification', 'Identification', 'Initial vendor identification and basic information capture', 1, ARRAY['Complete vendor profile', 'Assign vendor owner']),
('tiering', 'Tiering', 'Risk tiering assessment to determine vendor criticality', 2, ARRAY['Complete tiering assessment', 'Approve tier assignment']),
('due_diligence', 'Due Diligence', 'Comprehensive due diligence based on tier requirements', 3, ARRAY['Complete due diligence checklist', 'Document review', 'Approve due diligence']),
('contracting', 'Contracting', 'Contract negotiation and legal review', 4, ARRAY['Draft contract', 'Legal review', 'Execute contract']),
('onboarding', 'Onboarding', 'Vendor onboarding and integration', 5, ARRAY['Technical setup', 'Access provisioning', 'Training completion']),
('monitoring', 'Monitoring', 'Ongoing vendor monitoring and oversight', 6, ARRAY['Regular performance reviews', 'Incident monitoring', 'Risk reassessment']),
('performance_review', 'Performance Review', 'Periodic performance evaluation', 7, ARRAY['Conduct performance review', 'Document findings', 'Address issues']),
('offboarding', 'Offboarding', 'Vendor relationship termination process', 8, ARRAY['Data retrieval', 'Access revocation', 'Final settlement']),
('terminated', 'Terminated', 'Vendor relationship has been terminated', 9, ARRAY['Archive records', 'Lessons learned'])
ON CONFLICT (stage_code) DO NOTHING;

-- Report Templates Table
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  report_type text NOT NULL,
  
  config jsonb NOT NULL DEFAULT '{}',
  
  include_sections text[],
  date_range_type text DEFAULT 'custom',
  default_format text DEFAULT 'pdf',
  
  is_default boolean DEFAULT false,
  is_shared boolean DEFAULT false,
  
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Scheduled Jobs Table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text UNIQUE NOT NULL,
  job_type text NOT NULL,
  description text,
  
  schedule_cron text,
  is_enabled boolean DEFAULT true,
  
  last_run_at timestamptz,
  last_run_status text,
  last_run_duration_ms int,
  last_run_result jsonb,
  last_error text,
  
  next_run_at timestamptz,
  run_count int DEFAULT 0,
  error_count int DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default scheduled jobs
INSERT INTO scheduled_jobs (job_name, job_type, description, schedule_cron) VALUES
('expiration_checker', 'expiration', 'Check for expiring contracts, assessments, and due diligence', '0 6 * * *'),
('kri_calculator', 'kri', 'Calculate and store daily KRI values', '0 7 * * *'),
('notification_dispatcher', 'notification', 'Send digest and pending notifications', '0 8 * * *')
ON CONFLICT (job_name) DO NOTHING;

-- Contract Reviews Table
CREATE TABLE IF NOT EXISTS contract_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  
  review_type text DEFAULT 'initial',
  status text DEFAULT 'pending',
  priority text DEFAULT 'normal',
  
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  started_at timestamptz,
  completed_at timestamptz,
  due_date date,
  
  legal_notes text,
  conditions text,
  recommendations text,
  
  annex2_compliance_score int,
  provisions_missing text[],
  risk_flags text[],
  
  decision text,
  decision_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decision_date timestamptz,
  decision_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Role Permissions Table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  is_granted boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(role, permission)
);

-- Insert default role permissions
INSERT INTO role_permissions (role, permission, is_granted) VALUES
('risk_manager', 'vendors.create', true),
('risk_manager', 'vendors.edit', true),
('risk_manager', 'vendors.delete', true),
('risk_manager', 'vendors.view', true),
('risk_manager', 'assessments.create', true),
('risk_manager', 'assessments.approve', true),
('risk_manager', 'contracts.manage', true),
('risk_manager', 'incidents.manage', true),
('risk_manager', 'settings.manage', true),
('risk_manager', 'users.manage', true),
('risk_manager', 'reports.export', true),

('vendor_owner', 'vendors.create', true),
('vendor_owner', 'vendors.edit', true),
('vendor_owner', 'vendors.view', true),
('vendor_owner', 'assessments.create', true),
('vendor_owner', 'contracts.manage', true),
('vendor_owner', 'incidents.report', true),
('vendor_owner', 'reports.export', true),

('compliance_analyst', 'vendors.view', true),
('compliance_analyst', 'assessments.create', true),
('compliance_analyst', 'assessments.approve', true),
('compliance_analyst', 'contracts.view', true),
('compliance_analyst', 'incidents.view', true),
('compliance_analyst', 'reports.export', true),

('auditor', 'vendors.view', true),
('auditor', 'assessments.view', true),
('auditor', 'contracts.view', true),
('auditor', 'incidents.view', true),
('auditor', 'audit_logs.view', true),
('auditor', 'reports.export', true),

('executive', 'vendors.view', true),
('executive', 'assessments.view', true),
('executive', 'reports.view', true),
('executive', 'reports.export', true),
('executive', 'kri.view', true),

('business_user', 'vendors.view', true),
('business_user', 'incidents.report', true)
ON CONFLICT (role, permission) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_kri_history_date ON kri_history(recorded_date);
CREATE INDEX IF NOT EXISTS idx_kri_history_code ON kri_history(kri_code);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract ON contract_reviews(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_status ON contract_reviews(status);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_assigned ON contract_reviews(assigned_to);
CREATE INDEX IF NOT EXISTS idx_report_templates_user ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Enable RLS
ALTER TABLE kri_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE kri_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifecycle_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- KRI Thresholds: All authenticated can read, risk managers can modify
CREATE POLICY "Authenticated users can read kri_thresholds" ON kri_thresholds 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Risk managers can manage kri_thresholds" ON kri_thresholds 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager')
  );

-- KRI History: All authenticated can read, system insert only
CREATE POLICY "Authenticated users can read kri_history" ON kri_history 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert kri_history" ON kri_history 
  FOR INSERT TO authenticated WITH CHECK (true);

-- Category Weights: All can read, risk managers can modify
CREATE POLICY "Authenticated users can read category_weights" ON category_weights 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Risk managers can manage category_weights" ON category_weights 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager')
  );

-- Lifecycle Config: All can read, risk managers can modify
CREATE POLICY "Authenticated users can read lifecycle_config" ON lifecycle_config 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Risk managers can manage lifecycle_config" ON lifecycle_config 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager')
  );

-- Report Templates: Users can read shared or own, manage own
CREATE POLICY "Users can read report_templates" ON report_templates 
  FOR SELECT TO authenticated USING (is_shared = true OR created_by = auth.uid());
CREATE POLICY "Users can manage own report_templates" ON report_templates 
  FOR ALL TO authenticated USING (created_by = auth.uid());

-- Scheduled Jobs: All can read, risk managers can modify
CREATE POLICY "Authenticated users can read scheduled_jobs" ON scheduled_jobs 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Risk managers can manage scheduled_jobs" ON scheduled_jobs 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager')
  );

-- Contract Reviews: All can read, legal and risk managers can manage
CREATE POLICY "Authenticated users can read contract_reviews" ON contract_reviews 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized users can manage contract_reviews" ON contract_reviews 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst'))
  );

-- Role Permissions: All can read
CREATE POLICY "Authenticated users can read role_permissions" ON role_permissions 
  FOR SELECT TO authenticated USING (true);

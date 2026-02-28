/*
  # Document Storage and Concentration Risk Tables

  1. New Tables
    - `document_types` - Reference table for document categories
    - `vendor_documents` - Document storage metadata (Supabase Storage)
    - `concentration_snapshots` - Point-in-time concentration data
    - `concentration_thresholds` - Configurable concentration limits

  2. Security
    - RLS enabled on all tables
    - Role-based access policies
*/

-- Document Types Reference Table
CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  default_expiry_months int,
  required_for_tiers text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Vendor Documents Table (Supabase Storage metadata)
CREATE TABLE IF NOT EXISTS vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  document_type_id uuid REFERENCES document_types(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_size int,
  mime_type text,
  storage_path text NOT NULL,
  version int DEFAULT 1,
  version_notes text,
  is_current boolean DEFAULT true,
  expiry_date date,
  linked_due_diligence_id uuid REFERENCES due_diligence(id) ON DELETE SET NULL,
  linked_contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_by_name text,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Concentration Snapshots Table
CREATE TABLE IF NOT EXISTS concentration_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  snapshot_type text NOT NULL,
  dimension_key text NOT NULL,
  dimension_value text NOT NULL,
  amount numeric(15,2) DEFAULT 0,
  percentage numeric(5,2) DEFAULT 0,
  vendor_count int DEFAULT 0,
  vendor_ids uuid[] DEFAULT '{}',
  is_breach boolean DEFAULT false,
  breach_level text,
  created_at timestamptz DEFAULT now()
);

-- Concentration Thresholds Table
CREATE TABLE IF NOT EXISTS concentration_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_type text UNIQUE NOT NULL,
  threshold_name text NOT NULL,
  description text,
  warning_level numeric(5,2) NOT NULL,
  critical_level numeric(5,2) NOT NULL,
  measurement_unit text DEFAULT 'percentage',
  effective_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor ON vendor_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_type ON vendor_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_expiry ON vendor_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_concentration_snapshots_date ON concentration_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_concentration_snapshots_type ON concentration_snapshots(snapshot_type);

-- Enable RLS
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE concentration_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE concentration_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read document_types" ON document_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read vendor_documents" ON vendor_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read concentration_snapshots" ON concentration_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read concentration_thresholds" ON concentration_thresholds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Risk managers can insert document_types" ON document_types FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can update document_types" ON document_types FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can delete document_types" ON document_types FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

CREATE POLICY "Authorized users can insert vendor_documents" ON vendor_documents FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')));
CREATE POLICY "Authorized users can update vendor_documents" ON vendor_documents FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')));
CREATE POLICY "Risk managers can delete vendor_documents" ON vendor_documents FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

CREATE POLICY "System can insert concentration_snapshots" ON concentration_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Risk managers can insert concentration_thresholds" ON concentration_thresholds FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can update concentration_thresholds" ON concentration_thresholds FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can delete concentration_thresholds" ON concentration_thresholds FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

-- Insert default document types
INSERT INTO document_types (code, name, description, category, default_expiry_months, required_for_tiers, display_order) VALUES
  ('SOC2_TYPE2', 'SOC 2 Type II Report', 'Service Organization Control 2 Type II audit report', 'compliance', 12, '{"tier_5_critical","tier_4_high"}', 1),
  ('SOC1_TYPE2', 'SOC 1 Type II Report', 'Service Organization Control 1 Type II audit report', 'compliance', 12, '{"tier_5_critical"}', 2),
  ('ISO27001', 'ISO 27001 Certificate', 'Information security management system certification', 'compliance', 36, '{"tier_5_critical","tier_4_high"}', 3),
  ('BCP_PLAN', 'Business Continuity Plan', 'Vendor business continuity and disaster recovery plan', 'operational', 12, '{"tier_5_critical","tier_4_high"}', 4),
  ('DR_PLAN', 'Disaster Recovery Plan', 'Detailed disaster recovery procedures', 'operational', 12, '{"tier_5_critical"}', 5),
  ('INSURANCE', 'Certificate of Insurance', 'Evidence of insurance coverage', 'financial', 12, '{"tier_5_critical","tier_4_high","tier_3_moderate"}', 6),
  ('FINANCIALS', 'Financial Statements', 'Audited annual financial statements', 'financial', 12, '{"tier_5_critical","tier_4_high"}', 7),
  ('PENTEST', 'Penetration Test Report', 'Third-party penetration testing results', 'security', 12, '{"tier_5_critical","tier_4_high"}', 8),
  ('CONTRACT', 'Executed Contract', 'Fully executed contract document', 'legal', NULL, '{}', 9),
  ('AMENDMENT', 'Contract Amendment', 'Contract modification or amendment', 'legal', NULL, '{}', 10),
  ('SLA', 'Service Level Agreement', 'Service level agreement document', 'legal', NULL, '{}', 11),
  ('NDA', 'Non-Disclosure Agreement', 'Confidentiality agreement', 'legal', 24, '{}', 12),
  ('MSA', 'Master Services Agreement', 'Master services agreement', 'legal', NULL, '{}', 13),
  ('PRIVACY_ASSESSMENT', 'Privacy Impact Assessment', 'Data privacy and protection assessment', 'compliance', 24, '{"tier_5_critical","tier_4_high"}', 14),
  ('VENDOR_QUESTIONNAIRE', 'Vendor Security Questionnaire', 'Completed security assessment questionnaire', 'security', 12, '{"tier_5_critical","tier_4_high","tier_3_moderate"}', 15)
ON CONFLICT (code) DO NOTHING;

-- Insert default concentration thresholds
INSERT INTO concentration_thresholds (threshold_type, threshold_name, description, warning_level, critical_level, measurement_unit) VALUES
  ('single_vendor', 'Single Vendor Spend', 'Maximum spend with any single vendor', 5, 10, 'percentage'),
  ('service_category', 'Service Category Concentration', 'Maximum spend in any service category', 20, 35, 'percentage'),
  ('geographic', 'Geographic Concentration', 'Maximum spend in any single country', 30, 50, 'percentage'),
  ('shared_subcontractor', 'Shared Subcontractor Count', 'Number of vendors sharing same subcontractor', 3, 5, 'count')
ON CONFLICT (threshold_type) DO NOTHING;

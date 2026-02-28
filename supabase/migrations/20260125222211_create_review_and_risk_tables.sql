/*
  # OSFI B-10 Compliance - Review and Risk Appetite Tables

  1. New Tables
    - `review_schedules` - Automated vendor review scheduling
    - `review_notifications` - Review reminder notifications  
    - `review_completions` - Review completion records with attestation
    - `risk_appetite_metrics` - Configurable risk appetite thresholds
    - `risk_appetite_history` - Audit trail for threshold changes

  2. Security
    - RLS enabled on all tables
    - Role-based access policies
*/

-- Review Schedules Table
CREATE TABLE IF NOT EXISTS review_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  review_type text NOT NULL DEFAULT 'periodic',
  frequency_days int NOT NULL,
  last_review_date date,
  next_review_date date NOT NULL,
  responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  escalation_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  auto_generated boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Review Notifications Table
CREATE TABLE IF NOT EXISTS review_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  schedule_id uuid REFERENCES review_schedules(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  days_before_due int,
  sent_at timestamptz DEFAULT now(),
  recipient_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_email text,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Review Completions Table (with attestation)
CREATE TABLE IF NOT EXISTS review_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  schedule_id uuid REFERENCES review_schedules(id) ON DELETE SET NULL,
  review_type text NOT NULL,
  review_date date NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  reviewer_name text,
  findings text,
  tier_change_recommended boolean DEFAULT false,
  recommended_tier text,
  follow_up_actions text,
  attestation_confirmed boolean DEFAULT false,
  attestation_text text DEFAULT 'I confirm this review is complete and accurate, and all findings have been properly documented.',
  attested_at timestamptz,
  attested_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  attested_by_name text,
  attested_ip_address text,
  attested_user_agent text,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

-- Risk Appetite Metrics Table
CREATE TABLE IF NOT EXISTS risk_appetite_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text UNIQUE NOT NULL,
  metric_name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  green_max numeric(10,2),
  amber_max numeric(10,2),
  measurement_unit text DEFAULT 'count',
  effective_date date DEFAULT CURRENT_DATE,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  is_active boolean DEFAULT true,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Risk Appetite History Table
CREATE TABLE IF NOT EXISTS risk_appetite_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id uuid REFERENCES risk_appetite_metrics(id) ON DELETE CASCADE NOT NULL,
  previous_green_max numeric(10,2),
  previous_amber_max numeric(10,2),
  new_green_max numeric(10,2),
  new_amber_max numeric(10,2),
  change_reason text,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changed_by_name text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_review_schedules_vendor ON review_schedules(vendor_id);
CREATE INDEX IF NOT EXISTS idx_review_schedules_next_date ON review_schedules(next_review_date);
CREATE INDEX IF NOT EXISTS idx_review_notifications_vendor ON review_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_review_completions_vendor ON review_completions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_metrics_code ON risk_appetite_metrics(metric_code);

-- Enable RLS
ALTER TABLE review_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_appetite_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_appetite_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read review_schedules" ON review_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read review_notifications" ON review_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read review_completions" ON review_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read risk_appetite_metrics" ON risk_appetite_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read risk_appetite_history" ON risk_appetite_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can manage review_schedules" ON review_schedules FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst')));
CREATE POLICY "Authorized users can update review_schedules" ON review_schedules FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst')));
CREATE POLICY "Authorized users can delete review_schedules" ON review_schedules FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst')));

CREATE POLICY "Authorized users can insert review_notifications" ON review_notifications FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst')));

CREATE POLICY "Authorized users can insert review_completions" ON review_completions FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')));
CREATE POLICY "Authorized users can update review_completions" ON review_completions FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst', 'vendor_owner')));

CREATE POLICY "Risk managers can insert risk_appetite_metrics" ON risk_appetite_metrics FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can update risk_appetite_metrics" ON risk_appetite_metrics FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can delete risk_appetite_metrics" ON risk_appetite_metrics FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

CREATE POLICY "System can insert risk_appetite_history" ON risk_appetite_history FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default risk appetite metrics
INSERT INTO risk_appetite_metrics (metric_code, metric_name, description, category, green_max, amber_max, measurement_unit, display_order) VALUES
  ('OVERDUE_REVIEWS', 'Overdue Vendor Reviews', 'Number of vendor reviews past their due date', 'operational', 0, 3, 'count', 1),
  ('CRITICAL_CONCENTRATION', 'Critical Vendor Concentration', 'Percentage of spend with critical vendors', 'concentration', 15, 25, 'percentage', 2),
  ('SINGLE_VENDOR_SPEND', 'Single Vendor Spend', 'Maximum spend percentage with any single vendor', 'concentration', 5, 10, 'percentage', 3),
  ('ASSESSMENT_COMPLETION', 'Assessment Completion Rate', 'Percentage of required assessments completed', 'compliance', 95, 80, 'percentage', 4),
  ('CONTRACT_EXPIRY_90D', 'Contracts Expiring in 90 Days', 'Number of contracts expiring within 90 days', 'operational', 3, 5, 'count', 5),
  ('INCIDENT_RESOLUTION_CRITICAL', 'Critical Incident Resolution Time', 'Hours to resolve critical incidents', 'operational', 4, 24, 'hours', 6),
  ('INCIDENT_RESOLUTION_HIGH', 'High Incident Resolution Time', 'Hours to resolve high severity incidents', 'operational', 24, 72, 'hours', 7),
  ('DD_COMPLETION', 'Due Diligence Completion Rate', 'Percentage of required due diligence completed', 'compliance', 90, 75, 'percentage', 8),
  ('DOCUMENT_COMPLIANCE', 'Document Compliance Rate', 'Percentage of required documents current', 'compliance', 95, 80, 'percentage', 9),
  ('TIER1_NO_BCP', 'Critical Vendors without BCP', 'Number of Tier 1 vendors without current BCP', 'compliance', 0, 1, 'count', 10)
ON CONFLICT (metric_code) DO NOTHING;

-- Create function to auto-calculate next review date based on tier
CREATE OR REPLACE FUNCTION calculate_next_review_date(vendor_tier text, from_date date DEFAULT CURRENT_DATE)
RETURNS date AS $$
BEGIN
  RETURN CASE vendor_tier
    WHEN 'tier_5_critical' THEN from_date + INTERVAL '90 days'
    WHEN 'tier_4_high' THEN from_date + INTERVAL '180 days'
    WHEN 'tier_3_moderate' THEN from_date + INTERVAL '365 days'
    WHEN 'tier_2_low' THEN from_date + INTERVAL '730 days'
    WHEN 'tier_1_informational' THEN from_date + INTERVAL '730 days'
    ELSE from_date + INTERVAL '365 days'
  END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update vendor next_review_date when tier changes
CREATE OR REPLACE FUNCTION update_vendor_review_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier OR NEW.last_review_date IS DISTINCT FROM OLD.last_review_date THEN
    NEW.next_review_date := calculate_next_review_date(NEW.tier, COALESCE(NEW.last_review_date, CURRENT_DATE));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_review_date ON vendors;
CREATE TRIGGER trigger_update_vendor_review_date
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_review_date();

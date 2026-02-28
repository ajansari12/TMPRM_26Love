/*
  # OSFI Notification Tables

  1. New Tables
    - `osfi_notification_templates` - OSFI notification templates
    - `osfi_notifications` - OSFI regulatory notifications tracking

  2. Incident Table Updates
    - Add OSFI notification tracking fields

  3. Security
    - RLS enabled
    - Role-based access
*/

-- OSFI Notification Templates Table
CREATE TABLE IF NOT EXISTS osfi_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code text UNIQUE NOT NULL,
  template_name text NOT NULL,
  description text,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  notification_deadline_hours int DEFAULT 72,
  incident_types text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- OSFI Notifications Table
CREATE TABLE IF NOT EXISTS osfi_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES osfi_notification_templates(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  status text DEFAULT 'draft',
  subject text NOT NULL,
  body text NOT NULL,
  notification_deadline timestamptz,
  prepared_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  prepared_by_name text,
  prepared_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by_name text,
  approved_at timestamptz,
  approval_notes text,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  osfi_reference_number text,
  response_received_at timestamptz,
  response_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add OSFI notification fields to incidents if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'osfi_notification_deadline') THEN
    ALTER TABLE incidents ADD COLUMN osfi_notification_deadline timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'notification_status') THEN
    ALTER TABLE incidents ADD COLUMN notification_status text DEFAULT 'not_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'customers_affected') THEN
    ALTER TABLE incidents ADD COLUMN customers_affected int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'service_outage_hours') THEN
    ALTER TABLE incidents ADD COLUMN service_outage_hours numeric(8,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'involves_regulatory_data') THEN
    ALTER TABLE incidents ADD COLUMN involves_regulatory_data boolean DEFAULT false;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_osfi_notifications_incident ON osfi_notifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_osfi_notifications_status ON osfi_notifications(status);

-- Enable RLS
ALTER TABLE osfi_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE osfi_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read osfi_notification_templates" ON osfi_notification_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read osfi_notifications" ON osfi_notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Risk managers can insert osfi_notification_templates" ON osfi_notification_templates FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can update osfi_notification_templates" ON osfi_notification_templates FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));
CREATE POLICY "Risk managers can delete osfi_notification_templates" ON osfi_notification_templates FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'risk_manager'));

CREATE POLICY "Authorized users can insert osfi_notifications" ON osfi_notifications FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst')));
CREATE POLICY "Authorized users can update osfi_notifications" ON osfi_notifications FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('risk_manager', 'compliance_analyst')));

-- Insert default OSFI notification templates
INSERT INTO osfi_notification_templates (template_code, template_name, description, subject_template, body_template, notification_deadline_hours, incident_types) VALUES
  ('CYBER_INCIDENT', 'Cyber Security Incident', 'Template for cyber security incident notifications', 
   'Technology and Cyber Security Incident Notification - {{incident_id}}',
   'Dear OSFI,

This notification is submitted pursuant to OSFI Guideline B-10 regarding a technology and cyber security incident.

Incident ID: {{incident_id}}
Date Detected: {{detected_date}}
Third-Party Provider: {{vendor_name}}

Description:
{{description}}

Impact Assessment:
{{impact_assessment}}

Remediation Actions:
{{remediation_actions}}

We will provide updates as the situation develops.

Regards,
{{submitter_name}}
{{organization_name}}',
   24, '{"data_breach","cyber_attack","ransomware","unauthorized_access"}'),
  
  ('SERVICE_DISRUPTION', 'Material Service Disruption', 'Template for service disruption notifications',
   'Material Third-Party Service Disruption Notification - {{incident_id}}',
   'Dear OSFI,

This notification is submitted pursuant to OSFI Guideline B-10 regarding a material service disruption with a third-party service provider.

Incident ID: {{incident_id}}
Date Detected: {{detected_date}}
Third-Party Provider: {{vendor_name}}
Service Affected: {{service_description}}

Description:
{{description}}

Duration: {{outage_duration}}
Customers Affected: {{customers_affected}}

Contingency Measures Activated:
{{contingency_measures}}

Expected Resolution:
{{expected_resolution}}

Regards,
{{submitter_name}}
{{organization_name}}',
   72, '{"service_outage","system_failure","vendor_bankruptcy"}'),

  ('DATA_BREACH', 'Data Breach Notification', 'Template for data breach notifications',
   'Data Breach Notification - Third-Party Provider - {{incident_id}}',
   'Dear OSFI,

This notification is submitted pursuant to OSFI Guideline B-10 and applicable privacy legislation regarding a data breach involving a third-party service provider.

Incident ID: {{incident_id}}
Date Detected: {{detected_date}}
Third-Party Provider: {{vendor_name}}

Nature of Breach:
{{description}}

Data Types Affected:
{{data_types}}

Number of Records/Individuals Affected:
{{records_affected}}

Containment Actions:
{{containment_actions}}

Customer Notification Plan:
{{customer_notification}}

Regards,
{{submitter_name}}
{{organization_name}}',
   72, '{"data_breach","privacy_breach"}')
ON CONFLICT (template_code) DO NOTHING;

-- Create function to auto-flag OSFI notifiable incidents
CREATE OR REPLACE FUNCTION check_osfi_notifiable()
RETURNS TRIGGER AS $$
DECLARE
  vendor_tier text;
BEGIN
  SELECT tier INTO vendor_tier FROM vendors WHERE id = NEW.vendor_id;
  
  IF NEW.severity = 'critical' AND NEW.incident_type IN ('data_breach', 'cyber_attack', 'ransomware', 'unauthorized_access', 'Security Breach') THEN
    NEW.osfi_notifiable := true;
    NEW.osfi_notification_deadline := COALESCE(NEW.detected_date, now()) + INTERVAL '24 hours';
    NEW.notification_status := 'pending';
  ELSIF NEW.severity = 'critical' AND COALESCE(NEW.service_outage_hours, 0) > 4 AND vendor_tier = 'tier_5_critical' THEN
    NEW.osfi_notifiable := true;
    NEW.osfi_notification_deadline := COALESCE(NEW.detected_date, now()) + INTERVAL '72 hours';
    NEW.notification_status := 'pending';
  ELSIF COALESCE(NEW.customers_affected, 0) > 1000 THEN
    NEW.osfi_notifiable := true;
    NEW.osfi_notification_deadline := COALESCE(NEW.detected_date, now()) + INTERVAL '72 hours';
    NEW.notification_status := 'pending';
  ELSIF NEW.involves_regulatory_data = true AND NEW.incident_type IN ('data_breach', 'privacy_breach', 'Data Loss') THEN
    NEW.osfi_notifiable := true;
    NEW.osfi_notification_deadline := COALESCE(NEW.detected_date, now()) + INTERVAL '72 hours';
    NEW.notification_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_osfi_notifiable ON incidents;
CREATE TRIGGER trigger_check_osfi_notifiable
  BEFORE INSERT OR UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION check_osfi_notifiable();

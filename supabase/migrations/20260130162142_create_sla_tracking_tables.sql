/*
  # Create SLA Performance Tracking Tables

  1. New Tables
    - `vendor_slas`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `vendor_id` (uuid, references vendors)
      - `contract_id` (uuid, optional, references contracts)
      - `sla_name` (text) - name/description of the SLA
      - `sla_category` (text) - availability/response_time/resolution_time/quality/other
      - `target_value` (numeric) - the target threshold
      - `target_unit` (text) - percent/hours/minutes/days
      - `measurement_frequency` (text) - how often measured
      - `penalty_clause` (text) - description of penalty
      - `credit_percentage` (numeric) - credit for missed SLA
      - `is_active` (boolean) - whether SLA is currently active
      - `created_at` (timestamptz)

    - `sla_measurements`
      - `id` (uuid, primary key)
      - `sla_id` (uuid, references vendor_slas)
      - `measurement_period_start` (date) - start of measurement period
      - `measurement_period_end` (date) - end of measurement period
      - `actual_value` (numeric) - the actual measured value
      - `target_met` (boolean) - whether target was achieved
      - `notes` (text) - additional notes
      - `recorded_by` (uuid, references auth.users)
      - `recorded_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for organization members to manage their SLAs
*/

CREATE TABLE IF NOT EXISTS vendor_slas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  
  sla_name text NOT NULL,
  sla_category text CHECK (sla_category IN ('availability', 'response_time', 'resolution_time', 'quality', 'other')),
  target_value numeric NOT NULL,
  target_unit text NOT NULL,
  measurement_frequency text DEFAULT 'monthly',
  
  penalty_clause text,
  credit_percentage numeric,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sla_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_id uuid NOT NULL REFERENCES vendor_slas(id) ON DELETE CASCADE,
  measurement_period_start date NOT NULL,
  measurement_period_end date NOT NULL,
  actual_value numeric NOT NULL,
  target_met boolean NOT NULL DEFAULT false,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_slas_organization ON vendor_slas(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_slas_vendor ON vendor_slas(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_slas_contract ON vendor_slas(contract_id);
CREATE INDEX IF NOT EXISTS idx_vendor_slas_category ON vendor_slas(sla_category);
CREATE INDEX IF NOT EXISTS idx_vendor_slas_active ON vendor_slas(is_active);

CREATE INDEX IF NOT EXISTS idx_sla_measurements_sla ON sla_measurements(sla_id);
CREATE INDEX IF NOT EXISTS idx_sla_measurements_period ON sla_measurements(measurement_period_start, measurement_period_end);
CREATE INDEX IF NOT EXISTS idx_sla_measurements_target_met ON sla_measurements(target_met);

ALTER TABLE vendor_slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their vendor SLAs"
  ON vendor_slas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = vendor_slas.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can insert vendor SLAs"
  ON vendor_slas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = vendor_slas.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update their vendor SLAs"
  ON vendor_slas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = vendor_slas.organization_id
      AND organization_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = vendor_slas.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can delete their vendor SLAs"
  ON vendor_slas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = vendor_slas.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can view SLA measurements"
  ON sla_measurements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_slas
      JOIN organization_users ON organization_users.organization_id = vendor_slas.organization_id
      WHERE vendor_slas.id = sla_measurements.sla_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can insert SLA measurements"
  ON sla_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_slas
      JOIN organization_users ON organization_users.organization_id = vendor_slas.organization_id
      WHERE vendor_slas.id = sla_measurements.sla_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update SLA measurements"
  ON sla_measurements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_slas
      JOIN organization_users ON organization_users.organization_id = vendor_slas.organization_id
      WHERE vendor_slas.id = sla_measurements.sla_id
      AND organization_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_slas
      JOIN organization_users ON organization_users.organization_id = vendor_slas.organization_id
      WHERE vendor_slas.id = sla_measurements.sla_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can delete SLA measurements"
  ON sla_measurements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_slas
      JOIN organization_users ON organization_users.organization_id = vendor_slas.organization_id
      WHERE vendor_slas.id = sla_measurements.sla_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_vendor_slas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_vendor_slas_updated_at'
  ) THEN
    CREATE TRIGGER set_vendor_slas_updated_at
      BEFORE UPDATE ON vendor_slas
      FOR EACH ROW
      EXECUTE FUNCTION update_vendor_slas_updated_at();
  END IF;
END $$;
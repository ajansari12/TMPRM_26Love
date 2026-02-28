/*
  # Create Fourth Party/Subcontractor Management Tables

  1. New Tables
    - `fourth_parties`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `vendor_id` (uuid, references vendors)
      - `name` (text, not null) - common/trade name
      - `legal_name` (text) - official legal name
      - `country` (text) - country of operation
      - `service_description` (text) - what service they provide
      - `criticality` (text) - critical/high/medium/low
      - `data_access_level` (text) - none/limited/full
      - `is_offshore` (boolean) - if located offshore
      - `risk_assessment_status` (text) - assessment status
      - `notes` (text) - additional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `fourth_parties` table
    - Add policies for organization members to manage their fourth parties
*/

CREATE TABLE IF NOT EXISTS fourth_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  legal_name text,
  country text,
  service_description text,
  criticality text CHECK (criticality IN ('critical', 'high', 'medium', 'low')),
  data_access_level text CHECK (data_access_level IN ('none', 'limited', 'full')),
  is_offshore boolean DEFAULT false,
  risk_assessment_status text DEFAULT 'not_assessed' CHECK (risk_assessment_status IN ('not_assessed', 'in_progress', 'assessed', 'requires_review')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fourth_parties_organization ON fourth_parties(organization_id);
CREATE INDEX IF NOT EXISTS idx_fourth_parties_vendor ON fourth_parties(vendor_id);
CREATE INDEX IF NOT EXISTS idx_fourth_parties_criticality ON fourth_parties(criticality);

ALTER TABLE fourth_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their fourth parties"
  ON fourth_parties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = fourth_parties.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can insert fourth parties"
  ON fourth_parties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = fourth_parties.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update their fourth parties"
  ON fourth_parties
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = fourth_parties.organization_id
      AND organization_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = fourth_parties.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can delete their fourth parties"
  ON fourth_parties
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = fourth_parties.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_fourth_parties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_fourth_parties_updated_at'
  ) THEN
    CREATE TRIGGER set_fourth_parties_updated_at
      BEFORE UPDATE ON fourth_parties
      FOR EACH ROW
      EXECUTE FUNCTION update_fourth_parties_updated_at();
  END IF;
END $$;
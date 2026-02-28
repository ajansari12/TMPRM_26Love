/*
  # Create Organization Tier Configuration

  1. New Tables
    - `organization_tier_config`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `tier_level` (text, tier identifier)
      - `min_risk_score` (numeric, minimum score for this tier)
      - `review_frequency_days` (integer, days between reviews)
      - `tier_label` (text, display label)
      - `tier_description` (text, tier description)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `organization_osfi_weights`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `exit_strategy_weight` (numeric)
      - `bcp_weight` (numeric)
      - `incident_response_weight` (numeric)
      - `audit_rights_weight` (numeric)
      - `financial_viability_weight` (numeric)
      - `insurance_weight` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for organization members to read
    - Add policies for admins to manage

  3. Default Data
    - Insert default tier configurations for each organization
*/

CREATE TABLE IF NOT EXISTS organization_tier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier_level text NOT NULL,
  min_risk_score numeric NOT NULL DEFAULT 0,
  review_frequency_days integer,
  tier_label text NOT NULL,
  tier_description text,
  tier_color text DEFAULT 'slate',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, tier_level)
);

CREATE TABLE IF NOT EXISTS organization_osfi_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  exit_strategy_weight numeric NOT NULL DEFAULT 0.10,
  bcp_weight numeric NOT NULL DEFAULT 0.15,
  incident_response_weight numeric NOT NULL DEFAULT 0.10,
  audit_rights_weight numeric NOT NULL DEFAULT 0.05,
  financial_viability_weight numeric NOT NULL DEFAULT 0.10,
  insurance_weight numeric NOT NULL DEFAULT 0.05,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organization_tier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_osfi_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view tier config"
  ON organization_tier_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = organization_tier_config.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can manage tier config"
  ON organization_tier_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = organization_tier_config.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.defense_line = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = organization_tier_config.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.defense_line = 'admin'
    )
  );

CREATE POLICY "Organization members can view OSFI weights"
  ON organization_osfi_weights
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = organization_osfi_weights.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can manage OSFI weights"
  ON organization_osfi_weights
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = organization_osfi_weights.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.defense_line = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = organization_osfi_weights.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.defense_line = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_org_tier_config_org ON organization_tier_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_osfi_weights_org ON organization_osfi_weights(organization_id);

CREATE OR REPLACE FUNCTION create_default_tier_config()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO organization_tier_config (organization_id, tier_level, min_risk_score, review_frequency_days, tier_label, tier_description, tier_color, display_order)
  VALUES
    (NEW.id, 'tier_5_critical', 15, 90, 'Critical', 'Directly Impacts Core Business', 'red', 1),
    (NEW.id, 'tier_4_high', 10, 180, 'High Risk', 'Important but not mission-critical', 'orange', 2),
    (NEW.id, 'tier_3_moderate', 5, 365, 'Moderate Risk', 'Support functions with moderate impact', 'amber', 3),
    (NEW.id, 'tier_2_low', 2, 730, 'Low Risk', 'Support functions with minimal impact', 'emerald', 4),
    (NEW.id, 'tier_1_informational', 0, NULL, 'Informational', 'No formal contract or direct engagement', 'slate', 5)
  ON CONFLICT (organization_id, tier_level) DO NOTHING;

  INSERT INTO organization_osfi_weights (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_tier_config_trigger ON organizations;

CREATE TRIGGER create_default_tier_config_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_tier_config();

DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    INSERT INTO organization_tier_config (organization_id, tier_level, min_risk_score, review_frequency_days, tier_label, tier_description, tier_color, display_order)
    VALUES
      (org_record.id, 'tier_5_critical', 15, 90, 'Critical', 'Directly Impacts Core Business', 'red', 1),
      (org_record.id, 'tier_4_high', 10, 180, 'High Risk', 'Important but not mission-critical', 'orange', 2),
      (org_record.id, 'tier_3_moderate', 5, 365, 'Moderate Risk', 'Support functions with moderate impact', 'amber', 3),
      (org_record.id, 'tier_2_low', 2, 730, 'Low Risk', 'Support functions with minimal impact', 'emerald', 4),
      (org_record.id, 'tier_1_informational', 0, NULL, 'Informational', 'No formal contract or direct engagement', 'slate', 5)
    ON CONFLICT (organization_id, tier_level) DO NOTHING;

    INSERT INTO organization_osfi_weights (organization_id)
    VALUES (org_record.id)
    ON CONFLICT (organization_id) DO NOTHING;
  END LOOP;
END;
$$;

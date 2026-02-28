/*
  # Create Auto-Critical Rules Table

  1. New Tables
    - `auto_critical_rules`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `rule_name` (text) - Display name for the rule
      - `rule_description` (text) - Description of what the rule does
      - `conditions` (jsonb) - Array of conditions: [{field, operator, value}]
      - `is_active` (boolean) - Whether the rule is currently active
      - `priority` (integer) - Order in which rules are evaluated
      - `created_by` (uuid) - User who created the rule
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `auto_critical_rules` table
    - Add policy for organization members to manage rules

  3. Default Rules
    - Pre-populate with common auto-critical scenarios via trigger
*/

-- Create auto_critical_rules table
CREATE TABLE IF NOT EXISTS auto_critical_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_description text,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for organization lookups
CREATE INDEX IF NOT EXISTS idx_auto_critical_rules_org ON auto_critical_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_auto_critical_rules_active ON auto_critical_rules(organization_id, is_active);

-- Enable RLS
ALTER TABLE auto_critical_rules ENABLE ROW LEVEL SECURITY;

-- Policy for selecting rules (organization members)
CREATE POLICY "Organization members can view auto-critical rules"
  ON auto_critical_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = auto_critical_rules.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
    )
  );

-- Policy for inserting rules (organization admins/managers)
CREATE POLICY "Organization admins can create auto-critical rules"
  ON auto_critical_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = auto_critical_rules.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
      AND (organization_users.defense_line IN ('admin', '2nd') OR organization_users.can_configure_workflows = true)
    )
  );

-- Policy for updating rules (organization admins/managers)
CREATE POLICY "Organization admins can update auto-critical rules"
  ON auto_critical_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = auto_critical_rules.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
      AND (organization_users.defense_line IN ('admin', '2nd') OR organization_users.can_configure_workflows = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = auto_critical_rules.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
      AND (organization_users.defense_line IN ('admin', '2nd') OR organization_users.can_configure_workflows = true)
    )
  );

-- Policy for deleting rules (organization admins)
CREATE POLICY "Organization admins can delete auto-critical rules"
  ON auto_critical_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = auto_critical_rules.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.is_active = true
      AND organization_users.defense_line = 'admin'
    )
  );

-- Add auto_critical columns to tiering_assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'auto_critical_rule_id'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN auto_critical_rule_id uuid REFERENCES auto_critical_rules(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'is_auto_critical'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN is_auto_critical boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'auto_critical_rule_name'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN auto_critical_rule_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'auto_critical_override'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN auto_critical_override boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'auto_critical_override_reason'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN auto_critical_override_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'auto_critical_override_approved_by'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN auto_critical_override_approved_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Update timestamp trigger for auto_critical_rules
DROP TRIGGER IF EXISTS update_auto_critical_rules_updated_at ON auto_critical_rules;
CREATE TRIGGER update_auto_critical_rules_updated_at
  BEFORE UPDATE ON auto_critical_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to create default rules for a new organization
CREATE OR REPLACE FUNCTION create_default_auto_critical_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: High contract value
  INSERT INTO auto_critical_rules (organization_id, rule_name, rule_description, conditions, priority)
  VALUES (
    NEW.id,
    'High Contract Value',
    'Vendors with contract values exceeding $5,000,000 CAD are automatically classified as critical.',
    '[{"field": "contract_value_cad", "operator": ">=", "value": 5000000}]'::jsonb,
    1
  );

  -- Rule 2: PII handling with external customer facing
  INSERT INTO auto_critical_rules (organization_id, rule_name, rule_description, conditions, priority)
  VALUES (
    NEW.id,
    'Sensitive Data with Customer Exposure',
    'Vendors handling PII/sensitive data that are externally customer-facing are automatically critical.',
    '[{"field": "handles_sensitive_data", "operator": "=", "value": true}, {"field": "q14_customer_facing", "operator": ">=", "value": 4}]'::jsonb,
    2
  );

  -- Rule 3: Essential operations support
  INSERT INTO auto_critical_rules (organization_id, rule_name, rule_description, conditions, priority)
  VALUES (
    NEW.id,
    'Essential Operations Support',
    'Vendors supporting essential/critical business operations are automatically critical.',
    '[{"field": "q15_operational_impact", "operator": "=", "value": 5}]'::jsonb,
    3
  );

  -- Rule 4: Sole source with no alternatives
  INSERT INTO auto_critical_rules (organization_id, rule_name, rule_description, conditions, priority)
  VALUES (
    NEW.id,
    'Sole Source Provider',
    'Sole source vendors with no viable alternatives are automatically critical.',
    '[{"field": "q22_substitutability", "operator": "=", "value": 5}]'::jsonb,
    4
  );

  -- Rule 5: Payment processing
  INSERT INTO auto_critical_rules (organization_id, rule_name, rule_description, conditions, priority)
  VALUES (
    NEW.id,
    'Payment Processing Services',
    'Vendors providing payment processing or custody services are automatically critical.',
    '[{"field": "service_category", "operator": "in", "value": ["payment_processing", "custody_services"]}]'::jsonb,
    5
  );

  -- Rule 6: Core cloud infrastructure
  INSERT INTO auto_critical_rules (organization_id, rule_name, rule_description, conditions, priority)
  VALUES (
    NEW.id,
    'Core Cloud Infrastructure',
    'Cloud infrastructure providers hosting core systems are automatically critical.',
    '[{"field": "service_category", "operator": "=", "value": "cloud_infrastructure"}, {"field": "q15_operational_impact", "operator": ">=", "value": 4}]'::jsonb,
    6
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to add default rules when a new organization is created
DROP TRIGGER IF EXISTS create_default_auto_critical_rules_trigger ON organizations;
CREATE TRIGGER create_default_auto_critical_rules_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_auto_critical_rules();

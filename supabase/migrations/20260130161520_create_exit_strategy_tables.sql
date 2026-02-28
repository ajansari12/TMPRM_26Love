/*
  # Create Exit Strategy Planning Tables

  1. New Tables
    - `exit_strategies`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `vendor_id` (uuid, references vendors)
      - `status` (text) - not_started/in_progress/documented/tested/approved
      - `exit_trigger_conditions` (text[]) - conditions that trigger exit
      - `notice_period_days` (integer) - contractual notice period
      - `data_return_process` (text) - how data will be returned
      - `data_destruction_process` (text) - how data will be destroyed
      - `alternative_vendors` (jsonb) - list of alternative vendors
      - `transition_timeline_weeks` (integer) - estimated transition time
      - `last_test_date` (date) - when exit plan was last tested
      - `test_results` (text) - results of last test
      - `next_test_date` (date) - when next test is scheduled
      - `exit_plan_document_id` (uuid) - reference to exit plan document
      - `approved_by` (uuid) - who approved the plan
      - `approved_at` (timestamptz) - when approved
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `exit_strategies` table
    - Add policies for organization members to manage their exit strategies
*/

CREATE TABLE IF NOT EXISTS exit_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'documented', 'tested', 'approved')),
  
  exit_trigger_conditions text[],
  notice_period_days integer,
  data_return_process text,
  data_destruction_process text,
  
  alternative_vendors jsonb DEFAULT '[]'::jsonb,
  transition_timeline_weeks integer,
  
  last_test_date date,
  test_results text,
  next_test_date date,
  
  exit_plan_document_id uuid,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_exit_strategies_organization ON exit_strategies(organization_id);
CREATE INDEX IF NOT EXISTS idx_exit_strategies_vendor ON exit_strategies(vendor_id);
CREATE INDEX IF NOT EXISTS idx_exit_strategies_status ON exit_strategies(status);
CREATE INDEX IF NOT EXISTS idx_exit_strategies_next_test ON exit_strategies(next_test_date);

ALTER TABLE exit_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their exit strategies"
  ON exit_strategies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = exit_strategies.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can insert exit strategies"
  ON exit_strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = exit_strategies.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update their exit strategies"
  ON exit_strategies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = exit_strategies.organization_id
      AND organization_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = exit_strategies.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can delete their exit strategies"
  ON exit_strategies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = exit_strategies.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_exit_strategies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_exit_strategies_updated_at'
  ) THEN
    CREATE TRIGGER set_exit_strategies_updated_at
      BEFORE UPDATE ON exit_strategies
      FOR EACH ROW
      EXECUTE FUNCTION update_exit_strategies_updated_at();
  END IF;
END $$;
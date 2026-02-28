/*
  # Create Risk Exception/Acceptance Workflow Tables

  1. New Tables
    - `risk_exceptions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `vendor_id` (uuid, optional, references vendors)
      - `exception_type` (text) - policy/control/regulatory/contractual
      - `title` (text) - brief title for the exception
      - `description` (text) - detailed description
      - `risk_description` (text) - description of the risk being accepted
      - `inherent_risk_level` (text) - risk level without controls
      - `residual_risk_level` (text) - risk level with mitigating controls
      - `mitigating_controls` (text[]) - list of compensating controls
      - `status` (text) - pending/approved/rejected/expired/remediated
      - `requested_by` (uuid) - user who requested exception
      - `requested_at` (timestamptz) - when requested
      - `approved_by` (uuid) - user who approved
      - `approved_at` (timestamptz) - when approved
      - `rejection_reason` (text) - reason if rejected
      - `effective_date` (date) - when exception becomes effective
      - `expiry_date` (date) - when exception expires
      - `review_frequency_days` (integer) - how often to review
      - `next_review_date` (date) - next scheduled review
      - `remediation_plan` (text) - plan to remediate the risk
      - `remediation_due_date` (date) - target date for remediation
      - `remediation_status` (text) - status of remediation efforts
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on risk_exceptions table
    - Add policies for organization members to manage exceptions
*/

CREATE TABLE IF NOT EXISTS risk_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  
  exception_type text CHECK (exception_type IN ('policy', 'control', 'regulatory', 'contractual')),
  title text NOT NULL,
  description text NOT NULL,
  risk_description text NOT NULL,
  
  inherent_risk_level text CHECK (inherent_risk_level IN ('critical', 'high', 'medium', 'low')),
  residual_risk_level text CHECK (residual_risk_level IN ('critical', 'high', 'medium', 'low')),
  mitigating_controls text[] DEFAULT '{}',
  
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'remediated')),
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  
  effective_date date,
  expiry_date date,
  review_frequency_days integer DEFAULT 90,
  next_review_date date,
  
  remediation_plan text,
  remediation_due_date date,
  remediation_status text CHECK (remediation_status IS NULL OR remediation_status IN ('not_started', 'in_progress', 'completed', 'deferred')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_exceptions_organization ON risk_exceptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_exceptions_vendor ON risk_exceptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_risk_exceptions_status ON risk_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_risk_exceptions_type ON risk_exceptions(exception_type);
CREATE INDEX IF NOT EXISTS idx_risk_exceptions_expiry ON risk_exceptions(expiry_date);
CREATE INDEX IF NOT EXISTS idx_risk_exceptions_next_review ON risk_exceptions(next_review_date);
CREATE INDEX IF NOT EXISTS idx_risk_exceptions_requested_by ON risk_exceptions(requested_by);

ALTER TABLE risk_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their risk exceptions"
  ON risk_exceptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = risk_exceptions.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can insert risk exceptions"
  ON risk_exceptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = risk_exceptions.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update risk exceptions"
  ON risk_exceptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = risk_exceptions.organization_id
      AND organization_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = risk_exceptions.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can delete risk exceptions"
  ON risk_exceptions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = risk_exceptions.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_risk_exceptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_risk_exceptions_updated_at'
  ) THEN
    CREATE TRIGGER set_risk_exceptions_updated_at
      BEFORE UPDATE ON risk_exceptions
      FOR EACH ROW
      EXECUTE FUNCTION update_risk_exceptions_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION check_expired_risk_exceptions()
RETURNS void AS $$
BEGIN
  UPDATE risk_exceptions
  SET status = 'expired'
  WHERE status = 'approved'
    AND expiry_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
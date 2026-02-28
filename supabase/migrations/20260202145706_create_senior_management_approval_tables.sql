/*
  # Senior Management Approval Workflow Tables

  This migration adds tables and columns for senior management approval workflow,
  implementing OSFI B-10 Section 2.1.2 requiring "appropriate level of management approval."

  1. New Columns on onboarding_requests:
    - Senior approval workflow fields

  2. New Table: senior_approval_config
    - Configurable tiers that require senior approval

  3. New Table: senior_approvers
    - List of users designated as senior approvers

  4. Security:
    - RLS policies for organization-scoped access
*/

-- Add new columns to onboarding_requests for senior approval workflow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'requires_senior_approval'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN requires_senior_approval boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assigned_senior_approver'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assigned_senior_approver uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assigned_senior_at'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assigned_senior_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'reviewed_by_senior'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN reviewed_by_senior uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'reviewed_at_senior'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN reviewed_at_senior timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'review_decision_senior'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN review_decision_senior text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'review_notes_senior'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN review_notes_senior text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'senior_approval_conditions'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN senior_approval_conditions text;
  END IF;
END $$;

-- Create senior approval configuration table
CREATE TABLE IF NOT EXISTS senior_approval_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  tiers_requiring_approval text[] DEFAULT ARRAY['tier_5_critical'],
  contract_value_threshold_cad numeric,
  require_for_outsourcing boolean DEFAULT true,
  auto_escalate_after_days integer DEFAULT 5,
  reminder_after_days integer DEFAULT 3,
  notify_on_assignment boolean DEFAULT true,
  notify_on_completion boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  UNIQUE(organization_id)
);

ALTER TABLE senior_approval_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view senior approval config for their organization" ON senior_approval_config;
CREATE POLICY "Users can view senior approval config for their organization"
  ON senior_approval_config
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage senior approval config" ON senior_approval_config;
CREATE POLICY "Admins can manage senior approval config"
  ON senior_approval_config
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (defense_line = 'admin' OR can_configure_workflows = true)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (defense_line = 'admin' OR can_configure_workflows = true)
    )
  );

-- Create senior approvers table
CREATE TABLE IF NOT EXISTS senior_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  
  title text,
  approval_authority_level integer DEFAULT 1,
  can_approve_tiers text[] DEFAULT ARRAY['tier_5_critical', 'tier_4_high'],
  max_contract_value_cad numeric,
  
  is_delegate boolean DEFAULT false,
  delegate_for_user_id uuid REFERENCES auth.users(id),
  delegation_start_date date,
  delegation_end_date date,
  
  is_available boolean DEFAULT true,
  unavailable_until date,
  backup_approver_id uuid REFERENCES auth.users(id),
  
  notification_email text,
  receive_notifications boolean DEFAULT true,
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  UNIQUE(organization_id, user_id)
);

ALTER TABLE senior_approvers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view senior approvers for their organization" ON senior_approvers;
CREATE POLICY "Users can view senior approvers for their organization"
  ON senior_approvers
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage senior approvers" ON senior_approvers;
CREATE POLICY "Admins can manage senior approvers"
  ON senior_approvers
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (defense_line = 'admin' OR can_manage_users = true)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (defense_line = 'admin' OR can_manage_users = true)
    )
  );

-- Add senior_management to defense_line_configs for each organization
INSERT INTO defense_line_configs (
  organization_id,
  defense_line,
  display_name,
  description,
  is_required_in_workflow,
  can_skip_for_low_risk,
  review_sla_hours,
  escalation_after_hours,
  notify_on_new_request,
  notify_on_overdue
)
SELECT 
  o.id,
  'senior_management',
  'Senior Management',
  'Executive-level approval for critical vendors per OSFI B-10 Section 2.1.2',
  false,
  true,
  120,
  168,
  true,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM defense_line_configs dlc
  WHERE dlc.organization_id = o.id AND dlc.defense_line = 'senior_management'
)
ON CONFLICT DO NOTHING;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_senior_approvers_org_active 
  ON senior_approvers(organization_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_senior_approval
  ON onboarding_requests(organization_id, status)
  WHERE status = 'pending_senior_approval';

-- Add constraint for valid senior review decisions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_senior_review_decision'
  ) THEN
    ALTER TABLE onboarding_requests
    ADD CONSTRAINT valid_senior_review_decision
    CHECK (
      review_decision_senior IS NULL OR
      review_decision_senior IN ('approved', 'approved_with_conditions', 'request_info', 'rejected')
    );
  END IF;
END $$;

-- Function to check if a request requires senior approval
CREATE OR REPLACE FUNCTION check_senior_approval_required(
  p_organization_id uuid,
  p_tier text,
  p_contract_value numeric,
  p_is_outsourcing boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config senior_approval_config%ROWTYPE;
BEGIN
  SELECT * INTO v_config
  FROM senior_approval_config
  WHERE organization_id = p_organization_id;
  
  IF NOT FOUND THEN
    RETURN p_tier = 'tier_5_critical';
  END IF;
  
  IF p_tier = ANY(v_config.tiers_requiring_approval) THEN
    RETURN true;
  END IF;
  
  IF v_config.contract_value_threshold_cad IS NOT NULL 
     AND p_contract_value IS NOT NULL
     AND p_contract_value >= v_config.contract_value_threshold_cad THEN
    RETURN true;
  END IF;
  
  IF v_config.require_for_outsourcing AND p_is_outsourcing THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON TABLE senior_approval_config IS 'Configuration for senior management approval requirements per OSFI B-10 Section 2.1.2';
COMMENT ON TABLE senior_approvers IS 'Designated senior management approvers for critical vendor onboarding';
COMMENT ON FUNCTION check_senior_approval_required IS 'Determines if a vendor request requires senior management approval based on org config';

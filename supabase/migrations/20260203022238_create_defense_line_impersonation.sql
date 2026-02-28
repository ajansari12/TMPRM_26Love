/*
  # Defense Line Impersonation for Workflow Testing

  1. New Tables
    - `defense_line_impersonation_sessions`
      - `id` (uuid, primary key) - Unique session identifier
      - `admin_user_id` (uuid) - The admin user performing impersonation
      - `organization_id` (uuid) - The organization context
      - `target_defense_line` (text) - The defense line being impersonated
      - `original_defense_line` (text) - The admin's original defense line
      - `started_at` (timestamptz) - Session start time
      - `ended_at` (timestamptz) - Session end time (null if active)
      - `end_reason` (text) - Why session ended: manual, timeout, logout
      - `last_activity_at` (timestamptz) - For timeout tracking

  2. Modified Tables
    - `audit_logs`
      - Added `organization_id` (uuid) - For multi-tenant filtering
      - Added `is_test_mode` (boolean) - Flag for impersonation-created entries
      - Added `impersonation_session_id` (uuid) - Links to impersonation session

  3. Security
    - Enable RLS on new table
    - Only org admins can create/view impersonation sessions for their org
    - Audit logs during impersonation are clearly tagged

  4. Important Notes
    - Test mode entries are excluded from compliance reports by default
    - All actions during impersonation are fully functional but flagged
    - 60-minute timeout implemented via application layer
*/

-- Create defense line impersonation sessions table
CREATE TABLE IF NOT EXISTS defense_line_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_defense_line TEXT NOT NULL,
  original_defense_line TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_end_reason CHECK (
    end_reason IS NULL OR end_reason IN ('manual', 'timeout', 'logout', 'session_expired')
  ),
  CONSTRAINT valid_defense_line CHECK (
    target_defense_line IN ('1a', '1b', '2nd', '3rd', 'admin', 'senior_management')
  )
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_defense_line_impersonation_admin 
  ON defense_line_impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_defense_line_impersonation_org 
  ON defense_line_impersonation_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_defense_line_impersonation_active 
  ON defense_line_impersonation_sessions(admin_user_id, organization_id) 
  WHERE ended_at IS NULL;

-- Add organization_id column to audit_logs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add is_test_mode column to audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'is_test_mode'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN is_test_mode BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add impersonation_session_id column to audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'impersonation_session_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN impersonation_session_id UUID REFERENCES defense_line_impersonation_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for filtering test mode entries
CREATE INDEX IF NOT EXISTS idx_audit_logs_test_mode 
  ON audit_logs(is_test_mode) WHERE is_test_mode = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org 
  ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonation_session 
  ON audit_logs(impersonation_session_id) WHERE impersonation_session_id IS NOT NULL;

-- Enable RLS on the new table
ALTER TABLE defense_line_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for defense_line_impersonation_sessions

-- Org admins can view impersonation sessions for their organization
CREATE POLICY "Org admins can view impersonation sessions"
  ON defense_line_impersonation_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = defense_line_impersonation_sessions.organization_id
      AND ou.defense_line = 'admin'
      AND ou.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM platform_admins pa
      WHERE pa.user_id = auth.uid()
      AND pa.is_active = TRUE
    )
  );

-- Org admins can create impersonation sessions for their organization
CREATE POLICY "Org admins can create impersonation sessions"
  ON defense_line_impersonation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = defense_line_impersonation_sessions.organization_id
      AND ou.defense_line = 'admin'
      AND ou.is_active = TRUE
    )
  );

-- Org admins can update (end) their own impersonation sessions
CREATE POLICY "Org admins can update their impersonation sessions"
  ON defense_line_impersonation_sessions
  FOR UPDATE
  TO authenticated
  USING (
    admin_user_id = auth.uid()
  )
  WITH CHECK (
    admin_user_id = auth.uid()
  );

-- Function to check if user has an active impersonation session
CREATE OR REPLACE FUNCTION get_active_defense_line_impersonation(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  session_id UUID,
  target_defense_line TEXT,
  original_defense_line TEXT,
  started_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  minutes_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dis.id AS session_id,
    dis.target_defense_line,
    dis.original_defense_line,
    dis.started_at,
    dis.last_activity_at,
    GREATEST(0, 60 - EXTRACT(EPOCH FROM (NOW() - dis.last_activity_at)) / 60)::INTEGER AS minutes_remaining
  FROM defense_line_impersonation_sessions dis
  WHERE dis.admin_user_id = p_user_id
    AND dis.organization_id = p_organization_id
    AND dis.ended_at IS NULL
    AND dis.last_activity_at > NOW() - INTERVAL '60 minutes'
  ORDER BY dis.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to start a defense line impersonation session
CREATE OR REPLACE FUNCTION start_defense_line_impersonation(
  p_organization_id UUID,
  p_target_defense_line TEXT
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_original_defense_line TEXT;
BEGIN
  -- Get the user's original defense line
  SELECT defense_line INTO v_original_defense_line
  FROM organization_users
  WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND is_active = TRUE;
    
  -- Verify user is an admin
  IF v_original_defense_line != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can impersonate defense lines';
  END IF;
  
  -- End any existing active session
  UPDATE defense_line_impersonation_sessions
  SET ended_at = NOW(),
      end_reason = 'manual'
  WHERE admin_user_id = auth.uid()
    AND organization_id = p_organization_id
    AND ended_at IS NULL;
  
  -- Create new session
  INSERT INTO defense_line_impersonation_sessions (
    admin_user_id,
    organization_id,
    target_defense_line,
    original_defense_line
  ) VALUES (
    auth.uid(),
    p_organization_id,
    p_target_defense_line,
    v_original_defense_line
  )
  RETURNING id INTO v_session_id;
  
  -- Log the impersonation start
  INSERT INTO audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    is_test_mode,
    impersonation_session_id,
    changes
  ) VALUES (
    p_organization_id,
    auth.uid(),
    'defense_line_impersonation_started',
    'impersonation_session',
    v_session_id::TEXT,
    TRUE,
    v_session_id,
    jsonb_build_object(
      'target_defense_line', p_target_defense_line,
      'original_defense_line', v_original_defense_line,
      'started_at', NOW()
    )
  );
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a defense line impersonation session
CREATE OR REPLACE FUNCTION end_defense_line_impersonation(
  p_session_id UUID,
  p_reason TEXT DEFAULT 'manual'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Get session details
  SELECT * INTO v_session
  FROM defense_line_impersonation_sessions
  WHERE id = p_session_id
    AND admin_user_id = auth.uid()
    AND ended_at IS NULL;
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- End the session
  UPDATE defense_line_impersonation_sessions
  SET ended_at = NOW(),
      end_reason = p_reason
  WHERE id = p_session_id;
  
  -- Log the impersonation end
  INSERT INTO audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    is_test_mode,
    impersonation_session_id,
    changes
  ) VALUES (
    v_session.organization_id,
    auth.uid(),
    'defense_line_impersonation_ended',
    'impersonation_session',
    p_session_id::TEXT,
    TRUE,
    p_session_id,
    jsonb_build_object(
      'target_defense_line', v_session.target_defense_line,
      'end_reason', p_reason,
      'duration_minutes', EXTRACT(EPOCH FROM (NOW() - v_session.started_at)) / 60
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update last activity timestamp (extends timeout)
CREATE OR REPLACE FUNCTION extend_defense_line_impersonation(
  p_session_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE defense_line_impersonation_sessions
  SET last_activity_at = NOW()
  WHERE id = p_session_id
    AND admin_user_id = auth.uid()
    AND ended_at IS NULL;
    
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE defense_line_impersonation_sessions IS 'Tracks defense line impersonation sessions for workflow testing by administrators';
COMMENT ON COLUMN defense_line_impersonation_sessions.target_defense_line IS 'The defense line the admin is impersonating (1a, 1b, 2nd, 3rd)';
COMMENT ON COLUMN defense_line_impersonation_sessions.original_defense_line IS 'The admin original defense line (always admin)';
COMMENT ON COLUMN defense_line_impersonation_sessions.last_activity_at IS 'Used for 60-minute timeout calculation';
COMMENT ON COLUMN audit_logs.is_test_mode IS 'TRUE for actions performed during defense line impersonation';
COMMENT ON COLUMN audit_logs.impersonation_session_id IS 'Links audit entry to the impersonation session for full context';
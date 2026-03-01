/*
  # Defense Line-Scoped RLS Policies
*/

CREATE OR REPLACE FUNCTION get_effective_defense_line(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_impersonated text;
  v_defense_line text;
BEGIN
  SELECT target_defense_line INTO v_impersonated
  FROM defense_line_impersonation_sessions
  WHERE admin_user_id = auth.uid()
    AND organization_id = org_id
    AND ended_at IS NULL
    AND last_activity_at > now() - interval '1 hour'
  LIMIT 1;

  IF v_impersonated IS NOT NULL THEN
    RETURN v_impersonated;
  END IF;

  SELECT defense_line INTO v_defense_line
  FROM organization_users
  WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND is_active = true
  LIMIT 1;

  RETURN v_defense_line;
END;
$$;

DROP POLICY IF EXISTS "Users can view org onboarding requests" ON onboarding_requests;

CREATE POLICY "Users can view onboarding requests by defense line"
  ON onboarding_requests
  FOR SELECT
  TO authenticated
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND (
      get_effective_defense_line(organization_id) IS DISTINCT FROM '1a'
      OR requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read vendors in their organization" ON vendors;

CREATE POLICY "Users can view vendors by defense line"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = vendors.organization_id
        AND ou.is_active = true
    )
    AND (
      get_effective_defense_line(organization_id) IS DISTINCT FROM '1a'
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM onboarding_requests orq
        WHERE orq.created_vendor_id = vendors.id
          AND orq.requested_by = auth.uid()
      )
    )
  );

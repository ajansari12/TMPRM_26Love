/*
  # Fix "Create Organization" RLS Violation - STABLE function cache
*/

CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
  RETURNS uuid[]
  LANGUAGE sql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
AS $function$
  SELECT COALESCE(
    array_agg(organization_id),
    '{}'::uuid[]
  )
  FROM organization_users
  WHERE user_id = auth.uid() AND is_active = true;
$function$;

DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;

CREATE POLICY "Users can view their organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR (id = ANY (get_user_organization_ids()))
    OR (created_by = auth.uid())
  );

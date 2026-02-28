
/*
  # Fix "Create Organization" RLS Violation

  ## Problem
  When a new user clicks "Create Organization", PostgREST executes:
    INSERT INTO organizations (...) RETURNING *

  The INSERT triggers `auto_add_org_creator_as_admin` (AFTER INSERT), which inserts
  the creator into `organization_users`. However, the RETURNING clause evaluates the
  SELECT policy in the same SQL statement. Because `get_user_organization_ids()` is
  declared STABLE, PostgreSQL caches its result for the duration of the statement —
  evaluated BEFORE the trigger fires. The RETURNING check therefore sees an empty
  array (no memberships) and rejects the row with an RLS violation.

  ## Fix

  ### 1. Change `get_user_organization_ids()` from STABLE to VOLATILE
  Forces PostgreSQL to re-execute the function on every call, so it always reflects
  rows inserted by triggers within the same transaction.

  ### 2. Add `created_by = auth.uid()` to the organizations SELECT policy
  Provides a direct ownership check that does not depend on `organization_users`
  membership, closing the chicken-and-egg race permanently.
*/

-- Fix 1: Re-declare function as VOLATILE so PostgreSQL never caches its result
-- mid-statement (critical when trigger-inserted rows must be immediately visible)
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

-- Fix 2: Extend the SELECT policy so the creator can read back
-- the org they just created without depending on organization_users membership
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

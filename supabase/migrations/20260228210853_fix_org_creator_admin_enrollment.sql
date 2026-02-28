/*
  # Fix Organization Creator Admin Enrollment

  ## Problem
  When a new user creates their first organization via FIOnboarding, the INSERT
  into `organizations` succeeds (INSERT policy WITH CHECK (true) passes), but
  PostgREST then evaluates the RETURNING clause against the SELECT policy:

    USING (is_platform_admin() OR (id = ANY(get_user_organization_ids())))

  At that moment, the creator has zero rows in `organization_users` for the new
  org, and is not a platform admin, so both sides return false and PostgREST
  raises "new row violates row-level security policy for table organizations".

  There is also a chicken-and-egg issue: the `organization_users` INSERT policy
  only permits org admins, so a first-time user cannot add themselves after the
  fact either.

  ## Fix

  1. TRIGGER FUNCTION `auto_add_org_creator_as_admin` (SECURITY DEFINER)
     - Fires AFTER INSERT on `organizations`
     - If `NEW.created_by IS NOT NULL`, inserts a row into `organization_users`
       making the creator a full admin
     - SECURITY DEFINER bypasses `organization_users` RLS so no chicken-and-egg
     - Fires BEFORE PostgreSQL returns RETURNING values, so by the time PostgREST
       checks the SELECT policy the user IS already an org member

  2. RLS POLICY on `organization_users`
     - Adds a permissive INSERT-only policy allowing a user to self-enroll as
       admin for an org they created (created_by = auth.uid())
     - Covers any direct-client enrollment path as a safety valve

  ## Security Notes
  - Only applies when created_by IS NOT NULL (platform-admin-created orgs skip it)
  - Platform admins can see all orgs via is_platform_admin() and are unaffected
  - The new org_users entry grants full admin rights only to the org creator
*/

-- Step 1: Trigger function to auto-enroll creator as org admin
CREATE OR REPLACE FUNCTION auto_add_org_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO organization_users (
      organization_id,
      user_id,
      defense_line,
      role_title,
      can_create_requests,
      can_review,
      can_approve,
      can_manage_users,
      can_configure_workflows,
      is_active
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'admin',
      'Organization Administrator',
      true,
      true,
      true,
      true,
      true,
      true
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 2: Attach the trigger to organizations
DROP TRIGGER IF EXISTS auto_add_creator_as_admin ON organizations;
CREATE TRIGGER auto_add_creator_as_admin
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_org_creator_as_admin();

-- Step 3: Add founder self-enrollment INSERT policy on organization_users
-- Allows a user to insert themselves as admin for an org they just created
DROP POLICY IF EXISTS "Org creator can enroll themselves as admin" ON organization_users;
CREATE POLICY "Org creator can enroll themselves as admin"
  ON organization_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND defense_line = 'admin'
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE id = organization_id
      AND created_by = auth.uid()
    )
  );

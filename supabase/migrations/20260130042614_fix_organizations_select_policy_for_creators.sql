/*
  # Fix Organizations SELECT Policy for Creators

  ## Problem
  When creating an organization, the INSERT uses `.select().single()` to return the row.
  The current SELECT policy only allows viewing organizations where the user is a member,
  but the membership is created by a trigger AFTER the insert completes.
  This causes the INSERT to fail with an RLS error.

  ## Solution
  Update the SELECT policy to also allow users to view organizations they created.

  ## Changes
  1. Drop existing SELECT policy
  2. Create new SELECT policy that allows viewing if:
     - User is a member of the organization, OR
     - User is the creator of the organization
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;

-- Create updated SELECT policy
CREATE POLICY "Users can view their organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id = ANY (get_user_organization_ids())
    OR created_by = auth.uid()
  );

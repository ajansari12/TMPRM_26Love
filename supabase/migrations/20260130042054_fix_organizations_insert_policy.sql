/*
  # Fix Organizations INSERT Policy

  The existing INSERT policy for organizations may not be working correctly.
  This migration drops and recreates it with explicit settings.

  ## Changes
  1. Drop existing INSERT policy
  2. Recreate with explicit WITH CHECK clause
  3. Ensure policy allows any authenticated user to create organizations
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

-- Recreate with explicit settings
CREATE POLICY "Authenticated users can create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

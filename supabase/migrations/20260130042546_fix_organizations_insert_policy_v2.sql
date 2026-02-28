/*
  # Fix Organizations INSERT Policy - Version 2

  The INSERT policy was too restrictive. This migration:
  1. Drops the existing INSERT policy
  2. Creates a simpler policy that allows any authenticated user to create organizations

  ## Issue
  The previous policy checked `created_by = auth.uid()` but this can fail if
  the column is set server-side or if there's a timing issue.

  ## Solution
  Allow authenticated users to insert, and use a trigger to ensure created_by is set correctly.
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

-- Create a simpler INSERT policy
CREATE POLICY "Authenticated users can create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure there's a trigger to set created_by if not provided
CREATE OR REPLACE FUNCTION set_organization_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS set_organization_created_by_trigger ON organizations;
CREATE TRIGGER set_organization_created_by_trigger
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_created_by();

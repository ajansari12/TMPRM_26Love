/*
  # Add Workflow Routing Configuration and Enhanced Permissions

  1. Changes to organization_users table
    - Add `can_complete_assessments` column for tracking assessment completion permissions

  2. Notes
    - Workflow routing configuration will be stored in the existing organizations.settings JSONB column
    - No schema changes needed for organizations table as settings is already JSONB
*/

-- Add can_complete_assessments permission to organization_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_complete_assessments'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_complete_assessments boolean DEFAULT false;
  END IF;
END $$;

-- Update existing organization_users to set can_complete_assessments based on defense_line
UPDATE organization_users
SET can_complete_assessments = true
WHERE defense_line IN ('1a', '1b', 'admin')
AND can_complete_assessments = false;

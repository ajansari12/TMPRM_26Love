/*
  # Add Organization and Onboarding Reference to Vendors Table

  1. Changes
    - Add `organization_id` column to vendors table for multi-tenant support
    - Add `onboarding_request_id` column to track vendor origin from onboarding
    - Add foreign key constraints
    - Update RLS policies for multi-tenant access
    - Add indexes for performance

  2. Security
    - Update RLS policies to filter by organization_id
    - Ensure users can only see vendors in their organization
*/

-- Add organization_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add onboarding_request_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'onboarding_request_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN onboarding_request_id uuid REFERENCES onboarding_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_vendors_organization_id ON vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_onboarding_request_id ON vendors(onboarding_request_id);

-- Drop existing policies that don't account for organization_id
DROP POLICY IF EXISTS "Authenticated users can read vendors" ON vendors;
DROP POLICY IF EXISTS "Authenticated users can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Authorized users can update vendors" ON vendors;
DROP POLICY IF EXISTS "Risk managers can delete vendors" ON vendors;

-- Create new multi-tenant aware policies

-- Users can read vendors in their organization
CREATE POLICY "Users can read vendors in their organization"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users can insert vendors in their organization
CREATE POLICY "Users can insert vendors in their organization"
  ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users can update vendors in their organization based on their role
CREATE POLICY "Users can update vendors in their organization"
  ON vendors
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_active = true
      AND (ou.defense_line IN ('admin', '2nd') OR ou.can_manage_users = true)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_active = true
      AND (ou.defense_line IN ('admin', '2nd') OR ou.can_manage_users = true)
    )
  );

-- Only admins and 2nd line can delete vendors
CREATE POLICY "Admins can delete vendors in their organization"
  ON vendors
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_active = true
      AND ou.defense_line = 'admin'
    )
  );

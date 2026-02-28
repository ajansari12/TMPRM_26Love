/*
  # Add Multi-Tenancy to concentration_thresholds

  ## Overview
  Fixes critical bug where concentration_thresholds table lacks organization_id,
  causing all threshold queries to return empty results and breaking concentration
  breach detection across the entire application.

  ## Changes Made

  1. **Schema Updates**
     - Add organization_id column with foreign key to organizations
     - Add index on organization_id for query performance
     - Drop global UNIQUE(threshold_type) constraint
     - Add per-organization UNIQUE(organization_id, threshold_type) constraint

  2. **Data Migration**
     - Backfill organization_id for existing thresholds
     - Seed default thresholds for ALL existing organizations

  3. **Security Updates**
     - Drop old role-based RLS policies
     - Add organization-based RLS policies for viewing and managing thresholds
     - Restrict management to users with can_configure_workflows permission

  ## Default Thresholds
  - Single Vendor: 5% warning, 10% critical
  - Service Category: 20% warning, 35% critical
  - Geographic: 30% warning, 50% critical
*/

-- Add organization_id column with foreign key and index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concentration_thresholds' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE concentration_thresholds
    ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_concentration_thresholds_org
    ON concentration_thresholds(organization_id);
  END IF;
END $$;

-- Drop the global UNIQUE on threshold_type and replace with per-org unique
DO $$
BEGIN
  -- Drop existing unique constraint
  ALTER TABLE concentration_thresholds
    DROP CONSTRAINT IF EXISTS concentration_thresholds_threshold_type_key;

  -- Add per-organization unique constraint
  ALTER TABLE concentration_thresholds
    DROP CONSTRAINT IF EXISTS unique_threshold_per_org;

  ALTER TABLE concentration_thresholds
    ADD CONSTRAINT unique_threshold_per_org UNIQUE (organization_id, threshold_type);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Backfill: assign existing thresholds to the first organization if unassigned
UPDATE concentration_thresholds
SET organization_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
WHERE organization_id IS NULL
AND EXISTS (SELECT 1 FROM organizations LIMIT 1);

-- Seed default thresholds for ALL existing organizations
-- Single Vendor Concentration
INSERT INTO concentration_thresholds (
  organization_id,
  threshold_type,
  threshold_name,
  description,
  warning_level,
  critical_level,
  measurement_unit,
  is_active
)
SELECT
  o.id,
  'single_vendor',
  'Single Vendor Spend',
  'Maximum spend with any single vendor',
  5,
  10,
  'percentage',
  true
FROM organizations o
ON CONFLICT (organization_id, threshold_type) DO NOTHING;

-- Service Category Concentration
INSERT INTO concentration_thresholds (
  organization_id,
  threshold_type,
  threshold_name,
  description,
  warning_level,
  critical_level,
  measurement_unit,
  is_active
)
SELECT
  o.id,
  'service_category',
  'Service Category Concentration',
  'Maximum spend in any service category',
  20,
  35,
  'percentage',
  true
FROM organizations o
ON CONFLICT (organization_id, threshold_type) DO NOTHING;

-- Geographic Concentration
INSERT INTO concentration_thresholds (
  organization_id,
  threshold_type,
  threshold_name,
  description,
  warning_level,
  critical_level,
  measurement_unit,
  is_active
)
SELECT
  o.id,
  'geographic',
  'Geographic Concentration',
  'Maximum spend in any single country',
  30,
  50,
  'percentage',
  true
FROM organizations o
ON CONFLICT (organization_id, threshold_type) DO NOTHING;

-- Drop old role-based RLS policies
DROP POLICY IF EXISTS "Risk managers can delete concentration_thresholds" ON concentration_thresholds;
DROP POLICY IF EXISTS "Risk managers can insert concentration_thresholds" ON concentration_thresholds;
DROP POLICY IF EXISTS "Risk managers can update concentration_thresholds" ON concentration_thresholds;
DROP POLICY IF EXISTS "Users can view concentration_thresholds" ON concentration_thresholds;

-- Add organization-based RLS policies
CREATE POLICY "Organization members can view concentration thresholds"
  ON concentration_thresholds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
      AND ou.user_id = auth.uid()
      AND ou.is_active = true
    )
  );

CREATE POLICY "Authorized users can insert concentration thresholds"
  ON concentration_thresholds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
      AND ou.user_id = auth.uid()
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  );

CREATE POLICY "Authorized users can update concentration thresholds"
  ON concentration_thresholds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
      AND ou.user_id = auth.uid()
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
      AND ou.user_id = auth.uid()
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  );

CREATE POLICY "Authorized users can delete concentration thresholds"
  ON concentration_thresholds FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
      AND ou.user_id = auth.uid()
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  );

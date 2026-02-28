/*
  # Add organization_id column to tiering_assessments

  1. Modified Tables
    - `tiering_assessments`
      - Added `organization_id` (uuid, NOT NULL after backfill) - direct reference to the organization
      - Foreign key constraint to `organizations(id)`
      - Index for query performance

  2. Data Migration
    - Backfills organization_id from the related vendors record for all existing rows

  3. Notes
    - The application code already references this column in queries and inserts
    - This column was missing from the original schema, causing PostgREST schema cache errors
    - RLS policies continue to work through the vendor relationship chain
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN organization_id uuid;
  END IF;
END $$;

UPDATE tiering_assessments
SET organization_id = v.organization_id
FROM vendors v
WHERE v.id = tiering_assessments.vendor_id
  AND tiering_assessments.organization_id IS NULL;

ALTER TABLE tiering_assessments
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tiering_assessments_organization_id_fkey'
      AND table_name = 'tiering_assessments'
  ) THEN
    ALTER TABLE tiering_assessments
      ADD CONSTRAINT tiering_assessments_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tiering_assessments_organization_id
  ON tiering_assessments(organization_id);

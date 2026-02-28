/*
  # Add SLA Integration Fields to Performance Reviews

  1. Changes
    - Add `sla_compliance_rate` column to store calculated SLA compliance percentage
    - Add `sla_summary` column to store detailed SLA metrics snapshot as JSON
    - Add `organization_id` column for multi-tenant support (if not exists)

  2. Purpose
    - Enable automatic population of SLA data when creating performance reviews
    - Store point-in-time snapshot of vendor SLA performance
    - Support historical tracking of SLA compliance over time

  3. Notes
    - `sla_compliance_rate` is numeric (0-100) for standardized compliance percentage
    - `sla_summary` stores array of individual SLA metrics with targets and actuals
    - Uses IF NOT EXISTS to prevent errors if columns already exist
*/

-- Add organization_id if it doesn't exist (for multi-tenant support)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_reviews' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE performance_reviews
    ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

    -- Create index for better query performance
    CREATE INDEX IF NOT EXISTS idx_performance_reviews_org_id
    ON performance_reviews(organization_id);
  END IF;
END $$;

-- Add SLA compliance rate column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_reviews' AND column_name = 'sla_compliance_rate'
  ) THEN
    ALTER TABLE performance_reviews
    ADD COLUMN sla_compliance_rate numeric;

    COMMENT ON COLUMN performance_reviews.sla_compliance_rate IS
    'Calculated SLA compliance rate (0-100) at time of review creation';
  END IF;
END $$;

-- Add SLA summary column for detailed metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_reviews' AND column_name = 'sla_summary'
  ) THEN
    ALTER TABLE performance_reviews
    ADD COLUMN sla_summary jsonb;

    COMMENT ON COLUMN performance_reviews.sla_summary IS
    'Point-in-time snapshot of individual SLA metrics: [{name, target, actual, met}]';
  END IF;
END $$;

-- Create index on organization_id and vendor_id for common queries
CREATE INDEX IF NOT EXISTS idx_performance_reviews_vendor_org
ON performance_reviews(vendor_id, organization_id);

-- Update RLS policy if needed (organization-based access)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view performance reviews in their organization" ON performance_reviews;
  DROP POLICY IF EXISTS "Users can create performance reviews in their organization" ON performance_reviews;
  DROP POLICY IF EXISTS "Users can update performance reviews in their organization" ON performance_reviews;
  DROP POLICY IF EXISTS "Users can delete performance reviews in their organization" ON performance_reviews;
END $$;

-- Recreate policies with organization support
CREATE POLICY "Users can view performance reviews in their organization"
  ON performance_reviews FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create performance reviews in their organization"
  ON performance_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update performance reviews in their organization"
  ON performance_reviews FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete performance reviews in their organization"
  ON performance_reviews FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid()
    )
  );
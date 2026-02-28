/*
  # Add assessment_source column to onboarding_requests

  1. Modified Tables
    - `onboarding_requests`
      - Added `assessment_source` (text, default 'onboarding') to track the origin of the assessment

  2. Notes
    - This column already exists on the `vendors` table but was missing from `onboarding_requests`
    - Without it, all insert and update operations that include `assessment_source` fail with a column-not-found error
    - Existing rows will default to 'onboarding'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_source'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_source text DEFAULT 'onboarding';
  END IF;
END $$;

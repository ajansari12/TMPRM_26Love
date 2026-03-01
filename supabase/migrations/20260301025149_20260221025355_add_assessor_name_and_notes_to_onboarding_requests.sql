/*
  # Add assessor_name and assessment_notes columns to onboarding_requests
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assessor_name'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessor_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_notes'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_notes text;
  END IF;
END $$;

/*
  # Add assessor_name and assessment_notes columns to onboarding_requests

  ## Problem
  The assessment wizard (section 14 "Assessment Review") exposes two questions with
  IDs `assessor_name` and `assessment_notes`. These IDs are part of the
  `VALID_QUESTION_IDS` set, so user-entered values land in `formData.assessment_answers`
  and are spread as top-level keys into the INSERT/UPDATE payload. Because neither
  column existed in `onboarding_requests`, PostgREST rejected every save or submit
  attempt once those fields were filled, producing the "Failed to save draft" error.

  ## Changes
  - `onboarding_requests` table
    - Added `assessor_name` (text, nullable) — name of the person completing the assessment
    - Added `assessment_notes` (text, nullable) — free-text notes recorded by the assessor

  ## Notes
  Both columns are nullable so existing rows and partial drafts are unaffected.
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

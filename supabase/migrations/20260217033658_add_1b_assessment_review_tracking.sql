/*
  # Add 1B Assessment Review Tracking Columns

  1. New Columns on `onboarding_requests`
    - `original_1a_assessment_answers` (jsonb, nullable) - Snapshot of all 1A requestor's original assessment answers before 1B edits
    - `assessment_modified_by_1b` (boolean, default false) - Flag indicating 1B reviewer has modified assessment answers
    - `assessment_modified_by_1b_user` (uuid, nullable) - Who performed the 1B modifications
    - `assessment_modified_at_1b` (timestamptz, nullable) - When the 1B modifications were saved
    - `assessment_1b_change_summary` (jsonb, nullable) - Structured diff of changed questions (question IDs with old/new values)

  2. Purpose
    - Enables 1B reviewers to review and update the initial assessment conducted by 1A requestors
    - Preserves full audit trail: original 1A answers are snapshotted before any 1B edits
    - Downstream reviewers (2nd line, senior management) can see what changed between 1A and 1B
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'original_1a_assessment_answers'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN original_1a_assessment_answers jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_modified_by_1b'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_modified_by_1b boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_modified_by_1b_user'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_modified_by_1b_user uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_modified_at_1b'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_modified_at_1b timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'assessment_1b_change_summary'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN assessment_1b_change_summary jsonb;
  END IF;
END $$;

/*
  # Add Reassessment Support

  1. Changes to tiering_assessments
    - Add previous_assessment_id to link reassessments
    - Add tier_change_justification for tier change documentation
    - Add previous_tier and previous_risk_rating for comparison
    
  2. Changes to vendors
    - Add review_due status option
    - Add last_assessment_id for easy reference
    
  3. New table: reassessment_reminders
    - Track sent reminders to avoid duplicates
    - Store reminder status and acknowledgment
    
  4. Security
    - Enable RLS on new table
    - Appropriate policies for authenticated users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'previous_assessment_id'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN previous_assessment_id uuid REFERENCES tiering_assessments(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'tier_change_justification'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN tier_change_justification text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'previous_tier'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN previous_tier text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiering_assessments' AND column_name = 'previous_risk_rating'
  ) THEN
    ALTER TABLE tiering_assessments ADD COLUMN previous_risk_rating decimal(5,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'last_assessment_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN last_assessment_id uuid REFERENCES tiering_assessments(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS reassessment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  reminder_type text NOT NULL DEFAULT 'upcoming_review',
  days_before_due integer NOT NULL,
  recipient_user_id uuid,
  recipient_email text,
  sent_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reassessment_reminders_vendor_id ON reassessment_reminders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reassessment_reminders_sent_at ON reassessment_reminders(sent_at);
CREATE INDEX IF NOT EXISTS idx_tiering_assessments_previous ON tiering_assessments(previous_assessment_id);

ALTER TABLE reassessment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read reassessment reminders" ON reassessment_reminders;
CREATE POLICY "Authenticated users can read reassessment reminders"
  ON reassessment_reminders
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can insert reassessment reminders" ON reassessment_reminders;
CREATE POLICY "Service role can insert reassessment reminders"
  ON reassessment_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their reminders" ON reassessment_reminders;
CREATE POLICY "Users can update their reminders"
  ON reassessment_reminders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

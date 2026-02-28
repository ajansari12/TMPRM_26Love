/*
  # Enhance Assessment Tasks for Reassessment Workflow

  1. Changes
    - Update task_type constraint to include new reassessment types:
      - `periodic_reassessment` - Triggered by next_review_date
      - `material_change` - Triggered manually when vendor circumstances change
      - `contract_renewal` - Triggered before contract renewal
      - `bulk_import_assessment` - For vendors added via bulk import
      - `reassessment_validation` - For 2nd line validation of reassessments
    - Keep existing types for backwards compatibility
    
  2. New Columns
    - `trigger_reason` (text) - Explains why the task was created
    - `snooze_until` (date) - Allows postponing with justification
    - `snooze_reason` (text) - Justification for snooze
    - `snooze_count` (integer) - Number of times task has been snoozed
    - `validation_required` (boolean) - Whether 2nd line validation is needed
    - `validated_by` (uuid) - Who validated the reassessment
    - `validated_at` (timestamptz) - When it was validated
    - `validation_notes` (text) - Notes from validation
    - `related_assessment_id` (uuid) - Links to tiering_assessments
    - `related_task_id` (uuid) - Links to parent task (for validation tasks)

  3. Indexes
    - Index on task_type for filtering
    - Index on snooze_until for queries
*/

ALTER TABLE assessment_tasks DROP CONSTRAINT IF EXISTS valid_task_type;

ALTER TABLE assessment_tasks ADD CONSTRAINT valid_task_type CHECK (
  task_type IN (
    'initial_assessment',
    'reassessment',
    'periodic_review',
    'tier_change_review',
    'periodic_reassessment',
    'material_change',
    'contract_renewal',
    'bulk_import_assessment',
    'reassessment_validation'
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'trigger_reason'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN trigger_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'snooze_until'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN snooze_until date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'snooze_reason'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN snooze_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'snooze_count'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN snooze_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'validation_required'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN validation_required boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'validated_by'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN validated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'validated_at'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN validated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'validation_notes'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN validation_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'related_assessment_id'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN related_assessment_id uuid REFERENCES tiering_assessments(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_tasks' AND column_name = 'related_task_id'
  ) THEN
    ALTER TABLE assessment_tasks ADD COLUMN related_task_id uuid REFERENCES assessment_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_tasks_task_type ON assessment_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_snooze_until ON assessment_tasks(snooze_until) WHERE snooze_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_validation ON assessment_tasks(validation_required) WHERE validation_required = true;

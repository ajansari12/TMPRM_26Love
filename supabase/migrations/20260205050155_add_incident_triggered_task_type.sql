/*
  # Add 'incident_triggered' to assessment_tasks task_type CHECK constraint

  1. Changes
    - Expands the valid_task_type constraint to include 'incident_triggered'
    - This task type is created automatically when critical/high severity incidents
      are reported on Tier 4-5 vendors

  2. Task Types Supported
    - initial_assessment: First assessment during vendor onboarding
    - reassessment: General reassessment task
    - periodic_review: Scheduled periodic review
    - tier_change_review: Triggered when vendor tier changes
    - periodic_reassessment: Scheduled periodic reassessment
    - material_change: Triggered by material business changes
    - contract_renewal: Triggered during contract renewal process
    - bulk_import_assessment: Assessment needed after bulk vendor import
    - reassessment_validation: Second line validation of reassessment
    - incident_triggered: NEW - Triggered by critical/high severity incidents

  3. Security
    - No changes to RLS policies needed
    - Existing policies continue to apply
*/

-- Drop the existing constraint
ALTER TABLE assessment_tasks DROP CONSTRAINT IF EXISTS valid_task_type;

-- Re-create with the new 'incident_triggered' value included
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
    'reassessment_validation',
    'incident_triggered'
  )
);

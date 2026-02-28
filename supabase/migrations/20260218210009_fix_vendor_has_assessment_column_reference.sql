/*
  # Fix vendor_has_assessment function column reference

  1. Changes
    - Update `vendor_has_assessment` function to reference `calculated_tier` instead of non-existent `final_tier`
    - This fixes the "Failed to change status" error when transitioning vendors to active status

  2. Root Cause
    - The `vendor_has_assessment` function was querying `tiering_assessments.final_tier` which does not exist
    - The correct column name is `calculated_tier`
    - This caused a runtime error every time the `enforce_vendor_assessment` trigger fired on vendor status changes to active
*/

CREATE OR REPLACE FUNCTION vendor_has_assessment(vendor_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tiering_assessments
    WHERE tiering_assessments.vendor_id = vendor_has_assessment.vendor_id
    AND status = 'completed'
    AND calculated_tier IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

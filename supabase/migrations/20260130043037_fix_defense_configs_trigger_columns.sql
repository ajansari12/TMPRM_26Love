/*
  # Fix Defense Line Configs Trigger Columns

  ## Problem
  The trigger function uses incorrect column names that don't match the actual table schema.

  ## Actual Columns
  - display_name (not "name")
  - is_required_in_workflow, can_skip_for_low_risk, review_sla_hours, etc.

  ## Solution
  Update the function to use correct column names.
*/

CREATE OR REPLACE FUNCTION create_default_defense_configs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO defense_line_configs (
    organization_id, 
    defense_line, 
    display_name, 
    description, 
    is_required_in_workflow, 
    can_skip_for_low_risk, 
    review_sla_hours, 
    escalation_after_hours,
    notify_on_new_request,
    notify_on_overdue
  )
  VALUES
    (NEW.id, '1a', 'First Line - Business', 'Business units that own vendor relationships', true, true, 48, 72, true, true),
    (NEW.id, '1b', 'First Line - Oversight', 'First line oversight and coordination', true, true, 48, 72, true, true),
    (NEW.id, '2nd', 'Second Line - Risk', 'Independent risk management function', true, false, 72, 96, true, true),
    (NEW.id, 'admin', 'Administrator', 'System administrators with full access', false, true, 24, 48, true, true)
  ON CONFLICT (organization_id, defense_line) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

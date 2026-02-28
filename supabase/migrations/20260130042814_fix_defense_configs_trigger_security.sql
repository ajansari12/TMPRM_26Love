/*
  # Fix Defense Line Configs Trigger Security

  ## Problem
  The `create_default_defense_configs` trigger function runs with user permissions
  and is subject to RLS. When creating an organization, the user isn't an admin yet,
  so the INSERT into defense_line_configs fails.

  ## Solution
  Recreate the function with SECURITY DEFINER to bypass RLS.
*/

-- Get the existing function definition and recreate with SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_default_defense_configs()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default defense line configurations for the new organization
  INSERT INTO defense_line_configs (organization_id, defense_line, name, description, can_create_requests, can_review, can_approve, can_manage_users, can_configure_workflows)
  VALUES
    (NEW.id, '1a', 'First Line - Business', 'Business units that own vendor relationships', true, false, false, false, false),
    (NEW.id, '1b', 'First Line - Oversight', 'First line oversight and coordination', true, true, false, false, false),
    (NEW.id, '2nd', 'Second Line - Risk', 'Independent risk management function', false, true, true, false, false),
    (NEW.id, 'admin', 'Administrator', 'System administrators with full access', true, true, true, true, true)
  ON CONFLICT (organization_id, defense_line) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

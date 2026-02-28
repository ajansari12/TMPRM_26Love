/*
  # Fix Organization Creator Membership

  This migration adds a database trigger to automatically add the organization
  creator as an admin member when a new organization is created.

  ## Problem Solved
  - RLS policies on organization_users block the creator from inserting their own
    membership because they're not yet a member (chicken-and-egg problem)
  - The trigger runs with elevated privileges, bypassing RLS

  ## Changes
  1. New Functions
    - `add_organization_creator_as_admin()` - Trigger function that inserts the
      creator into organization_users with full admin permissions

  2. New Triggers
    - `on_organization_created` - AFTER INSERT trigger on organizations table
      that calls the function above

  ## Security
  - Trigger function uses SECURITY DEFINER to bypass RLS
  - Only runs on INSERT, not on UPDATE or DELETE
  - Uses NEW.created_by to ensure only the actual creator is added
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION add_organization_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if created_by is set
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO organization_users (
      organization_id,
      user_id,
      defense_line,
      role_title,
      can_create_requests,
      can_review,
      can_approve,
      can_manage_users,
      can_configure_workflows,
      can_approve_critical,
      is_active
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'admin',
      'Administrator',
      true,
      true,
      true,
      true,
      true,
      true,
      true
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_organization_created ON organizations;

-- Create the trigger
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION add_organization_creator_as_admin();

/*
  # Fix RLS Violations, Platform Admin Infrastructure & Org Creation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'legal_name'
  ) THEN
    ALTER TABLE organizations ADD COLUMN legal_name text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view platform admin records" ON platform_admins;
CREATE POLICY "Platform admins can view platform admin records"
  ON platform_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid()
    AND is_active = true
  );
$$;

DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR id = ANY(get_user_organization_ids())
  );

DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
CREATE POLICY "Admins can update their organization"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    is_platform_admin()
    OR is_org_admin(id)
  )
  WITH CHECK (
    is_platform_admin()
    OR is_org_admin(id)
  );

CREATE OR REPLACE FUNCTION create_default_defense_configs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO defense_line_configs (organization_id, defense_line, display_name, description)
  VALUES
    (NEW.id, '1a', 'Business Functions', 'First line of defense - business owners and requestors'),
    (NEW.id, '1b', 'Business Unit Risk Coordinators', 'First line of defense - departmental review and confirmation'),
    (NEW.id, '2nd', 'Risk Management & Compliance', 'Second line of defense - independent oversight and approval'),
    (NEW.id, '3rd', 'Internal Audit', 'Third line of defense - independent assurance'),
    (NEW.id, 'admin', 'Administrators', 'Platform and workflow administrators');

  RETURN NEW;
END;
$$;

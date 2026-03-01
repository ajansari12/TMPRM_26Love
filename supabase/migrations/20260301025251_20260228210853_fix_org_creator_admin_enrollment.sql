/*
  # Fix Organization Creator Admin Enrollment
*/

CREATE OR REPLACE FUNCTION auto_add_org_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
      is_active
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'admin',
      'Organization Administrator',
      true,
      true,
      true,
      true,
      true,
      true
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_add_creator_as_admin ON organizations;
CREATE TRIGGER auto_add_creator_as_admin
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_org_creator_as_admin();

DROP POLICY IF EXISTS "Org creator can enroll themselves as admin" ON organization_users;
CREATE POLICY "Org creator can enroll themselves as admin"
  ON organization_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND defense_line = 'admin'
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE id = organization_id
      AND created_by = auth.uid()
    )
  );

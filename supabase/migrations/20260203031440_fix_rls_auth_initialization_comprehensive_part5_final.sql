/*
  # Fix RLS Auth Initialization - Comprehensive Part 5 (Final)

  ## Tables covered:
    - onboarding_requests
    - assessment_tasks
*/

-- onboarding_requests
DROP POLICY IF EXISTS "Users can update appropriate onboarding requests" ON onboarding_requests;
CREATE POLICY "Users can update appropriate onboarding requests" ON onboarding_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = onboarding_requests.organization_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = onboarding_requests.organization_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.is_active = true
    )
  );

-- assessment_tasks
DROP POLICY IF EXISTS "Assigned users can update their tasks" ON assessment_tasks;
DROP POLICY IF EXISTS "Organization admins can delete assessment tasks" ON assessment_tasks;
DROP POLICY IF EXISTS "Organization admins can insert assessment tasks" ON assessment_tasks;
DROP POLICY IF EXISTS "Organization members can view assessment tasks" ON assessment_tasks;

CREATE POLICY "Assigned users can update their tasks" ON assessment_tasks FOR UPDATE TO authenticated
  USING (
    assigned_to = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = assessment_tasks.organization_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.can_complete_assessments = true
      AND ou.is_active = true
    )
  )
  WITH CHECK (
    assigned_to = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = assessment_tasks.organization_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.can_complete_assessments = true
      AND ou.is_active = true
    )
  );

CREATE POLICY "Organization admins can delete assessment tasks" ON assessment_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = assessment_tasks.organization_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  );

CREATE POLICY "Organization admins can insert assessment tasks" ON assessment_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = assessment_tasks.organization_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  );

CREATE POLICY "Organization members can view assessment tasks" ON assessment_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = assessment_tasks.organization_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.is_active = true
    )
  );
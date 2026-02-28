/*
  # Security Fix Part 1: Missing FK Indexes and RLS Auth Initialization

  ## Summary
  Fixes two categories of security/performance issues:

  ### 1. Missing Foreign Key Indexes
  Adds covering indexes for four unindexed foreign keys to prevent sequential
  scans during cascading deletes and JOIN operations.

  - `offboarding_tasks.assigned_to` → auth.users(id)
  - `offboarding_tasks.completed_by` → auth.users(id)
  - `onboarding_request_templates.created_by` → auth.users(id)
  - `vendor_creation_audit.onboarding_request_id` → onboarding_requests(id)

  ### 2. RLS Auth Initialization Plan
  Replaces bare `auth.uid()` calls in RLS USING/WITH CHECK clauses with
  `(select auth.uid())`. The subselect form is evaluated once per query
  rather than once per row, which prevents re-initialization overhead at scale.

  Affected policies:
  - vendors: "Users can view vendors by defense line"
  - notifications: all 4 policies
  - performance_reviews: all 4 policies
  - offboarding_tasks: all 4 policies
  - onboarding_request_templates: all 4 policies
  - concentration_thresholds: all 4 policies
  - onboarding_requests: "Users can view onboarding requests by defense line"
*/

-- ============================================================
-- 1. MISSING FK INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_offboarding_tasks_assigned_to
  ON public.offboarding_tasks (assigned_to);

CREATE INDEX IF NOT EXISTS idx_offboarding_tasks_completed_by
  ON public.offboarding_tasks (completed_by);

CREATE INDEX IF NOT EXISTS idx_onboarding_request_templates_created_by
  ON public.onboarding_request_templates (created_by);

CREATE INDEX IF NOT EXISTS idx_vendor_creation_audit_onboarding_request_id
  ON public.vendor_creation_audit (onboarding_request_id);

-- ============================================================
-- 2. RLS AUTH INITIALIZATION: vendors
-- ============================================================

DROP POLICY IF EXISTS "Users can view vendors by defense line" ON public.vendors;
CREATE POLICY "Users can view vendors by defense line"
  ON public.vendors FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
        AND ou.organization_id = vendors.organization_id
        AND ou.is_active = true
    ))
    AND (
      (get_effective_defense_line(organization_id) IS DISTINCT FROM '1a')
      OR (created_by = (SELECT auth.uid()))
      OR (EXISTS (
        SELECT 1 FROM public.onboarding_requests orq
        WHERE orq.created_vendor_id = vendors.id
          AND orq.requested_by = (SELECT auth.uid())
      ))
    )
  );

-- ============================================================
-- 3. RLS AUTH INITIALIZATION: notifications
-- ============================================================

DROP POLICY IF EXISTS "Organization members can create notifications" ON public.notifications;
CREATE POLICY "Organization members can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL)
    OR (EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
        AND ou.organization_id = notifications.organization_id
        AND ou.is_active = true
    ))
  );

DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (
    (target_user_id = (SELECT auth.uid()))
    OR (
      organization_id IS NOT NULL
      AND (EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.user_id = (SELECT auth.uid())
          AND ou.organization_id = notifications.organization_id
          AND (ou.defense_line)::text = ANY (ARRAY['admin', '2nd'])
          AND ou.is_active = true
      ))
    )
  );

DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
CREATE POLICY "Users can read their notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    (target_user_id = (SELECT auth.uid()))
    OR (
      target_role IS NOT NULL
      AND (EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.user_id = (SELECT auth.uid())
          AND ou.organization_id = notifications.organization_id
          AND (ou.defense_line)::text = notifications.target_role
          AND ou.is_active = true
      ))
    )
    OR (
      target_user_id IS NULL
      AND target_role IS NULL
      AND organization_id IS NOT NULL
      AND (EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.user_id = (SELECT auth.uid())
          AND ou.organization_id = notifications.organization_id
          AND ou.is_active = true
      ))
    )
  );

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    (target_user_id = (SELECT auth.uid()))
    OR (
      target_role IS NOT NULL
      AND (EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.user_id = (SELECT auth.uid())
          AND ou.organization_id = notifications.organization_id
          AND (ou.defense_line)::text = notifications.target_role
          AND ou.is_active = true
      ))
    )
    OR (
      target_user_id IS NULL
      AND target_role IS NULL
      AND organization_id IS NOT NULL
      AND (EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.user_id = (SELECT auth.uid())
          AND ou.organization_id = notifications.organization_id
          AND ou.is_active = true
      ))
    )
  );

-- ============================================================
-- 4. RLS AUTH INITIALIZATION: performance_reviews
-- ============================================================

DROP POLICY IF EXISTS "Users can view performance reviews in their organization" ON public.performance_reviews;
CREATE POLICY "Users can view performance reviews in their organization"
  ON public.performance_reviews FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create performance reviews in their organization" ON public.performance_reviews;
CREATE POLICY "Users can create performance reviews in their organization"
  ON public.performance_reviews FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update performance reviews in their organization" ON public.performance_reviews;
CREATE POLICY "Users can update performance reviews in their organization"
  ON public.performance_reviews FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete performance reviews in their organization" ON public.performance_reviews;
CREATE POLICY "Users can delete performance reviews in their organization"
  ON public.performance_reviews FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 5. RLS AUTH INITIALIZATION: offboarding_tasks
-- ============================================================

DROP POLICY IF EXISTS "Users can view offboarding tasks in their organization" ON public.offboarding_tasks;
CREATE POLICY "Users can view offboarding tasks in their organization"
  ON public.offboarding_tasks FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create offboarding tasks in their organization" ON public.offboarding_tasks;
CREATE POLICY "Users can create offboarding tasks in their organization"
  ON public.offboarding_tasks FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update offboarding tasks in their organization" ON public.offboarding_tasks;
CREATE POLICY "Users can update offboarding tasks in their organization"
  ON public.offboarding_tasks FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete offboarding tasks in their organization" ON public.offboarding_tasks;
CREATE POLICY "Users can delete offboarding tasks in their organization"
  ON public.offboarding_tasks FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 6. RLS AUTH INITIALIZATION: onboarding_request_templates
-- ============================================================

DROP POLICY IF EXISTS "Users can view templates for their organization" ON public.onboarding_request_templates;
CREATE POLICY "Users can view templates for their organization"
  ON public.onboarding_request_templates FOR SELECT TO authenticated
  USING (
    (is_system_template = true)
    OR (organization_id IN (
      SELECT organization_users.organization_id
      FROM public.organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Admins can insert templates" ON public.onboarding_request_templates;
CREATE POLICY "Admins can insert templates"
  ON public.onboarding_request_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = onboarding_request_templates.organization_id
        AND organization_users.user_id = (SELECT auth.uid())
        AND (organization_users.can_manage_users = true OR organization_users.can_configure_workflows = true)
    )
  );

DROP POLICY IF EXISTS "Admins can update templates" ON public.onboarding_request_templates;
CREATE POLICY "Admins can update templates"
  ON public.onboarding_request_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = onboarding_request_templates.organization_id
        AND organization_users.user_id = (SELECT auth.uid())
        AND (organization_users.can_manage_users = true OR organization_users.can_configure_workflows = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = onboarding_request_templates.organization_id
        AND organization_users.user_id = (SELECT auth.uid())
        AND (organization_users.can_manage_users = true OR organization_users.can_configure_workflows = true)
    )
  );

DROP POLICY IF EXISTS "Admins can delete templates" ON public.onboarding_request_templates;
CREATE POLICY "Admins can delete templates"
  ON public.onboarding_request_templates FOR DELETE TO authenticated
  USING (
    (is_system_template = false)
    AND (EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = onboarding_request_templates.organization_id
        AND organization_users.user_id = (SELECT auth.uid())
        AND (organization_users.can_manage_users = true OR organization_users.can_configure_workflows = true)
    ))
  );

-- ============================================================
-- 7. RLS AUTH INITIALIZATION: concentration_thresholds
-- ============================================================

DROP POLICY IF EXISTS "Organization members can view concentration thresholds" ON public.concentration_thresholds;
CREATE POLICY "Organization members can view concentration thresholds"
  ON public.concentration_thresholds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
        AND ou.user_id = (SELECT auth.uid())
        AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS "Authorized users can insert concentration thresholds" ON public.concentration_thresholds;
CREATE POLICY "Authorized users can insert concentration thresholds"
  ON public.concentration_thresholds FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
        AND ou.user_id = (SELECT auth.uid())
        AND ou.can_configure_workflows = true
        AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS "Authorized users can update concentration thresholds" ON public.concentration_thresholds;
CREATE POLICY "Authorized users can update concentration thresholds"
  ON public.concentration_thresholds FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
        AND ou.user_id = (SELECT auth.uid())
        AND ou.can_configure_workflows = true
        AND ou.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
        AND ou.user_id = (SELECT auth.uid())
        AND ou.can_configure_workflows = true
        AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS "Authorized users can delete concentration thresholds" ON public.concentration_thresholds;
CREATE POLICY "Authorized users can delete concentration thresholds"
  ON public.concentration_thresholds FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = concentration_thresholds.organization_id
        AND ou.user_id = (SELECT auth.uid())
        AND ou.can_configure_workflows = true
        AND ou.is_active = true
    )
  );

-- ============================================================
-- 8. RLS AUTH INITIALIZATION: onboarding_requests
-- ============================================================

DROP POLICY IF EXISTS "Users can view onboarding requests by defense line" ON public.onboarding_requests;
CREATE POLICY "Users can view onboarding requests by defense line"
  ON public.onboarding_requests FOR SELECT TO authenticated
  USING (
    (organization_id = ANY (get_user_organization_ids()))
    AND (
      (get_effective_defense_line(organization_id) IS DISTINCT FROM '1a')
      OR (requested_by = (SELECT auth.uid()))
    )
  );

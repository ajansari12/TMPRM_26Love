/*
  # Secure RLS Policies - Part 1: Helper Function + Organization and Vendor-Scoped Tables

  1. New Functions
    - `get_user_org_ids()` - Returns all organization IDs the authenticated user belongs to
    - Uses existing `is_platform_admin()` function for cross-org admin access

  2. Security Changes
    - Replace 17 overly permissive `USING (true)` / `WITH CHECK (true)` policies
      with proper organization-scoped checks

    Tables updated (direct organization_id):
    - `audit_logs` (SELECT, INSERT) - scoped to user's organization
    - `performance_reviews` (SELECT) - scoped to user's organization
    - `vendor_documents` (SELECT) - scoped to user's organization
    - `platform_audit_log` (INSERT) - restricted to authenticated org members (was public)

    Tables updated (vendor_id -> vendors.organization_id):
    - `contracts` (SELECT) - scoped through vendor's organization
    - `due_diligence` (SELECT) - scoped through vendor's organization
    - `incidents` (SELECT) - scoped through vendor's organization
    - `reassessment_reminders` (SELECT, INSERT, UPDATE) - scoped through vendor's organization
    - `review_completions` (SELECT) - scoped through vendor's organization
    - `review_notifications` (SELECT) - scoped through vendor's organization
    - `review_schedules` (SELECT) - scoped through vendor's organization
    - `subcontractors` (SELECT) - scoped through vendor's organization
    - `tiering_assessments` (SELECT) - scoped through vendor's organization
    - `workflow_history` (INSERT) - scoped through vendor's organization

  3. Important Notes
    - All data access is now restricted to users who are active members of the relevant organization
    - Platform admins retain cross-organization access for administrative purposes
    - Helper function uses SECURITY DEFINER with fixed search_path for safety
*/

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_users
  WHERE user_id = auth.uid()
  AND is_active = true;
$$;

-- ============================================
-- AUDIT_LOGS: has organization_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read audit_logs" ON audit_logs;
CREATE POLICY "Org members can read own audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "System can insert audit_logs" ON audit_logs;
CREATE POLICY "Org members can insert own audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- PERFORMANCE_REVIEWS: has organization_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read performance_reviews" ON performance_reviews;
CREATE POLICY "Org members can read own performance reviews"
  ON performance_reviews FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- VENDOR_DOCUMENTS: has organization_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read vendor_documents" ON vendor_documents;
CREATE POLICY "Org members can read own vendor documents"
  ON vendor_documents FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- PLATFORM_AUDIT_LOG: has organization_id, was allowing public inserts
-- ============================================
DROP POLICY IF EXISTS "System can insert audit log" ON platform_audit_log;
CREATE POLICY "Authenticated org members can insert platform audit log"
  ON platform_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- CONTRACTS: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read contracts" ON contracts;
CREATE POLICY "Org members can read contracts for own vendors"
  ON contracts FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- DUE_DILIGENCE: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read due_diligence" ON due_diligence;
CREATE POLICY "Org members can read due diligence for own vendors"
  ON due_diligence FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- INCIDENTS: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read incidents" ON incidents;
CREATE POLICY "Org members can read incidents for own vendors"
  ON incidents FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- REASSESSMENT_REMINDERS: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read reassessment reminders" ON reassessment_reminders;
CREATE POLICY "Org members can read reassessment reminders for own vendors"
  ON reassessment_reminders FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Service role can insert reassessment reminders" ON reassessment_reminders;
CREATE POLICY "Org members can insert reassessment reminders for own vendors"
  ON reassessment_reminders FOR INSERT TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Users can update their reminders" ON reassessment_reminders;
CREATE POLICY "Org members can update reassessment reminders for own vendors"
  ON reassessment_reminders FOR UPDATE TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- REVIEW_COMPLETIONS: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read review_completions" ON review_completions;
CREATE POLICY "Org members can read review completions for own vendors"
  ON review_completions FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- REVIEW_NOTIFICATIONS: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read review_notifications" ON review_notifications;
CREATE POLICY "Org members can read review notifications for own vendors"
  ON review_notifications FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- REVIEW_SCHEDULES: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read review_schedules" ON review_schedules;
CREATE POLICY "Org members can read review schedules for own vendors"
  ON review_schedules FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- SUBCONTRACTORS: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read subcontractors" ON subcontractors;
CREATE POLICY "Org members can read subcontractors for own vendors"
  ON subcontractors FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- TIERING_ASSESSMENTS: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read assessments" ON tiering_assessments;
CREATE POLICY "Org members can read assessments for own vendors"
  ON tiering_assessments FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- WORKFLOW_HISTORY: has vendor_id
-- ============================================
DROP POLICY IF EXISTS "System can insert workflow history" ON workflow_history;
CREATE POLICY "Org members can insert workflow history for own vendors"
  ON workflow_history FOR INSERT TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

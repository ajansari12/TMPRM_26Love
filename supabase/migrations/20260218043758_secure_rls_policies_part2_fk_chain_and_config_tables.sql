/*
  # Secure RLS Policies - Part 2: FK-Chain, Attestation, Workflow, and Config Tables

  1. Security Changes
    - Replace remaining ~30 overly permissive `USING (true)` / `WITH CHECK (true)` policies
      with proper access checks

    Tables updated (FK-chain scoped through parent relationships):
    - `contract_reviews` (SELECT) - scoped through contract -> vendor -> organization
    - `osfi_notifications` (SELECT) - scoped through incident -> vendor -> organization

    Tables updated (attestation - require active org membership):
    - `attestation_periods` (SELECT)
    - `attestation_requirements` (SELECT)
    - `attestation_responses` (SELECT, INSERT, UPDATE)
    - `attestation_submissions` (SELECT)

    Tables updated (workflow - require active org membership):
    - `workflow_approvals` (SELECT, INSERT)
    - `workflow_configurations` (SELECT)
    - `workflow_instances` (SELECT)

    Tables updated (system config/reference - require active org membership):
    - `approval_requirements` (SELECT)
    - `category_weights` (SELECT) - also removes duplicate policy
    - `concentration_snapshots` (SELECT, INSERT)
    - `document_types` (SELECT)
    - `kri_history` (SELECT, INSERT)
    - `kri_thresholds` (SELECT)
    - `lifecycle_config` (SELECT)
    - `osfi_b10_requirements` (SELECT)
    - `osfi_notification_templates` (SELECT)
    - `risk_appetite_history` (SELECT, INSERT)
    - `risk_appetite_metrics` (SELECT)
    - `role_permissions` (SELECT)
    - `scheduled_jobs` (SELECT)

  2. Important Notes
    - FK-chain tables scoped through parent table relationships to user's organization
    - Attestation, workflow, and config tables with no organization column require
      the user to be an active member of at least one organization or be a platform admin
    - Duplicate category_weights SELECT policy removed
    - Platform admins retain full cross-organization access
*/

-- ============================================
-- CONTRACT_REVIEWS: contract_id -> contracts.vendor_id -> vendors.organization_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read contract_reviews" ON contract_reviews;
CREATE POLICY "Org members can read contract reviews for own vendors"
  ON contract_reviews FOR SELECT TO authenticated
  USING (
    contract_id IN (
      SELECT c.id FROM contracts c
      JOIN vendors v ON v.id = c.vendor_id
      WHERE v.organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- OSFI_NOTIFICATIONS: incident_id -> incidents.vendor_id -> vendors.organization_id
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read osfi_notifications" ON osfi_notifications;
CREATE POLICY "Org members can read OSFI notifications for own vendors"
  ON osfi_notifications FOR SELECT TO authenticated
  USING (
    incident_id IN (
      SELECT i.id FROM incidents i
      JOIN vendors v ON v.id = i.vendor_id
      WHERE v.organization_id IN (SELECT get_user_org_ids())
    )
    OR is_platform_admin()
  );

-- ============================================
-- ATTESTATION_PERIODS: no org_id, require org membership
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read attestation_periods" ON attestation_periods;
CREATE POLICY "Active org members can read attestation periods"
  ON attestation_periods FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- ATTESTATION_REQUIREMENTS: no org_id, require org membership
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read attestation_requirements" ON attestation_requirements;
CREATE POLICY "Active org members can read attestation requirements"
  ON attestation_requirements FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- ATTESTATION_RESPONSES: no org_id, require org membership
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read attestation_responses" ON attestation_responses;
CREATE POLICY "Active org members can read attestation responses"
  ON attestation_responses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Users can insert attestation_responses" ON attestation_responses;
CREATE POLICY "Active org members can insert attestation responses"
  ON attestation_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Users can update attestation_responses" ON attestation_responses;
CREATE POLICY "Active org members can update attestation responses"
  ON attestation_responses FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- ATTESTATION_SUBMISSIONS: no org_id, require org membership
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read attestation_submissions" ON attestation_submissions;
CREATE POLICY "Active org members can read attestation submissions"
  ON attestation_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- WORKFLOW_APPROVALS: instance_id, require org membership
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read workflow_approvals" ON workflow_approvals;
CREATE POLICY "Active org members can read workflow approvals"
  ON workflow_approvals FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Approvers can insert workflow_approvals" ON workflow_approvals;
CREATE POLICY "Active org members can insert workflow approvals"
  ON workflow_approvals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- WORKFLOW_CONFIGURATIONS: no org_id, require org membership
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read workflow_configurations" ON workflow_configurations;
CREATE POLICY "Active org members can read workflow configurations"
  ON workflow_configurations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- WORKFLOW_INSTANCES: no org_id, require org membership
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read workflow_instances" ON workflow_instances;
CREATE POLICY "Active org members can read workflow instances"
  ON workflow_instances FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ============================================
-- SYSTEM CONFIG/REFERENCE TABLES
-- All require active org membership or platform admin
-- ============================================

-- APPROVAL_REQUIREMENTS
DROP POLICY IF EXISTS "Authenticated users can read approval requirements" ON approval_requirements;
CREATE POLICY "Active org members can read approval requirements"
  ON approval_requirements FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- CATEGORY_WEIGHTS (remove duplicate policy too)
DROP POLICY IF EXISTS "Authenticated users can read category weights" ON category_weights;
DROP POLICY IF EXISTS "Authenticated users can read category_weights" ON category_weights;
CREATE POLICY "Active org members can read category weights"
  ON category_weights FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- CONCENTRATION_SNAPSHOTS
DROP POLICY IF EXISTS "Authenticated users can read concentration_snapshots" ON concentration_snapshots;
CREATE POLICY "Active org members can read concentration snapshots"
  ON concentration_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "System can insert concentration_snapshots" ON concentration_snapshots;
CREATE POLICY "Active org members can insert concentration snapshots"
  ON concentration_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- DOCUMENT_TYPES
DROP POLICY IF EXISTS "Authenticated users can read document_types" ON document_types;
CREATE POLICY "Active org members can read document types"
  ON document_types FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- KRI_HISTORY
DROP POLICY IF EXISTS "Authenticated users can read kri_history" ON kri_history;
CREATE POLICY "Active org members can read KRI history"
  ON kri_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Authenticated users can insert kri_history" ON kri_history;
CREATE POLICY "Active org members can insert KRI history"
  ON kri_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- KRI_THRESHOLDS
DROP POLICY IF EXISTS "Authenticated users can read kri_thresholds" ON kri_thresholds;
CREATE POLICY "Active org members can read KRI thresholds"
  ON kri_thresholds FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- LIFECYCLE_CONFIG
DROP POLICY IF EXISTS "Authenticated users can read lifecycle_config" ON lifecycle_config;
CREATE POLICY "Active org members can read lifecycle config"
  ON lifecycle_config FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- OSFI_B10_REQUIREMENTS
DROP POLICY IF EXISTS "Authenticated users can read requirements" ON osfi_b10_requirements;
CREATE POLICY "Active org members can read OSFI B10 requirements"
  ON osfi_b10_requirements FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- OSFI_NOTIFICATION_TEMPLATES
DROP POLICY IF EXISTS "Authenticated users can read osfi_notification_templates" ON osfi_notification_templates;
CREATE POLICY "Active org members can read OSFI notification templates"
  ON osfi_notification_templates FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- RISK_APPETITE_HISTORY
DROP POLICY IF EXISTS "Authenticated users can read risk_appetite_history" ON risk_appetite_history;
CREATE POLICY "Active org members can read risk appetite history"
  ON risk_appetite_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "System can insert risk_appetite_history" ON risk_appetite_history;
CREATE POLICY "Active org members can insert risk appetite history"
  ON risk_appetite_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- RISK_APPETITE_METRICS
DROP POLICY IF EXISTS "Authenticated users can read risk_appetite_metrics" ON risk_appetite_metrics;
CREATE POLICY "Active org members can read risk appetite metrics"
  ON risk_appetite_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- ROLE_PERMISSIONS
DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON role_permissions;
CREATE POLICY "Active org members can read role permissions"
  ON role_permissions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

-- SCHEDULED_JOBS
DROP POLICY IF EXISTS "Authenticated users can read scheduled_jobs" ON scheduled_jobs;
CREATE POLICY "Active org members can read scheduled jobs"
  ON scheduled_jobs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_user_org_ids())
    OR is_platform_admin()
  );

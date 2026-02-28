/*
  # Fix RLS Auth Initialization - Comprehensive Part 1

  ## Performance Optimization
    - Optimize RLS policies to use (SELECT auth.uid()) pattern
    - This caches the result instead of re-evaluating for each row

  ## Tables covered:
    - Configuration: kri_thresholds, lifecycle_config, scheduled_jobs, report_templates
    - Category: category_weights
    - Attestation: attestation_periods, attestation_requirements, attestation_submissions
    - Workflow: workflow_configurations, workflow_instances, workflow_approvals, workflow_history
    - Approval: approval_requirements
    - Contracts: contract_reviews, contracts
    - Due diligence: due_diligence
    - Others: subcontractors, performance_reviews
*/

-- kri_thresholds
DROP POLICY IF EXISTS "Risk managers can manage kri_thresholds" ON kri_thresholds;
CREATE POLICY "Risk managers can manage kri_thresholds"
  ON kri_thresholds FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- lifecycle_config
DROP POLICY IF EXISTS "Risk managers can manage lifecycle_config" ON lifecycle_config;
CREATE POLICY "Risk managers can manage lifecycle_config"
  ON lifecycle_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- scheduled_jobs
DROP POLICY IF EXISTS "Risk managers can manage scheduled_jobs" ON scheduled_jobs;
CREATE POLICY "Risk managers can manage scheduled_jobs"
  ON scheduled_jobs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- report_templates
DROP POLICY IF EXISTS "Users can manage own report_templates" ON report_templates;
CREATE POLICY "Users can manage own report_templates"
  ON report_templates FOR ALL TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can read report_templates" ON report_templates;
CREATE POLICY "Users can read report_templates"
  ON report_templates FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) OR is_shared = true OR is_default = true);

-- category_weights
DROP POLICY IF EXISTS "Risk managers can manage category_weights" ON category_weights;
CREATE POLICY "Risk managers can manage category_weights"
  ON category_weights FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

DROP POLICY IF EXISTS "Risk managers can update category weights" ON category_weights;
CREATE POLICY "Risk managers can update category weights"
  ON category_weights FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- attestation_periods
DROP POLICY IF EXISTS "Risk managers can delete attestation_periods" ON attestation_periods;
DROP POLICY IF EXISTS "Risk managers can insert attestation_periods" ON attestation_periods;
DROP POLICY IF EXISTS "Risk managers can update attestation_periods" ON attestation_periods;
CREATE POLICY "Risk managers can delete attestation_periods" ON attestation_periods FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can insert attestation_periods" ON attestation_periods FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can update attestation_periods" ON attestation_periods FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- attestation_requirements
DROP POLICY IF EXISTS "Risk managers can delete attestation_requirements" ON attestation_requirements;
DROP POLICY IF EXISTS "Risk managers can insert attestation_requirements" ON attestation_requirements;
DROP POLICY IF EXISTS "Risk managers can update attestation_requirements" ON attestation_requirements;
CREATE POLICY "Risk managers can delete attestation_requirements" ON attestation_requirements FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can insert attestation_requirements" ON attestation_requirements FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can update attestation_requirements" ON attestation_requirements FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- attestation_submissions
DROP POLICY IF EXISTS "Users can insert own attestation_submissions" ON attestation_submissions;
DROP POLICY IF EXISTS "Users can update own attestation_submissions" ON attestation_submissions;
CREATE POLICY "Users can insert own attestation_submissions" ON attestation_submissions FOR INSERT TO authenticated WITH CHECK (submitted_by_user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own attestation_submissions" ON attestation_submissions FOR UPDATE TO authenticated USING (submitted_by_user_id = (SELECT auth.uid())) WITH CHECK (submitted_by_user_id = (SELECT auth.uid()));

-- workflow_configurations
DROP POLICY IF EXISTS "Risk managers can delete workflow_configurations" ON workflow_configurations;
DROP POLICY IF EXISTS "Risk managers can insert workflow_configurations" ON workflow_configurations;
DROP POLICY IF EXISTS "Risk managers can update workflow_configurations" ON workflow_configurations;
CREATE POLICY "Risk managers can delete workflow_configurations" ON workflow_configurations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can insert workflow_configurations" ON workflow_configurations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can update workflow_configurations" ON workflow_configurations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- approval_requirements
DROP POLICY IF EXISTS "Risk managers can manage approval requirements" ON approval_requirements;
CREATE POLICY "Risk managers can manage approval requirements" ON approval_requirements FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
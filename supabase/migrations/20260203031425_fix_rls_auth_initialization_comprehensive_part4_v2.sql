/*
  # Fix RLS Auth Initialization - Comprehensive Part 4 v2

  ## Tables covered:
    - Vendor: vendor_requests, vendor_documents
    - Assessments: tiering_assessments
    - Onboarding: onboarding_tasks, onboarding_requests
    - Reviews: review_schedules, review_notifications, review_completions
    - Risk appetite: risk_appetite_metrics
    - OSFI: osfi_notification_templates, osfi_notifications
    - Incidents: incidents
    - Documents: document_types, concentration_thresholds
    - Workflow templates: workflow_templates, workflow_step_configs
    - Exit strategies: exit_strategies
    - User delegations: user_delegations (FIXED)
    - Organization users: organization_users
    - Defense line impersonation: defense_line_impersonation_sessions
*/

-- vendor_requests
DROP POLICY IF EXISTS "Authenticated users can read vendor requests" ON vendor_requests;
DROP POLICY IF EXISTS "Authenticated users can submit vendor requests" ON vendor_requests;
DROP POLICY IF EXISTS "Reviewers can update vendor requests" ON vendor_requests;
CREATE POLICY "Authenticated users can read vendor requests" ON vendor_requests FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated users can submit vendor requests" ON vendor_requests FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Reviewers can update vendor requests" ON vendor_requests FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- tiering_assessments
DROP POLICY IF EXISTS "Authorized users can insert assessments" ON tiering_assessments;
DROP POLICY IF EXISTS "Authorized users can update assessments" ON tiering_assessments;
CREATE POLICY "Authorized users can insert assessments" ON tiering_assessments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = tiering_assessments.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Authorized users can update assessments" ON tiering_assessments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = tiering_assessments.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = tiering_assessments.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- onboarding_tasks
DROP POLICY IF EXISTS "Users can update assigned tasks" ON onboarding_tasks;
CREATE POLICY "Users can update assigned tasks" ON onboarding_tasks FOR UPDATE TO authenticated USING (assigned_to = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM organization_users ou INNER JOIN onboarding_requests obr ON obr.organization_id = ou.organization_id WHERE obr.id = onboarding_tasks.request_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (assigned_to = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM organization_users ou INNER JOIN onboarding_requests obr ON obr.organization_id = ou.organization_id WHERE obr.id = onboarding_tasks.request_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- review_schedules
DROP POLICY IF EXISTS "Authorized users can delete review_schedules" ON review_schedules;
DROP POLICY IF EXISTS "Authorized users can manage review_schedules" ON review_schedules;
DROP POLICY IF EXISTS "Authorized users can update review_schedules" ON review_schedules;
CREATE POLICY "Authorized users can delete review_schedules" ON review_schedules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_schedules.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Authorized users can manage review_schedules" ON review_schedules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_schedules.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Authorized users can update review_schedules" ON review_schedules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_schedules.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_schedules.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- review_notifications
DROP POLICY IF EXISTS "Authorized users can insert review_notifications" ON review_notifications;
CREATE POLICY "Authorized users can insert review_notifications" ON review_notifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_notifications.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- review_completions
DROP POLICY IF EXISTS "Authorized users can insert review_completions" ON review_completions;
DROP POLICY IF EXISTS "Authorized users can update review_completions" ON review_completions;
CREATE POLICY "Authorized users can insert review_completions" ON review_completions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_completions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Authorized users can update review_completions" ON review_completions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_completions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = review_completions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- risk_appetite_metrics
DROP POLICY IF EXISTS "Risk managers can delete risk_appetite_metrics" ON risk_appetite_metrics;
DROP POLICY IF EXISTS "Risk managers can insert risk_appetite_metrics" ON risk_appetite_metrics;
DROP POLICY IF EXISTS "Risk managers can update risk_appetite_metrics" ON risk_appetite_metrics;
CREATE POLICY "Risk managers can delete risk_appetite_metrics" ON risk_appetite_metrics FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can insert risk_appetite_metrics" ON risk_appetite_metrics FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can update risk_appetite_metrics" ON risk_appetite_metrics FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- incidents
DROP POLICY IF EXISTS "Authorized users can update incidents" ON incidents;
CREATE POLICY "Authorized users can update incidents" ON incidents FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = incidents.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = incidents.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- osfi_notification_templates
DROP POLICY IF EXISTS "Risk managers can delete osfi_notification_templates" ON osfi_notification_templates;
DROP POLICY IF EXISTS "Risk managers can insert osfi_notification_templates" ON osfi_notification_templates;
DROP POLICY IF EXISTS "Risk managers can update osfi_notification_templates" ON osfi_notification_templates;
CREATE POLICY "Risk managers can delete osfi_notification_templates" ON osfi_notification_templates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can insert osfi_notification_templates" ON osfi_notification_templates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can update osfi_notification_templates" ON osfi_notification_templates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- osfi_notifications
DROP POLICY IF EXISTS "Authorized users can insert osfi_notifications" ON osfi_notifications;
DROP POLICY IF EXISTS "Authorized users can update osfi_notifications" ON osfi_notifications;
CREATE POLICY "Authorized users can insert osfi_notifications" ON osfi_notifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM incidents i INNER JOIN vendors v ON v.id = i.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE i.id = osfi_notifications.incident_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Authorized users can update osfi_notifications" ON osfi_notifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM incidents i INNER JOIN vendors v ON v.id = i.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE i.id = osfi_notifications.incident_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM incidents i INNER JOIN vendors v ON v.id = i.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE i.id = osfi_notifications.incident_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- document_types
DROP POLICY IF EXISTS "Risk managers can delete document_types" ON document_types;
DROP POLICY IF EXISTS "Risk managers can insert document_types" ON document_types;
DROP POLICY IF EXISTS "Risk managers can update document_types" ON document_types;
CREATE POLICY "Risk managers can delete document_types" ON document_types FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can insert document_types" ON document_types FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can update document_types" ON document_types FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- concentration_thresholds
DROP POLICY IF EXISTS "Risk managers can delete concentration_thresholds" ON concentration_thresholds;
DROP POLICY IF EXISTS "Risk managers can insert concentration_thresholds" ON concentration_thresholds;
DROP POLICY IF EXISTS "Risk managers can update concentration_thresholds" ON concentration_thresholds;
CREATE POLICY "Risk managers can delete concentration_thresholds" ON concentration_thresholds FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can insert concentration_thresholds" ON concentration_thresholds FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Risk managers can update concentration_thresholds" ON concentration_thresholds FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- workflow_templates
DROP POLICY IF EXISTS "Org admins can manage their templates" ON workflow_templates;
CREATE POLICY "Org admins can manage their templates" ON workflow_templates FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = workflow_templates.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = workflow_templates.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- workflow_step_configs
DROP POLICY IF EXISTS "Org admins can manage step configs" ON workflow_step_configs;
CREATE POLICY "Org admins can manage step configs" ON workflow_step_configs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM workflow_templates wt INNER JOIN organization_users ou ON ou.organization_id = wt.organization_id WHERE wt.id = workflow_step_configs.workflow_template_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM workflow_templates wt INNER JOIN organization_users ou ON ou.organization_id = wt.organization_id WHERE wt.id = workflow_step_configs.workflow_template_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- user_delegations (FIXED: use delegator_id instead of user_id)
DROP POLICY IF EXISTS "Users can manage their own delegations" ON user_delegations;
CREATE POLICY "Users can manage their own delegations" ON user_delegations FOR ALL TO authenticated USING (delegator_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = user_delegations.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true)) WITH CHECK (delegator_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = user_delegations.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true));

-- vendor_documents
DROP POLICY IF EXISTS "Authorized users can insert vendor_documents" ON vendor_documents;
DROP POLICY IF EXISTS "Authorized users can update vendor_documents" ON vendor_documents;
DROP POLICY IF EXISTS "Risk managers can delete vendor_documents" ON vendor_documents;
CREATE POLICY "Authorized users can insert vendor_documents" ON vendor_documents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_documents.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Authorized users can update vendor_documents" ON vendor_documents FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_documents.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_documents.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Risk managers can delete vendor_documents" ON vendor_documents FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_documents.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));

-- exit_strategies
DROP POLICY IF EXISTS "Organization members can delete their exit strategies" ON exit_strategies;
DROP POLICY IF EXISTS "Organization members can insert exit strategies" ON exit_strategies;
DROP POLICY IF EXISTS "Organization members can update their exit strategies" ON exit_strategies;
DROP POLICY IF EXISTS "Organization members can view their exit strategies" ON exit_strategies;
CREATE POLICY "Organization members can delete their exit strategies" ON exit_strategies FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = exit_strategies.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can insert exit strategies" ON exit_strategies FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = exit_strategies.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can update their exit strategies" ON exit_strategies FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = exit_strategies.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = exit_strategies.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can view their exit strategies" ON exit_strategies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = exit_strategies.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- organization_users
DROP POLICY IF EXISTS "Users can update own org user record" ON organization_users;
CREATE POLICY "Users can update own org user record" ON organization_users FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- defense_line_impersonation_sessions
DROP POLICY IF EXISTS "Org admins can create impersonation sessions" ON defense_line_impersonation_sessions;
DROP POLICY IF EXISTS "Org admins can update their impersonation sessions" ON defense_line_impersonation_sessions;
DROP POLICY IF EXISTS "Org admins can view impersonation sessions" ON defense_line_impersonation_sessions;
CREATE POLICY "Org admins can create impersonation sessions" ON defense_line_impersonation_sessions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = defense_line_impersonation_sessions.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true));
CREATE POLICY "Org admins can update their impersonation sessions" ON defense_line_impersonation_sessions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = defense_line_impersonation_sessions.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = defense_line_impersonation_sessions.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true));
CREATE POLICY "Org admins can view impersonation sessions" ON defense_line_impersonation_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = defense_line_impersonation_sessions.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true));
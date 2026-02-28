/*
  # Fix Security and Performance - Part 1: Foreign Key Indexes

  ## Performance Improvements
    - Add indexes for all unindexed foreign keys
    - This dramatically improves join performance and query optimization
    - Covers 100+ missing foreign key indexes across all tables

  ## Tables covered:
    - assessment_tasks, attestation tables, auto_critical_rules
    - concentration_thresholds, contract_reviews, due_diligence
    - exit_strategies, global_third_parties, onboarding tables
    - organization tables, osfi tables, platform_admins
    - profiles, review tables, risk tables, senior_approvers
    - sla tables, tiering_assessments, user_delegations
    - vendor tables, workflow tables
*/

-- assessment_tasks indexes
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_completed_by ON assessment_tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_related_assessment_id ON assessment_tasks(related_assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_related_task_id ON assessment_tasks(related_task_id);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_validated_by ON assessment_tasks(validated_by);

-- attestation tables indexes
CREATE INDEX IF NOT EXISTS idx_attestation_periods_created_by ON attestation_periods(created_by);
CREATE INDEX IF NOT EXISTS idx_attestation_requirements_period_id ON attestation_requirements(period_id);
CREATE INDEX IF NOT EXISTS idx_attestation_responses_requirement_id ON attestation_responses(requirement_id);
CREATE INDEX IF NOT EXISTS idx_attestation_submissions_reviewer_id ON attestation_submissions(reviewer_id);

-- auto_critical_rules indexes
CREATE INDEX IF NOT EXISTS idx_auto_critical_rules_created_by ON auto_critical_rules(created_by);

-- concentration_thresholds indexes
CREATE INDEX IF NOT EXISTS idx_concentration_thresholds_created_by ON concentration_thresholds(created_by);

-- contract_reviews indexes
CREATE INDEX IF NOT EXISTS idx_contract_reviews_assigned_by ON contract_reviews(assigned_by);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_decision_by ON contract_reviews(decision_by);

-- due_diligence indexes
CREATE INDEX IF NOT EXISTS idx_due_diligence_assessment_id ON due_diligence(assessment_id);

-- due_diligence_document_requests indexes
CREATE INDEX IF NOT EXISTS idx_dd_requests_requested_by ON due_diligence_document_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_dd_requests_reviewed_by ON due_diligence_document_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_dd_requests_waived_by ON due_diligence_document_requests(waived_by);
CREATE INDEX IF NOT EXISTS idx_dd_requests_waiver_approved_by ON due_diligence_document_requests(waiver_approved_by);

-- due_diligence_request_reminders indexes
CREATE INDEX IF NOT EXISTS idx_dd_reminders_escalated_to ON due_diligence_request_reminders(escalated_to);

-- exit_strategies indexes
CREATE INDEX IF NOT EXISTS idx_exit_strategies_approved_by ON exit_strategies(approved_by);

-- global_third_parties indexes
CREATE INDEX IF NOT EXISTS idx_global_third_parties_verified_by ON global_third_parties(verified_by);

-- onboarding_assessment_audit indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_assessment_audit_override_approved_by ON onboarding_assessment_audit(override_approved_by);

-- onboarding_audit_log indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_audit_log_organization_id ON onboarding_audit_log(organization_id);

-- onboarding_comments indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_comments_organization_id ON onboarding_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_comments_parent_comment_id ON onboarding_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_comments_task_id ON onboarding_comments(task_id);

-- onboarding_documents indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_organization_id ON onboarding_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_reviewed_by ON onboarding_documents(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_task_id ON onboarding_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_uploaded_by ON onboarding_documents(uploaded_by);

-- onboarding_requests indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_assessment_completed_by ON onboarding_requests(assessment_completed_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_assessment_validated_by ON onboarding_requests(assessment_validated_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_assigned_senior_approver ON onboarding_requests(assigned_senior_approver);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_auto_critical_override_by ON onboarding_requests(auto_critical_override_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_auto_critical_rule_id ON onboarding_requests(auto_critical_rule_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_conditions_owner ON onboarding_requests(conditions_owner);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_final_decision_by ON onboarding_requests(final_decision_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_reviewed_by_1b ON onboarding_requests(reviewed_by_1b);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_reviewed_by_2nd ON onboarding_requests(reviewed_by_2nd);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_reviewed_by_senior ON onboarding_requests(reviewed_by_senior);

-- onboarding_tasks indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_assigned_by ON onboarding_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_completed_by ON onboarding_tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_escalated_to ON onboarding_tasks(escalated_to);

-- organization_invitations indexes
CREATE INDEX IF NOT EXISTS idx_organization_invitations_accepted_by ON organization_invitations(accepted_by);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_invited_by ON organization_invitations(invited_by);

-- organization_users indexes
CREATE INDEX IF NOT EXISTS idx_organization_users_delegate_to_user_id ON organization_users(delegate_to_user_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_invited_by ON organization_users(invited_by);

-- organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- osfi_b10_compliance_status indexes
CREATE INDEX IF NOT EXISTS idx_osfi_b10_compliance_status_assessed_by ON osfi_b10_compliance_status(assessed_by);
CREATE INDEX IF NOT EXISTS idx_osfi_b10_compliance_status_evidence_document_id ON osfi_b10_compliance_status(evidence_document_id);

-- osfi_notifications indexes
CREATE INDEX IF NOT EXISTS idx_osfi_notifications_approved_by ON osfi_notifications(approved_by);
CREATE INDEX IF NOT EXISTS idx_osfi_notifications_prepared_by ON osfi_notifications(prepared_by);
CREATE INDEX IF NOT EXISTS idx_osfi_notifications_submitted_by ON osfi_notifications(submitted_by);
CREATE INDEX IF NOT EXISTS idx_osfi_notifications_template_id ON osfi_notifications(template_id);

-- platform_admins indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_created_by ON platform_admins(created_by);

-- profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_default_organization_id ON profiles(default_organization_id);

-- review_completions indexes
CREATE INDEX IF NOT EXISTS idx_review_completions_attested_by_user_id ON review_completions(attested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_review_completions_reviewer_id ON review_completions(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_completions_schedule_id ON review_completions(schedule_id);

-- review_notifications indexes
CREATE INDEX IF NOT EXISTS idx_review_notifications_acknowledged_by ON review_notifications(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_review_notifications_recipient_user_id ON review_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_review_notifications_schedule_id ON review_notifications(schedule_id);

-- review_schedules indexes
CREATE INDEX IF NOT EXISTS idx_review_schedules_escalation_user_id ON review_schedules(escalation_user_id);
CREATE INDEX IF NOT EXISTS idx_review_schedules_responsible_user_id ON review_schedules(responsible_user_id);

-- risk_appetite tables indexes
CREATE INDEX IF NOT EXISTS idx_risk_appetite_history_changed_by ON risk_appetite_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_history_metric_id ON risk_appetite_history(metric_id);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_metrics_approved_by ON risk_appetite_metrics(approved_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_metrics_created_by ON risk_appetite_metrics(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_metrics_updated_by ON risk_appetite_metrics(updated_by);

-- risk_exceptions indexes
CREATE INDEX IF NOT EXISTS idx_risk_exceptions_approved_by ON risk_exceptions(approved_by);

-- senior approval indexes
CREATE INDEX IF NOT EXISTS idx_senior_approval_config_created_by ON senior_approval_config(created_by);
CREATE INDEX IF NOT EXISTS idx_senior_approvers_backup_approver_id ON senior_approvers(backup_approver_id);
CREATE INDEX IF NOT EXISTS idx_senior_approvers_created_by ON senior_approvers(created_by);
CREATE INDEX IF NOT EXISTS idx_senior_approvers_delegate_for_user_id ON senior_approvers(delegate_for_user_id);
CREATE INDEX IF NOT EXISTS idx_senior_approvers_user_id ON senior_approvers(user_id);

-- sla_measurements indexes
CREATE INDEX IF NOT EXISTS idx_sla_measurements_recorded_by ON sla_measurements(recorded_by);

-- tiering_assessments indexes
CREATE INDEX IF NOT EXISTS idx_tiering_assessments_auto_critical_override_approved_by ON tiering_assessments(auto_critical_override_approved_by);
CREATE INDEX IF NOT EXISTS idx_tiering_assessments_auto_critical_rule_id ON tiering_assessments(auto_critical_rule_id);

-- user_delegations indexes
CREATE INDEX IF NOT EXISTS idx_user_delegations_created_by ON user_delegations(created_by);
CREATE INDEX IF NOT EXISTS idx_user_delegations_delegate_id ON user_delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_user_delegations_organization_id ON user_delegations(organization_id);

-- vendor_activation_blocks indexes
CREATE INDEX IF NOT EXISTS idx_vendor_activation_blocks_blocked_by ON vendor_activation_blocks(blocked_by);
CREATE INDEX IF NOT EXISTS idx_vendor_activation_blocks_override_approved_by ON vendor_activation_blocks(override_approved_by);
CREATE INDEX IF NOT EXISTS idx_vendor_activation_blocks_override_by ON vendor_activation_blocks(override_by);
CREATE INDEX IF NOT EXISTS idx_vendor_activation_blocks_resolved_by ON vendor_activation_blocks(resolved_by);

-- vendor_documents indexes
CREATE INDEX IF NOT EXISTS idx_vendor_documents_linked_contract_id ON vendor_documents(linked_contract_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_linked_due_diligence_id ON vendor_documents(linked_due_diligence_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_reviewed_by ON vendor_documents(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_uploaded_by ON vendor_documents(uploaded_by);

-- vendor_global_links indexes
CREATE INDEX IF NOT EXISTS idx_vendor_global_links_linked_by ON vendor_global_links(linked_by);
CREATE INDEX IF NOT EXISTS idx_vendor_global_links_vendor_id ON vendor_global_links(vendor_id);

-- vendor_requests indexes
CREATE INDEX IF NOT EXISTS idx_vendor_requests_first_b_reviewer_id ON vendor_requests(first_b_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_requests_second_line_reviewer_id ON vendor_requests(second_line_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_requests_vendor_id ON vendor_requests(vendor_id);

-- vendors indexes
CREATE INDEX IF NOT EXISTS idx_vendors_created_by ON vendors(created_by);
CREATE INDEX IF NOT EXISTS idx_vendors_initial_onboarding_request_id ON vendors(initial_onboarding_request_id);
CREATE INDEX IF NOT EXISTS idx_vendors_last_assessment_id ON vendors(last_assessment_id);

-- workflow tables indexes
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_delegated_to ON workflow_approvals(delegated_to);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_v2_delegated_to ON workflow_approvals_v2(delegated_to);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_initiated_by ON workflow_instances(initiated_by);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_config_id ON workflow_instances(workflow_config_id);
CREATE INDEX IF NOT EXISTS idx_workflow_routing_rules_created_by ON workflow_routing_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_step_configs_workflow_template_id ON workflow_step_configs(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_organization_id ON workflow_templates(organization_id);
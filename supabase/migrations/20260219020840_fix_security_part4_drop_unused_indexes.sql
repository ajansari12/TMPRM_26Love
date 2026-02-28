/*
  # Security Fix Part 4: Drop Unused Indexes

  ## Summary
  Drops all indexes flagged as unused by the Supabase linter. These indexes
  have never been accessed in query plans and represent unnecessary storage
  and write overhead on every INSERT/UPDATE/DELETE.

  ## Important Note
  These indexes can be recreated if query performance is found to degrade
  after removal. The decision to drop them is based on the Supabase advisor's
  recommendation that they are not being used by any query plans.
*/

-- report_templates
DROP INDEX IF EXISTS public.idx_report_templates_user;

-- role_permissions
DROP INDEX IF EXISTS public.idx_role_permissions_role;

-- vendors
DROP INDEX IF EXISTS public.idx_vendors_status;
DROP INDEX IF EXISTS public.idx_vendors_tier;
DROP INDEX IF EXISTS public.idx_vendors_service_category;
DROP INDEX IF EXISTS public.idx_vendors_business_unit;
DROP INDEX IF EXISTS public.idx_vendors_lifecycle_stage;
DROP INDEX IF EXISTS public.idx_vendors_onboarding_request_id;
DROP INDEX IF EXISTS public.idx_vendors_created_by;
DROP INDEX IF EXISTS public.idx_vendors_initial_onboarding_request_id;
DROP INDEX IF EXISTS public.idx_vendors_last_assessment_id;

-- category_weights
DROP INDEX IF EXISTS public.idx_category_weights_category;

-- attestation_submissions
DROP INDEX IF EXISTS public.idx_attestation_submissions_period;
DROP INDEX IF EXISTS public.idx_attestation_submissions_reviewer_id;

-- tiering_assessments
DROP INDEX IF EXISTS public.idx_assessments_assessment_id;
DROP INDEX IF EXISTS public.idx_tiering_assessments_previous;
DROP INDEX IF EXISTS public.idx_tiering_assessments_auto_critical_override_approved_by;
DROP INDEX IF EXISTS public.idx_tiering_assessments_auto_critical_rule_id;

-- attestation_responses
DROP INDEX IF EXISTS public.idx_attestation_responses_submission;
DROP INDEX IF EXISTS public.idx_attestation_responses_requirement_id;

-- workflow_instances
DROP INDEX IF EXISTS public.idx_workflow_instances_entity;
DROP INDEX IF EXISTS public.idx_workflow_instances_status;
DROP INDEX IF EXISTS public.idx_workflow_instances_initiated_by;
DROP INDEX IF EXISTS public.idx_workflow_instances_workflow_config_id;

-- workflow_approvals
DROP INDEX IF EXISTS public.idx_workflow_approvals_instance;
DROP INDEX IF EXISTS public.idx_workflow_approvals_approver;
DROP INDEX IF EXISTS public.idx_workflow_approvals_delegated_to;

-- due_diligence
DROP INDEX IF EXISTS public.idx_due_diligence_vendor_id;
DROP INDEX IF EXISTS public.idx_due_diligence_assessment_id;

-- contracts
DROP INDEX IF EXISTS public.idx_contracts_expiry_date;

-- incidents
DROP INDEX IF EXISTS public.idx_incidents_status;

-- subcontractors
DROP INDEX IF EXISTS public.idx_subcontractors_vendor_id;

-- performance_reviews
DROP INDEX IF EXISTS public.idx_performance_reviews_vendor_id;
DROP INDEX IF EXISTS public.idx_performance_reviews_org_id;

-- notifications
DROP INDEX IF EXISTS public.idx_notifications_target_user;
DROP INDEX IF EXISTS public.idx_notifications_is_read;

-- audit_logs
DROP INDEX IF EXISTS public.idx_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_audit_logs_entity;
DROP INDEX IF EXISTS public.idx_audit_logs_test_mode;
DROP INDEX IF EXISTS public.idx_audit_logs_impersonation_session;

-- osfi_b10_compliance_status
DROP INDEX IF EXISTS public.idx_osfi_compliance_vendor;
DROP INDEX IF EXISTS public.idx_osfi_compliance_req;
DROP INDEX IF EXISTS public.idx_osfi_compliance_status;
DROP INDEX IF EXISTS public.idx_osfi_b10_compliance_status_assessed_by;
DROP INDEX IF EXISTS public.idx_osfi_b10_compliance_status_evidence_document_id;

-- osfi_b10_requirements
DROP INDEX IF EXISTS public.idx_osfi_requirements_category;

-- kri_history
DROP INDEX IF EXISTS public.idx_kri_history_date;
DROP INDEX IF EXISTS public.idx_kri_history_code;

-- contract_reviews
DROP INDEX IF EXISTS public.idx_contract_reviews_contract;
DROP INDEX IF EXISTS public.idx_contract_reviews_status;
DROP INDEX IF EXISTS public.idx_contract_reviews_assigned;
DROP INDEX IF EXISTS public.idx_contract_reviews_assigned_by;
DROP INDEX IF EXISTS public.idx_contract_reviews_decision_by;

-- vendor_slas
DROP INDEX IF EXISTS public.idx_vendor_slas_contract;
DROP INDEX IF EXISTS public.idx_vendor_slas_category;
DROP INDEX IF EXISTS public.idx_vendor_slas_active;
DROP INDEX IF EXISTS public.idx_vendor_slas_organization;

-- sla_measurements
DROP INDEX IF EXISTS public.idx_sla_measurements_sla;
DROP INDEX IF EXISTS public.idx_sla_measurements_period;
DROP INDEX IF EXISTS public.idx_sla_measurements_target_met;
DROP INDEX IF EXISTS public.idx_sla_measurements_recorded_by;

-- organization_invitations
DROP INDEX IF EXISTS public.idx_org_invitations_org_id;
DROP INDEX IF EXISTS public.idx_org_invitations_email;
DROP INDEX IF EXISTS public.idx_org_invitations_token;
DROP INDEX IF EXISTS public.idx_organization_invitations_accepted_by;
DROP INDEX IF EXISTS public.idx_organization_invitations_invited_by;

-- assessment_tasks
DROP INDEX IF EXISTS public.idx_assessment_tasks_status;
DROP INDEX IF EXISTS public.idx_assessment_tasks_due_date;
DROP INDEX IF EXISTS public.idx_assessment_tasks_completed_by;
DROP INDEX IF EXISTS public.idx_assessment_tasks_related_assessment_id;
DROP INDEX IF EXISTS public.idx_assessment_tasks_related_task_id;
DROP INDEX IF EXISTS public.idx_assessment_tasks_validated_by;
DROP INDEX IF EXISTS public.idx_assessment_tasks_org;
DROP INDEX IF EXISTS public.idx_assessment_tasks_vendor;
DROP INDEX IF EXISTS public.idx_assessment_tasks_assigned;
DROP INDEX IF EXISTS public.idx_assessment_tasks_task_type;
DROP INDEX IF EXISTS public.idx_assessment_tasks_snooze_until;
DROP INDEX IF EXISTS public.idx_assessment_tasks_validation;

-- auto_critical_rules
DROP INDEX IF EXISTS public.idx_auto_critical_rules_org;
DROP INDEX IF EXISTS public.idx_auto_critical_rules_created_by;

-- offboarding_tasks
DROP INDEX IF EXISTS public.idx_offboarding_tasks_organization_id;
DROP INDEX IF EXISTS public.idx_offboarding_tasks_vendor_id;
DROP INDEX IF EXISTS public.idx_offboarding_tasks_status;
DROP INDEX IF EXISTS public.idx_offboarding_tasks_category;

-- senior_approvers
DROP INDEX IF EXISTS public.idx_senior_approvers_org_active;
DROP INDEX IF EXISTS public.idx_senior_approvers_backup_approver_id;
DROP INDEX IF EXISTS public.idx_senior_approvers_created_by;
DROP INDEX IF EXISTS public.idx_senior_approvers_delegate_for_user_id;
DROP INDEX IF EXISTS public.idx_senior_approvers_user_id;

-- reassessment_reminders
DROP INDEX IF EXISTS public.idx_reassessment_reminders_vendor_id;
DROP INDEX IF EXISTS public.idx_reassessment_reminders_sent_at;

-- risk_exceptions
DROP INDEX IF EXISTS public.idx_risk_exceptions_vendor;
DROP INDEX IF EXISTS public.idx_risk_exceptions_type;
DROP INDEX IF EXISTS public.idx_risk_exceptions_expiry;
DROP INDEX IF EXISTS public.idx_risk_exceptions_next_review;
DROP INDEX IF EXISTS public.idx_risk_exceptions_requested_by;
DROP INDEX IF EXISTS public.idx_risk_exceptions_approved_by;

-- defense_line_impersonation_sessions
DROP INDEX IF EXISTS public.idx_defense_line_impersonation_admin;
DROP INDEX IF EXISTS public.idx_defense_line_impersonation_org;

-- organizations
DROP INDEX IF EXISTS public.idx_organizations_active;
DROP INDEX IF EXISTS public.idx_organizations_type;
DROP INDEX IF EXISTS public.idx_organizations_created_by;

-- organization_users
DROP INDEX IF EXISTS public.idx_org_users_org;
DROP INDEX IF EXISTS public.idx_org_users_user;
DROP INDEX IF EXISTS public.idx_org_users_defense_line;
DROP INDEX IF EXISTS public.idx_org_users_business_unit;
DROP INDEX IF EXISTS public.idx_org_users_active;
DROP INDEX IF EXISTS public.idx_organization_users_delegate_to_user_id;
DROP INDEX IF EXISTS public.idx_organization_users_invited_by;
DROP INDEX IF EXISTS public.idx_organization_users_can_create_vendors;

-- workflow_routing_rules
DROP INDEX IF EXISTS public.idx_routing_rules_org;
DROP INDEX IF EXISTS public.idx_workflow_routing_rules_created_by;

-- vendor_documents
DROP INDEX IF EXISTS public.idx_vendor_documents_status;
DROP INDEX IF EXISTS public.idx_vendor_documents_review;
DROP INDEX IF EXISTS public.idx_vendor_documents_original;
DROP INDEX IF EXISTS public.idx_vendor_documents_linked_contract_id;
DROP INDEX IF EXISTS public.idx_vendor_documents_linked_due_diligence_id;
DROP INDEX IF EXISTS public.idx_vendor_documents_reviewed_by;
DROP INDEX IF EXISTS public.idx_vendor_documents_uploaded_by;
DROP INDEX IF EXISTS public.idx_vendor_documents_vendor;
DROP INDEX IF EXISTS public.idx_vendor_documents_type;
DROP INDEX IF EXISTS public.idx_vendor_documents_expiry;

-- vendor_requests
DROP INDEX IF EXISTS public.idx_vendor_requests_status;
DROP INDEX IF EXISTS public.idx_vendor_requests_requested_by;
DROP INDEX IF EXISTS public.idx_vendor_requests_preliminary_tier;
DROP INDEX IF EXISTS public.idx_vendor_requests_current_defense_line;
DROP INDEX IF EXISTS public.idx_vendor_requests_first_b_reviewer_id;
DROP INDEX IF EXISTS public.idx_vendor_requests_second_line_reviewer_id;
DROP INDEX IF EXISTS public.idx_vendor_requests_vendor_id;

-- attestation_periods
DROP INDEX IF EXISTS public.idx_attestation_periods_created_by;

-- attestation_requirements
DROP INDEX IF EXISTS public.idx_attestation_requirements_period_id;

-- fourth_parties
DROP INDEX IF EXISTS public.idx_fourth_parties_criticality;

-- exit_strategies
DROP INDEX IF EXISTS public.idx_exit_strategies_approved_by;
DROP INDEX IF EXISTS public.idx_exit_strategies_status;
DROP INDEX IF EXISTS public.idx_exit_strategies_next_test;

-- global_third_parties
DROP INDEX IF EXISTS public.idx_global_third_parties_verified_by;
DROP INDEX IF EXISTS public.idx_global_third_parties_search;
DROP INDEX IF EXISTS public.idx_global_third_parties_lei;
DROP INDEX IF EXISTS public.idx_global_third_parties_name;

-- onboarding_assessment_audit
DROP INDEX IF EXISTS public.idx_onboarding_assessment_audit_override_approved_by;
DROP INDEX IF EXISTS public.idx_assessment_audit_request;
DROP INDEX IF EXISTS public.idx_assessment_audit_org;
DROP INDEX IF EXISTS public.idx_assessment_audit_changed_by;
DROP INDEX IF EXISTS public.idx_assessment_audit_changed_at;
DROP INDEX IF EXISTS public.idx_assessment_audit_field;
DROP INDEX IF EXISTS public.idx_assessment_audit_action;

-- onboarding_audit_log
DROP INDEX IF EXISTS public.idx_onboarding_audit_log_organization_id;
DROP INDEX IF EXISTS public.idx_onboarding_audit_request;
DROP INDEX IF EXISTS public.idx_onboarding_audit_actor;
DROP INDEX IF EXISTS public.idx_onboarding_audit_time;

-- onboarding_comments
DROP INDEX IF EXISTS public.idx_onboarding_comments_organization_id;
DROP INDEX IF EXISTS public.idx_onboarding_comments_parent_comment_id;
DROP INDEX IF EXISTS public.idx_onboarding_comments_task_id;
DROP INDEX IF EXISTS public.idx_onboarding_comments_author;

-- onboarding_documents
DROP INDEX IF EXISTS public.idx_onboarding_documents_organization_id;
DROP INDEX IF EXISTS public.idx_onboarding_documents_reviewed_by;
DROP INDEX IF EXISTS public.idx_onboarding_documents_task_id;
DROP INDEX IF EXISTS public.idx_onboarding_documents_uploaded_by;

-- onboarding_tasks
DROP INDEX IF EXISTS public.idx_onboarding_tasks_org;
DROP INDEX IF EXISTS public.idx_onboarding_tasks_request;
DROP INDEX IF EXISTS public.idx_onboarding_tasks_assigned;
DROP INDEX IF EXISTS public.idx_onboarding_tasks_status;
DROP INDEX IF EXISTS public.idx_onboarding_tasks_defense_line;
DROP INDEX IF EXISTS public.idx_onboarding_tasks_assigned_by;
DROP INDEX IF EXISTS public.idx_onboarding_tasks_completed_by;
DROP INDEX IF EXISTS public.idx_onboarding_tasks_escalated_to;

-- onboarding_request_templates
DROP INDEX IF EXISTS public.idx_onboarding_templates_system;

-- due_diligence_document_requests
DROP INDEX IF EXISTS public.idx_dd_requests_requested_by;
DROP INDEX IF EXISTS public.idx_dd_requests_reviewed_by;
DROP INDEX IF EXISTS public.idx_dd_requests_waived_by;
DROP INDEX IF EXISTS public.idx_dd_requests_waiver_approved_by;
DROP INDEX IF EXISTS public.idx_dd_requests_onboarding;
DROP INDEX IF EXISTS public.idx_dd_requests_status;
DROP INDEX IF EXISTS public.idx_dd_requests_due_date;
DROP INDEX IF EXISTS public.idx_dd_requests_doc_type;

-- due_diligence_request_reminders
DROP INDEX IF EXISTS public.idx_dd_reminders_escalated_to;
DROP INDEX IF EXISTS public.idx_dd_reminders_org;
DROP INDEX IF EXISTS public.idx_dd_reminders_request;
DROP INDEX IF EXISTS public.idx_dd_reminders_sent;

-- vendor_activation_blocks
DROP INDEX IF EXISTS public.idx_vendor_activation_blocks_blocked_by;
DROP INDEX IF EXISTS public.idx_vendor_activation_blocks_override_approved_by;
DROP INDEX IF EXISTS public.idx_vendor_activation_blocks_override_by;
DROP INDEX IF EXISTS public.idx_vendor_activation_blocks_resolved_by;
DROP INDEX IF EXISTS public.idx_activation_blocks_org;
DROP INDEX IF EXISTS public.idx_activation_blocks_vendor;

-- concentration_thresholds
DROP INDEX IF EXISTS public.idx_concentration_thresholds_created_by;
DROP INDEX IF EXISTS public.idx_concentration_thresholds_org;

-- workflow_approvals_v2
DROP INDEX IF EXISTS public.idx_workflow_approvals_v2_item;
DROP INDEX IF EXISTS public.idx_workflow_approvals_v2_approver;
DROP INDEX IF EXISTS public.idx_workflow_approvals_v2_pending;
DROP INDEX IF EXISTS public.idx_workflow_approvals_v2_delegated_to;

-- workflow_history
DROP INDEX IF EXISTS public.idx_workflow_history_entity;
DROP INDEX IF EXISTS public.idx_workflow_history_vendor;
DROP INDEX IF EXISTS public.idx_workflow_history_performed_by;

-- profiles
DROP INDEX IF EXISTS public.idx_profiles_defense_line;
DROP INDEX IF EXISTS public.idx_profiles_default_organization_id;

-- platform_admins
DROP INDEX IF EXISTS public.idx_platform_admins_created_by;

-- review_completions
DROP INDEX IF EXISTS public.idx_review_completions_attested_by_user_id;
DROP INDEX IF EXISTS public.idx_review_completions_reviewer_id;
DROP INDEX IF EXISTS public.idx_review_completions_schedule_id;
DROP INDEX IF EXISTS public.idx_review_completions_vendor;

-- review_notifications
DROP INDEX IF EXISTS public.idx_review_notifications_acknowledged_by;
DROP INDEX IF EXISTS public.idx_review_notifications_recipient_user_id;
DROP INDEX IF EXISTS public.idx_review_notifications_schedule_id;
DROP INDEX IF EXISTS public.idx_review_notifications_vendor;

-- platform_audit_log
DROP INDEX IF EXISTS public.idx_platform_audit_log_admin;
DROP INDEX IF EXISTS public.idx_platform_audit_log_resource;
DROP INDEX IF EXISTS public.idx_platform_audit_log_org;
DROP INDEX IF EXISTS public.idx_platform_audit_log_created;

-- review_schedules
DROP INDEX IF EXISTS public.idx_review_schedules_escalation_user_id;
DROP INDEX IF EXISTS public.idx_review_schedules_responsible_user_id;
DROP INDEX IF EXISTS public.idx_review_schedules_vendor;
DROP INDEX IF EXISTS public.idx_review_schedules_next_date;

-- risk_appetite_history
DROP INDEX IF EXISTS public.idx_risk_appetite_history_changed_by;
DROP INDEX IF EXISTS public.idx_risk_appetite_history_metric_id;

-- risk_appetite_metrics
DROP INDEX IF EXISTS public.idx_risk_appetite_metrics_approved_by;
DROP INDEX IF EXISTS public.idx_risk_appetite_metrics_created_by;
DROP INDEX IF EXISTS public.idx_risk_appetite_metrics_updated_by;
DROP INDEX IF EXISTS public.idx_risk_appetite_metrics_code;

-- vendor_global_links
DROP INDEX IF EXISTS public.idx_vendor_global_links_org;
DROP INDEX IF EXISTS public.idx_vendor_global_links_global;
DROP INDEX IF EXISTS public.idx_vendor_global_links_linked_by;
DROP INDEX IF EXISTS public.idx_vendor_global_links_vendor_id;

-- senior_approval_config
DROP INDEX IF EXISTS public.idx_senior_approval_config_created_by;

-- user_delegations
DROP INDEX IF EXISTS public.idx_user_delegations_created_by;
DROP INDEX IF EXISTS public.idx_user_delegations_delegate_id;
DROP INDEX IF EXISTS public.idx_user_delegations_organization_id;
DROP INDEX IF EXISTS public.idx_user_delegations_active;

-- workflow_step_configs
DROP INDEX IF EXISTS public.idx_workflow_step_configs_workflow_template_id;

-- workflow_templates
DROP INDEX IF EXISTS public.idx_workflow_templates_created_by;
DROP INDEX IF EXISTS public.idx_workflow_templates_organization_id;

-- vendor_creation_audit
DROP INDEX IF EXISTS public.idx_vendor_creation_audit_org;
DROP INDEX IF EXISTS public.idx_vendor_creation_audit_vendor;
DROP INDEX IF EXISTS public.idx_vendor_creation_audit_user;
DROP INDEX IF EXISTS public.idx_vendor_creation_audit_result;
DROP INDEX IF EXISTS public.idx_vendor_creation_audit_time;

-- onboarding_requests (additional)
DROP INDEX IF EXISTS public.idx_onboarding_requests_status;
DROP INDEX IF EXISTS public.idx_onboarding_requests_defense_line;
DROP INDEX IF EXISTS public.idx_onboarding_requests_1b_reviewer;
DROP INDEX IF EXISTS public.idx_onboarding_requests_2nd_reviewer;
DROP INDEX IF EXISTS public.idx_onboarding_requests_number;
DROP INDEX IF EXISTS public.idx_onboarding_requests_vendor_name;
DROP INDEX IF EXISTS public.idx_onboarding_calculated_tier;
DROP INDEX IF EXISTS public.idx_onboarding_validated_tier;
DROP INDEX IF EXISTS public.idx_onboarding_is_auto_critical;
DROP INDEX IF EXISTS public.idx_onboarding_assessment_completed;
DROP INDEX IF EXISTS public.idx_onboarding_assessment_validated;
DROP INDEX IF EXISTS public.idx_onboarding_schema_version;
DROP INDEX IF EXISTS public.idx_onboarding_requests_senior_approval;
DROP INDEX IF EXISTS public.idx_onboarding_requests_assessment_completed_by;
DROP INDEX IF EXISTS public.idx_onboarding_requests_assessment_validated_by;
DROP INDEX IF EXISTS public.idx_onboarding_requests_assigned_senior_approver;
DROP INDEX IF EXISTS public.idx_onboarding_requests_auto_critical_override_by;
DROP INDEX IF EXISTS public.idx_onboarding_requests_auto_critical_rule_id;
DROP INDEX IF EXISTS public.idx_onboarding_requests_conditions_owner;
DROP INDEX IF EXISTS public.idx_onboarding_requests_final_decision_by;
DROP INDEX IF EXISTS public.idx_onboarding_requests_reviewed_by_1b;
DROP INDEX IF EXISTS public.idx_onboarding_requests_reviewed_by_2nd;
DROP INDEX IF EXISTS public.idx_onboarding_requests_reviewed_by_senior;
DROP INDEX IF EXISTS public.idx_onboarding_requests_cloned_from;
DROP INDEX IF EXISTS public.idx_onboarding_requests_retrospective;

-- osfi_notifications
DROP INDEX IF EXISTS public.idx_osfi_notifications_approved_by;
DROP INDEX IF EXISTS public.idx_osfi_notifications_prepared_by;
DROP INDEX IF EXISTS public.idx_osfi_notifications_submitted_by;
DROP INDEX IF EXISTS public.idx_osfi_notifications_template_id;
DROP INDEX IF EXISTS public.idx_osfi_notifications_incident;
DROP INDEX IF EXISTS public.idx_osfi_notifications_status;

-- concentration_snapshots
DROP INDEX IF EXISTS public.idx_concentration_snapshots_date;
DROP INDEX IF EXISTS public.idx_concentration_snapshots_type;

/*
  # Fix Security and Performance - Part 3: Function Search Path Security

  ## Security Fixes
    - Update all database functions to use immutable search_path
    - This prevents SQL injection via search_path manipulation
    - Sets search_path to "public, pg_temp" for all functions

  ## Functions updated (50+ functions):
    - User/org functions, ID generation, timestamp triggers
    - Business logic, onboarding, platform admin
    - Assessment, due diligence, defense line impersonation
*/

-- Organization and setup functions
ALTER FUNCTION add_organization_creator_as_admin() SET search_path = public, pg_temp;
ALTER FUNCTION set_organization_created_by() SET search_path = public, pg_temp;
ALTER FUNCTION create_default_defense_configs() SET search_path = public, pg_temp;
ALTER FUNCTION create_default_auto_critical_rules() SET search_path = public, pg_temp;
ALTER FUNCTION create_default_tier_config() SET search_path = public, pg_temp;

-- User and organization permission functions
ALTER FUNCTION get_user_organization_ids() SET search_path = public, pg_temp;
ALTER FUNCTION is_org_admin(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION get_user_defense_line(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION user_can_review(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION get_effective_assignee(uuid, text) SET search_path = public, pg_temp;

-- ID generation functions
ALTER FUNCTION generate_request_id() SET search_path = public, pg_temp;
ALTER FUNCTION set_request_id() SET search_path = public, pg_temp;
ALTER FUNCTION generate_vendor_id() SET search_path = public, pg_temp;
ALTER FUNCTION set_vendor_id() SET search_path = public, pg_temp;
ALTER FUNCTION generate_assessment_id() SET search_path = public, pg_temp;
ALTER FUNCTION set_assessment_id() SET search_path = public, pg_temp;
ALTER FUNCTION generate_incident_id() SET search_path = public, pg_temp;
ALTER FUNCTION set_incident_id() SET search_path = public, pg_temp;
ALTER FUNCTION generate_request_number() SET search_path = public, pg_temp;

-- Timestamp update triggers
ALTER FUNCTION update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION update_fourth_parties_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_exit_strategies_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_vendor_slas_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_risk_exceptions_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_organization_invitations_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_osfi_updated_at() SET search_path = public, pg_temp;

-- Risk and review functions
ALTER FUNCTION check_expired_risk_exceptions() SET search_path = public, pg_temp;
ALTER FUNCTION calculate_next_review_date(text, date) SET search_path = public, pg_temp;
ALTER FUNCTION update_vendor_review_date() SET search_path = public, pg_temp;

-- Risk calculation functions
ALTER FUNCTION calculate_preliminary_risk() SET search_path = public, pg_temp;
ALTER FUNCTION calculate_onboarding_comprehensive_risk() SET search_path = public, pg_temp;

-- OSFI and notification functions
ALTER FUNCTION check_osfi_notifiable() SET search_path = public, pg_temp;

-- Onboarding workflow functions
ALTER FUNCTION log_onboarding_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION submit_onboarding_request(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION process_1b_review(uuid, review_decision, text) SET search_path = public, pg_temp;
ALTER FUNCTION process_2nd_line_review(uuid, review_decision, text, text[]) SET search_path = public, pg_temp;

-- Platform admin functions
ALTER FUNCTION is_platform_admin(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION get_platform_role(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION admin_get_all_organizations() SET search_path = public, pg_temp;
ALTER FUNCTION admin_get_third_party_usage(uuid) SET search_path = public, pg_temp;

-- Assessment and audit functions
ALTER FUNCTION log_assessment_field_changes() SET search_path = public, pg_temp;
ALTER FUNCTION get_onboarding_assessment_history(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION validate_onboarding_assessment(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION override_auto_critical(uuid, text) SET search_path = public, pg_temp;

-- Due diligence functions
ALTER FUNCTION create_due_diligence_document_requests(uuid, uuid, uuid, text, text[], uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION check_vendor_activation_status(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION update_document_request_status(uuid, text, uuid, text, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION auto_create_dd_requests_on_approval() SET search_path = public, pg_temp;

-- Senior approval functions
ALTER FUNCTION check_senior_approval_required(uuid, text, numeric, boolean) SET search_path = public, pg_temp;

-- Defense line impersonation functions
ALTER FUNCTION get_active_defense_line_impersonation(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION start_defense_line_impersonation(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION end_defense_line_impersonation(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION extend_defense_line_impersonation(uuid) SET search_path = public, pg_temp;

-- Global third party functions
ALTER FUNCTION update_global_third_party_search() SET search_path = public, pg_temp;

-- Auth trigger function
ALTER FUNCTION handle_new_user() SET search_path = public, pg_temp;
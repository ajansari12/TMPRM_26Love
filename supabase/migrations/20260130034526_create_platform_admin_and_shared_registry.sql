/*
  # Platform Admin, Shared Third Party Registry, and Configurable Workflows
  
  1. New Tables
    - `platform_admins` - Platform-level administrators
    - `platform_audit_log` - Platform-level audit trail
    - `global_third_parties` - Cross-FI vendor registry
    - `vendor_global_links` - Links tenant vendors to global registry
    - `workflow_templates` - Configurable workflow templates
    - `workflow_step_configs` - Granular step configurations
    - `workflow_approvals` - Individual approval records
    - `user_delegations` - Delegation/out-of-office settings
    
  2. Security
    - Enable RLS on all tables
    - Platform admins have cross-tenant access
    - Tenants can only see their own data
    
  3. Features
    - Super admin capabilities
    - Cross-FI vendor linkage and concentration analysis
    - Customizable workflows per organization
*/

-- Platform-level roles (super admin)
DO $$ BEGIN
  CREATE TYPE platform_role AS ENUM ('super_admin', 'platform_support', 'platform_viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Platform administrators table (separate from tenant users)
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role platform_role NOT NULL DEFAULT 'platform_viewer',
  permissions JSONB DEFAULT '{
    "can_manage_tenants": false,
    "can_manage_platform_admins": false,
    "can_view_all_data": false,
    "can_impersonate_users": false,
    "can_manage_global_config": false,
    "can_access_audit_logs": false,
    "can_manage_billing": false
  }'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

-- Platform audit log (for platform-level actions)
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES platform_admins(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  organization_id UUID REFERENCES organizations(id),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_admin ON platform_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_resource ON platform_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_org ON platform_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created ON platform_audit_log(created_at DESC);

-- Global third party registry (platform-level vendor master)
CREATE TABLE IF NOT EXISTS global_third_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  legal_name TEXT NOT NULL,
  trading_names TEXT[],
  lei TEXT UNIQUE,
  duns_number TEXT,
  
  -- Location
  headquarters_country TEXT NOT NULL,
  headquarters_address JSONB,
  operating_countries TEXT[],
  
  -- Company info
  company_type TEXT,
  industry_codes TEXT[],
  website TEXT,
  
  -- Risk indicators (platform-level aggregated)
  global_risk_score INTEGER,
  known_incidents INTEGER DEFAULT 0,
  regulatory_actions TEXT[],
  
  -- Verification
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES platform_admins(id),
  verification_source TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Search optimization
  search_vector TSVECTOR
);

-- Index for full-text search on third parties
CREATE INDEX IF NOT EXISTS idx_global_third_parties_search ON global_third_parties USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_global_third_parties_lei ON global_third_parties(lei) WHERE lei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_global_third_parties_name ON global_third_parties(LOWER(legal_name));

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_global_third_party_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.legal_name, '') || ' ' ||
    COALESCE(array_to_string(NEW.trading_names, ' '), '') || ' ' ||
    COALESCE(NEW.website, '') || ' ' ||
    COALESCE(NEW.headquarters_country, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_global_third_party_search ON global_third_parties;
CREATE TRIGGER trig_global_third_party_search
  BEFORE INSERT OR UPDATE ON global_third_parties
  FOR EACH ROW EXECUTE FUNCTION update_global_third_party_search();

-- Tenant-specific vendor records linked to global registry
CREATE TABLE IF NOT EXISTS vendor_global_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  global_third_party_id UUID NOT NULL REFERENCES global_third_parties(id),
  
  -- Linkage metadata
  link_confidence TEXT DEFAULT 'confirmed',
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by UUID REFERENCES auth.users(id),
  
  -- Prevent duplicate links
  UNIQUE(organization_id, vendor_id, global_third_party_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_global_links_org ON vendor_global_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_global_links_global ON vendor_global_links(global_third_party_id);

-- Workflow templates (platform-level defaults + tenant overrides)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Template identity
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  
  -- Template configuration
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Workflow definition (JSON schema)
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Conditions and rules
  conditions JSONB DEFAULT '{}'::jsonb,
  
  -- SLA configuration
  sla_config JSONB DEFAULT '{
    "warning_threshold_percent": 75,
    "escalation_enabled": true,
    "escalation_recipients": ["admin"]
  }'::jsonb,
  
  -- Notification settings
  notification_config JSONB DEFAULT '{
    "on_submit": ["1b_reviewers"],
    "on_return": ["requestor"],
    "on_approve": ["requestor", "1b_reviewer"],
    "on_reject": ["requestor", "1b_reviewer"],
    "on_sla_warning": ["assignee", "admin"],
    "on_sla_breach": ["assignee", "admin", "escalation_contact"]
  }'::jsonb,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: only one active default template per code per org (or platform)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_templates_unique_default 
ON workflow_templates(COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
WHERE is_active = true AND is_default = true;

-- Workflow step configurations (more granular control per defense line)
CREATE TABLE IF NOT EXISTS workflow_step_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  
  -- Step identity
  step_id TEXT NOT NULL,
  defense_line defense_line NOT NULL,
  
  -- Assignees configuration
  auto_assign_to JSONB,
  fallback_assignees UUID[],
  
  -- SLA settings
  sla_hours INTEGER,
  warning_hours INTEGER,
  escalation_hours INTEGER,
  escalation_to JSONB,
  
  -- Required actions/validations
  required_attachments TEXT[],
  required_approvals INTEGER DEFAULT 1,
  
  -- Skip conditions
  skip_conditions JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, workflow_template_id, step_id)
);

-- Individual approval records (for multi-approval scenarios)
CREATE TABLE IF NOT EXISTS workflow_approvals_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Reference to the workflow item
  workflow_type TEXT NOT NULL,
  workflow_item_id UUID NOT NULL,
  step_id TEXT NOT NULL,
  
  -- Approval details
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  decision TEXT NOT NULL,
  delegated_to UUID REFERENCES auth.users(id),
  
  -- Context
  conditions TEXT[],
  notes TEXT,
  risk_assessment_score INTEGER,
  
  -- Timing
  requested_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_v2_item ON workflow_approvals_v2(workflow_type, workflow_item_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_v2_approver ON workflow_approvals_v2(approver_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_v2_pending ON workflow_approvals_v2(organization_id, decided_at) WHERE decided_at IS NULL;

-- User delegation settings
CREATE TABLE IF NOT EXISTS user_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Delegation relationship
  delegator_id UUID NOT NULL REFERENCES auth.users(id),
  delegate_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Scope
  delegation_type TEXT NOT NULL DEFAULT 'all',
  workflow_types TEXT[],
  
  -- Time bounds
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  reason TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_delegations_active ON user_delegations(delegator_id) 
WHERE is_active = true;

-- Function to get effective assignee (handles delegation)
CREATE OR REPLACE FUNCTION get_effective_assignee(
  p_user_id UUID,
  p_workflow_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_delegate_id UUID;
BEGIN
  -- Check for active delegation
  SELECT delegate_id INTO v_delegate_id
  FROM user_delegations
  WHERE delegator_id = p_user_id
    AND is_active = true
    AND NOW() BETWEEN effective_from AND COALESCE(effective_until, 'infinity'::timestamptz)
    AND (delegation_type = 'all' OR p_workflow_type = ANY(workflow_types))
  ORDER BY effective_from DESC
  LIMIT 1;
  
  RETURN COALESCE(v_delegate_id, p_user_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE user_id = p_user_id 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get platform admin role
CREATE OR REPLACE FUNCTION get_platform_role(p_user_id UUID DEFAULT auth.uid())
RETURNS platform_role AS $$
DECLARE
  v_role platform_role;
BEGIN
  SELECT role INTO v_role
  FROM platform_admins
  WHERE user_id = p_user_id AND is_active = true;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Platform admin: Get all organizations
CREATE OR REPLACE FUNCTION admin_get_all_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  institution_type TEXT,
  user_count BIGINT,
  vendor_count BIGINT,
  created_at TIMESTAMPTZ,
  is_active BOOLEAN
) AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.institution_type::TEXT,
    COUNT(DISTINCT ou.user_id) AS user_count,
    COUNT(DISTINCT v.id) AS vendor_count,
    o.created_at,
    o.is_active
  FROM organizations o
  LEFT JOIN organization_users ou ON o.id = ou.organization_id AND ou.is_active = true
  LEFT JOIN vendors v ON o.id = v.organization_id
  GROUP BY o.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Platform admin: Get cross-FI third party usage
CREATE OR REPLACE FUNCTION admin_get_third_party_usage(
  p_global_third_party_id UUID
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  vendor_id UUID,
  vendor_name TEXT,
  risk_tier TEXT,
  contract_count BIGINT,
  total_contract_value DECIMAL
) AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    o.id AS organization_id,
    o.name AS organization_name,
    v.id AS vendor_id,
    v.legal_name AS vendor_name,
    v.risk_tier::TEXT,
    COUNT(DISTINCT c.id) AS contract_count,
    SUM(c.contract_value) AS total_contract_value
  FROM vendor_global_links vgl
  JOIN organizations o ON vgl.organization_id = o.id
  JOIN vendors v ON vgl.vendor_id = v.id
  LEFT JOIN contracts c ON v.id = c.vendor_id AND c.status = 'active'
  WHERE vgl.global_third_party_id = p_global_third_party_id
  GROUP BY o.id, o.name, v.id, v.legal_name, v.risk_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Platform admins table RLS
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage platform admins"
ON platform_admins FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = auth.uid()
    AND pa.is_active = true
    AND pa.role = 'super_admin'
  )
);

CREATE POLICY "Platform admins can view themselves"
ON platform_admins FOR SELECT
USING (user_id = auth.uid());

-- Global third parties RLS
ALTER TABLE global_third_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage global third parties"
ON global_third_parties FOR ALL
USING (is_platform_admin());

CREATE POLICY "Authenticated users can view global third parties"
ON global_third_parties FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Vendor global links RLS
ALTER TABLE vendor_global_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org vendor links"
ON vendor_global_links FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_platform_admin()
);

CREATE POLICY "Users can manage their org vendor links"
ON vendor_global_links FOR ALL
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_platform_admin()
);

-- Workflow templates RLS
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org templates and platform defaults"
ON workflow_templates FOR SELECT
USING (
  organization_id IS NULL
  OR organization_id = ANY(get_user_organization_ids())
  OR is_platform_admin()
);

CREATE POLICY "Org admins can manage their templates"
ON workflow_templates FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) AND 
   EXISTS (SELECT 1 FROM organization_users ou 
           WHERE ou.user_id = auth.uid() 
           AND ou.organization_id = workflow_templates.organization_id
           AND ou.defense_line = 'admin'))
  OR is_platform_admin()
);

-- Workflow step configs RLS
ALTER TABLE workflow_step_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org step configs"
ON workflow_step_configs FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_platform_admin()
);

CREATE POLICY "Org admins can manage step configs"
ON workflow_step_configs FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) AND 
   EXISTS (SELECT 1 FROM organization_users ou 
           WHERE ou.user_id = auth.uid() 
           AND ou.organization_id = workflow_step_configs.organization_id
           AND ou.defense_line = 'admin'))
  OR is_platform_admin()
);

-- Workflow approvals v2 RLS
ALTER TABLE workflow_approvals_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org approvals"
ON workflow_approvals_v2 FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_platform_admin()
);

CREATE POLICY "Users can create approvals for their org"
ON workflow_approvals_v2 FOR INSERT
WITH CHECK (
  organization_id = ANY(get_user_organization_ids())
);

-- User delegations RLS
ALTER TABLE user_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org delegations"
ON user_delegations FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_platform_admin()
);

CREATE POLICY "Users can manage their own delegations"
ON user_delegations FOR ALL
USING (
  (delegator_id = auth.uid() AND organization_id = ANY(get_user_organization_ids()))
  OR is_platform_admin()
);

-- Platform audit log RLS
ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view audit log"
ON platform_audit_log FOR SELECT
USING (is_platform_admin());

CREATE POLICY "System can insert audit log"
ON platform_audit_log FOR INSERT
WITH CHECK (true);

-- ============================================
-- DEFAULT WORKFLOW TEMPLATES
-- ============================================

-- Insert default vendor onboarding workflow template
INSERT INTO workflow_templates (
  organization_id,
  name,
  code,
  description,
  is_active,
  is_default,
  steps,
  conditions,
  sla_config,
  notification_config
) VALUES (
  NULL,
  'Standard Vendor Onboarding',
  'vendor_onboarding',
  'Default three-lines-of-defense workflow for vendor onboarding per OSFI B-10',
  true,
  true,
  '[
    {
      "order": 1,
      "id": "draft",
      "name": "Draft",
      "defense_line": "1a",
      "actions": ["save_draft", "submit", "delete"],
      "required_fields": ["vendor_legal_name", "vendor_country", "service_category", "service_description"],
      "next_step": "submitted"
    },
    {
      "order": 2,
      "id": "submitted",
      "name": "Submitted",
      "defense_line": "1a",
      "actions": ["recall"],
      "auto_transition": true,
      "auto_transition_delay_minutes": 0,
      "next_step": "1b_review"
    },
    {
      "order": 3,
      "id": "1b_review",
      "name": "1B Review",
      "defense_line": "1b",
      "actions": ["confirm", "return", "escalate"],
      "sla_hours": 48,
      "required_fields": ["review_notes_1b"],
      "next_step_on_confirm": "2nd_review",
      "next_step_on_return": "draft"
    },
    {
      "order": 4,
      "id": "2nd_review",
      "name": "2nd Line Review",
      "defense_line": "2nd",
      "actions": ["accept", "accept_with_conditions", "reject", "return"],
      "sla_hours": 72,
      "required_fields": ["review_notes_2nd"],
      "next_step_on_accept": "approved",
      "next_step_on_reject": "rejected",
      "next_step_on_return": "1b_review"
    },
    {
      "order": 5,
      "id": "approved",
      "name": "Approved",
      "defense_line": null,
      "actions": ["create_vendor"],
      "is_terminal": true
    },
    {
      "order": 6,
      "id": "rejected",
      "name": "Rejected",
      "defense_line": null,
      "actions": ["resubmit", "archive"],
      "is_terminal": true
    }
  ]'::jsonb,
  '{
    "skip_1b_for_low_risk": false,
    "skip_1b_contract_threshold": null,
    "require_2nd_line_for_all": true,
    "require_additional_approval_above": 5000000,
    "auto_approve_renewals_under": null
  }'::jsonb,
  '{
    "warning_threshold_percent": 75,
    "escalation_enabled": true,
    "escalation_recipients": ["admin", "manager"],
    "max_extensions": 2,
    "extension_hours": 24
  }'::jsonb,
  '{
    "on_submit": {"recipients": ["1b_reviewers"], "template": "new_submission"},
    "on_1b_confirm": {"recipients": ["2nd_reviewers"], "template": "ready_for_2nd_review"},
    "on_return": {"recipients": ["requestor"], "template": "request_returned"},
    "on_approve": {"recipients": ["requestor", "1b_reviewer"], "template": "request_approved"},
    "on_reject": {"recipients": ["requestor", "1b_reviewer"], "template": "request_rejected"},
    "on_sla_warning": {"recipients": ["assignee"], "template": "sla_warning"},
    "on_sla_breach": {"recipients": ["assignee", "admin"], "template": "sla_breach"}
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- Insert expedited workflow template (for low-risk, low-value vendors)
INSERT INTO workflow_templates (
  organization_id,
  name,
  code,
  description,
  is_active,
  is_default,
  steps,
  conditions
) VALUES (
  NULL,
  'Expedited Vendor Onboarding',
  'vendor_onboarding_expedited',
  'Simplified workflow for low-risk, low-value vendor relationships (skips 1B review)',
  true,
  false,
  '[
    {
      "order": 1,
      "id": "draft",
      "name": "Draft",
      "defense_line": "1a",
      "actions": ["save_draft", "submit", "delete"],
      "required_fields": ["vendor_legal_name", "vendor_country", "service_category"],
      "next_step": "2nd_review"
    },
    {
      "order": 2,
      "id": "2nd_review",
      "name": "2nd Line Review",
      "defense_line": "2nd",
      "actions": ["accept", "reject", "escalate_to_standard"],
      "sla_hours": 24,
      "next_step_on_accept": "approved",
      "next_step_on_reject": "rejected"
    },
    {
      "order": 3,
      "id": "approved",
      "name": "Approved",
      "defense_line": null,
      "actions": ["create_vendor"],
      "is_terminal": true
    },
    {
      "order": 4,
      "id": "rejected",
      "name": "Rejected",
      "defense_line": null,
      "actions": ["resubmit", "archive"],
      "is_terminal": true
    }
  ]'::jsonb,
  '{
    "eligible_risk_tiers": ["low", "informational"],
    "max_contract_value": 50000,
    "excluded_service_categories": ["technology_infrastructure", "data_processing", "cloud_services"]
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp triggers
DROP TRIGGER IF EXISTS trig_platform_admins_updated ON platform_admins;
CREATE TRIGGER trig_platform_admins_updated
  BEFORE UPDATE ON platform_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trig_global_third_parties_updated ON global_third_parties;
CREATE TRIGGER trig_global_third_parties_updated
  BEFORE UPDATE ON global_third_parties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trig_workflow_templates_updated ON workflow_templates;
CREATE TRIGGER trig_workflow_templates_updated
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trig_workflow_step_configs_updated ON workflow_step_configs;
CREATE TRIGGER trig_workflow_step_configs_updated
  BEFORE UPDATE ON workflow_step_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE platform_admins IS 'Platform-level administrators who can manage all tenants';
COMMENT ON TABLE global_third_parties IS 'Platform-wide third party registry for cross-FI linkage and concentration analysis';
COMMENT ON TABLE vendor_global_links IS 'Links tenant vendor records to global third party registry';
COMMENT ON TABLE workflow_templates IS 'Configurable workflow templates for different processes (platform defaults + tenant overrides)';
COMMENT ON TABLE workflow_step_configs IS 'Granular configuration for each workflow step per organization';
COMMENT ON TABLE workflow_approvals_v2 IS 'Individual approval records for multi-approval workflows';
COMMENT ON TABLE user_delegations IS 'Delegation settings for out-of-office and temporary assignments';
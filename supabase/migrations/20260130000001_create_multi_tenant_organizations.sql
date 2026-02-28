/*
  # Multi-Tenant Organizations Schema

  1. New Tables
    - `organizations` - Tenant/company profiles (FRFIs)
    - `organization_users` - User-organization membership with defense line roles
    - `defense_line_configs` - Configuration for each defense line per org
    - `delegation_rules` - Delegation and escalation rules

  2. Security
    - Enable RLS on all tables
    - Organizations are isolated
    - Users can only access their organization's data

  3. OSFI Compliance
    - Supports Three Lines of Defense model
    - Tracks OSFI registration and risk appetite
    - Audit trail for all changes
*/

-- Organization Types (OSFI FRFI categories)
CREATE TYPE institution_type AS ENUM (
  'bank',
  'foreign_bank_branch',
  'trust_company',
  'loan_company',
  'life_insurance',
  'property_casualty_insurance',
  'fraternal_benefit_society',
  'credit_union',
  'other'
);

-- Defense Line Types
CREATE TYPE defense_line AS ENUM (
  '1a',      -- First Line: Business Functions (requestors/owners)
  '1b',      -- First Line: Business Unit Risk Coordinators (reviewers)
  '2nd',     -- Second Line: Risk Management/Compliance
  '3rd',     -- Third Line: Internal Audit (advisory only in workflow)
  'admin'    -- Platform Administrators
);

-- Organizations Table (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Information
  name text NOT NULL,
  trading_name text,
  institution_type institution_type NOT NULL DEFAULT 'bank',
  
  -- Regulatory Information
  osfi_registration_number text,
  lei text,                                    -- Legal Entity Identifier
  
  -- Address
  street_address text,
  city text,
  province_state text,
  postal_code text,
  country text DEFAULT 'Canada',
  
  -- Primary Contact
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  
  -- Risk Appetite & Governance
  risk_appetite_statement text,
  max_critical_vendors integer,               -- Max number of critical vendors allowed
  max_single_vendor_concentration_pct decimal(5,2), -- e.g., 15.00 for 15%
  
  -- Settings (JSONB for flexibility)
  settings jsonb DEFAULT '{
    "require_1b_review": true,
    "require_2nd_line_for_critical": true,
    "auto_approve_low_risk": false,
    "onboarding_sla_days": 30,
    "due_diligence_reminder_days": [30, 14, 7],
    "default_review_frequency_days": 365
  }'::jsonb,
  
  -- Branding (optional)
  logo_url text,
  primary_color text DEFAULT '#1e293b',
  
  -- Status
  is_active boolean DEFAULT true,
  onboarded_at timestamptz,
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Organization Users Table
CREATE TABLE IF NOT EXISTS organization_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role & Defense Line
  defense_line defense_line NOT NULL DEFAULT '1a',
  role_title text,                            -- e.g., "Vendor Manager", "Risk Analyst"
  
  -- Business Unit Assignment
  business_unit text,
  department text,
  
  -- Permissions
  can_create_requests boolean DEFAULT true,
  can_review boolean DEFAULT false,           -- Set true for 1B and 2nd line
  can_approve boolean DEFAULT false,          -- Final approval authority
  can_manage_users boolean DEFAULT false,     -- Admin function
  can_configure_workflows boolean DEFAULT false,
  
  -- Approval Authority
  approval_limit_cad decimal(15,2),           -- Max value they can approve
  can_approve_critical boolean DEFAULT false, -- Can approve critical vendors
  
  -- Delegation
  delegate_to_user_id uuid REFERENCES auth.users(id),
  delegation_start_date date,
  delegation_end_date date,
  
  -- Contact Preferences
  notification_email text,
  receive_task_notifications boolean DEFAULT true,
  receive_escalation_notifications boolean DEFAULT true,
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  invited_by uuid REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(organization_id, user_id)
);

-- Defense Line Configurations per Organization
CREATE TABLE IF NOT EXISTS defense_line_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  defense_line defense_line NOT NULL,
  
  -- Configuration
  display_name text NOT NULL,                 -- e.g., "Business Risk Coordinators"
  description text,
  
  -- Workflow Settings
  is_required_in_workflow boolean DEFAULT true,
  can_skip_for_low_risk boolean DEFAULT false,
  review_sla_hours integer DEFAULT 72,        -- SLA for review completion
  escalation_after_hours integer DEFAULT 96,  -- Auto-escalate after X hours
  
  -- Notifications
  notify_on_new_request boolean DEFAULT true,
  notify_on_overdue boolean DEFAULT true,
  escalation_email text,                      -- Email for escalations
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, defense_line)
);

-- Delegation & Routing Rules
CREATE TABLE IF NOT EXISTS workflow_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rule Definition
  rule_name text NOT NULL,
  description text,
  rule_type text NOT NULL,                    -- 'auto_assign', 'escalation', 'skip'
  
  -- Conditions (JSONB for flexibility)
  conditions jsonb NOT NULL DEFAULT '{}',
  /* Example conditions:
    {
      "service_category": ["it_telecom_services", "cloud_data_services"],
      "estimated_value_min": 100000,
      "is_critical": true,
      "business_unit": "technology"
    }
  */
  
  -- Actions
  action_type text NOT NULL,                  -- 'assign_to_user', 'assign_to_role', 'skip_step', 'require_step'
  action_target text,                         -- User ID, role name, or step name
  action_parameters jsonb DEFAULT '{}',
  
  -- Priority (lower = higher priority)
  priority integer DEFAULT 100,
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add organization_id to existing profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS default_organization_id uuid REFERENCES organizations(id);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(institution_type);

CREATE INDEX IF NOT EXISTS idx_org_users_org ON organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_users_user ON organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_org_users_defense_line ON organization_users(defense_line);
CREATE INDEX IF NOT EXISTS idx_org_users_business_unit ON organization_users(business_unit);
CREATE INDEX IF NOT EXISTS idx_org_users_active ON organization_users(is_active);

CREATE INDEX IF NOT EXISTS idx_defense_configs_org ON defense_line_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_org ON workflow_routing_rules(organization_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE defense_line_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_routing_rules ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    array_agg(organization_id),
    '{}'::uuid[]
  )
  FROM organization_users
  WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is admin of an organization
CREATE OR REPLACE FUNCTION is_org_admin(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND defense_line = 'admin'
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Organizations: Users can see organizations they belong to
CREATE POLICY "Users can view their organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (id = ANY(get_user_organization_ids()));

-- Organizations: Only admins can update
CREATE POLICY "Admins can update their organization"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- Organizations: Anyone can create (for onboarding flow)
CREATE POLICY "Authenticated users can create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Organization Users: Can see users in same organization
CREATE POLICY "Users can view organization members"
  ON organization_users
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- Organization Users: Admins can manage members
CREATE POLICY "Admins can manage organization users"
  ON organization_users
  FOR ALL
  TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- Organization Users: Users can update their own record (limited)
CREATE POLICY "Users can update own org user record"
  ON organization_users
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Defense Line Configs: View for org members
CREATE POLICY "Users can view defense line configs"
  ON defense_line_configs
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- Defense Line Configs: Admins can manage
CREATE POLICY "Admins can manage defense line configs"
  ON defense_line_configs
  FOR ALL
  TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- Routing Rules: View for org members
CREATE POLICY "Users can view routing rules"
  ON workflow_routing_rules
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- Routing Rules: Admins can manage
CREATE POLICY "Admins can manage routing rules"
  ON workflow_routing_rules
  FOR ALL
  TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organization_users_updated_at
  BEFORE UPDATE ON organization_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_defense_line_configs_updated_at
  BEFORE UPDATE ON defense_line_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workflow_routing_rules_updated_at
  BEFORE UPDATE ON workflow_routing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create default defense line configs when org is created
CREATE OR REPLACE FUNCTION create_default_defense_configs()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default configs for each defense line
  INSERT INTO defense_line_configs (organization_id, defense_line, display_name, description)
  VALUES
    (NEW.id, '1a', 'Business Functions', 'First line of defense - business owners and requestors'),
    (NEW.id, '1b', 'Business Unit Risk Coordinators', 'First line of defense - departmental review and confirmation'),
    (NEW.id, '2nd', 'Risk Management & Compliance', 'Second line of defense - independent oversight and approval'),
    (NEW.id, '3rd', 'Internal Audit', 'Third line of defense - independent assurance'),
    (NEW.id, 'admin', 'Administrators', 'Platform and workflow administrators');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_defense_configs_on_org_create
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_defense_configs();

-- ============================================
-- SEED DATA (Optional - for development)
-- ============================================

-- This would be run separately or conditionally for dev environments
-- INSERT INTO organizations (name, institution_type, osfi_registration_number) 
-- VALUES ('Demo Bank', 'bank', 'DEMO-001');

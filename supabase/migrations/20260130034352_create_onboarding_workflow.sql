/*
  # Onboarding Workflow Schema - Three Lines of Defense

  1. New Tables
    - `onboarding_requests` - Third-party onboarding requests
    - `onboarding_tasks` - Tasks assigned to defense lines
    - `onboarding_comments` - Communication within workflow
    - `onboarding_documents` - Supporting documents for requests
    - `onboarding_audit_log` - Detailed audit trail

  2. Workflow States
    - draft → submitted → 1b_review → 2nd_review → approved/rejected → vendor_created
    - Supports returns, escalations, and conditional approvals

  3. OSFI Compliance
    - Full audit trail for regulatory examination
    - Risk-based routing
    - SLA tracking
*/

-- Onboarding Request Status
DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM (
    'draft',
    'submitted',
    '1b_review',
    '1b_returned',
    '2nd_review',
    '2nd_returned',
    'conditionally_approved',
    'approved',
    'rejected',
    'withdrawn',
    'vendor_created'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task Status
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'overdue',
    'escalated',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Review Decision Types
DO $$ BEGIN
  CREATE TYPE review_decision AS ENUM (
    'confirmed',           -- 1B confirms request is complete
    'returned',            -- Returned for more information
    'escalated',           -- Escalated to higher authority
    'accepted',            -- 2nd line accepts
    'rejected',            -- 2nd line rejects
    'conditionally_approved' -- Approved with conditions
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Onboarding Requests Table
CREATE TABLE IF NOT EXISTS onboarding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Request Identification
  request_number text UNIQUE,                 -- Auto-generated: ONB-YYYY-NNNN
  
  -- ============================================
  -- VENDOR INFORMATION (Proposed Third Party)
  -- ============================================
  vendor_legal_name text NOT NULL,
  vendor_trading_name text,
  vendor_description text,
  vendor_website text,
  vendor_country text DEFAULT 'Canada',
  vendor_province_state text,
  vendor_city text,
  vendor_number_of_employees integer,
  vendor_years_in_operation integer,
  vendor_primary_contact_name text,
  vendor_primary_contact_email text,
  vendor_primary_contact_phone text,
  
  -- ============================================
  -- SERVICE DETAILS
  -- ============================================
  service_category text NOT NULL,             -- Matches ServiceCategory type
  service_description text,
  provider_type text NOT NULL,                -- Matches ProviderType type
  
  -- Business Context
  requesting_business_unit text NOT NULL,
  business_justification text,
  strategic_rationale text,
  alternatives_considered text,
  
  -- ============================================
  -- FINANCIAL INFORMATION
  -- ============================================
  estimated_contract_value_cad decimal(15,2),
  contract_duration text,                     -- Matches ContractDuration type
  payment_terms text,
  budget_approved boolean DEFAULT false,
  budget_approval_reference text,
  
  -- ============================================
  -- INITIAL RISK INDICATORS
  -- ============================================
  
  -- Criticality Indicators
  is_critical_service boolean DEFAULT false,
  supports_essential_operations boolean DEFAULT false,
  failure_impact_description text,
  
  -- Data & System Access
  handles_sensitive_data boolean DEFAULT false,
  sensitive_data_types text[],                -- e.g., ['pii', 'financial', 'health']
  data_location text,                         -- Where data will be stored/processed
  has_system_access boolean DEFAULT false,
  system_access_description text,
  
  -- Outsourcing
  is_outsourcing boolean DEFAULT false,
  outsourcing_type text,                      -- e.g., 'business_process', 'it_services', 'cloud'
  
  -- Subcontracting
  uses_subcontractors boolean DEFAULT false,
  known_subcontractors text,
  
  -- Geographic Risk
  offshore_components boolean DEFAULT false,
  offshore_locations text[],
  
  -- ============================================
  -- AUTO-CALCULATED FIELDS
  -- ============================================
  preliminary_risk_tier text,                 -- Auto-calculated based on indicators
  preliminary_risk_score integer,
  requires_2nd_line_review boolean DEFAULT true,
  
  -- ============================================
  -- WORKFLOW STATE
  -- ============================================
  status onboarding_status DEFAULT 'draft',
  current_defense_line defense_line DEFAULT '1a',
  priority text DEFAULT 'medium',             -- low, medium, high, urgent
  
  -- SLA Tracking
  submitted_at timestamptz,
  target_completion_date date,
  sla_breached boolean DEFAULT false,
  
  -- ============================================
  -- 1ST LINE (1A) - REQUESTOR
  -- ============================================
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz,
  
  -- ============================================
  -- 1ST LINE (1B) - REVIEW & CONFIRM
  -- ============================================
  assigned_1b_reviewer uuid REFERENCES auth.users(id),
  assigned_1b_at timestamptz,
  
  reviewed_by_1b uuid REFERENCES auth.users(id),
  reviewed_at_1b timestamptz,
  review_decision_1b review_decision,
  review_notes_1b text,
  
  completeness_confirmed boolean DEFAULT false,
  business_need_validated boolean DEFAULT false,
  initial_risk_acknowledged boolean DEFAULT false,
  
  -- ============================================
  -- 2ND LINE - REVIEW & ACCEPT/REJECT
  -- ============================================
  assigned_2nd_reviewer uuid REFERENCES auth.users(id),
  assigned_2nd_at timestamptz,
  
  reviewed_by_2nd uuid REFERENCES auth.users(id),
  reviewed_at_2nd timestamptz,
  review_decision_2nd review_decision,
  review_notes_2nd text,
  
  -- Risk Assessment by 2nd Line
  risk_assessment_2nd text,
  risk_appetite_alignment text,               -- 'within', 'exceeds', 'significantly_exceeds'
  
  -- Conditions (if conditionally approved)
  approval_conditions text[],
  conditions_due_date date,
  conditions_owner uuid REFERENCES auth.users(id),
  
  -- ============================================
  -- FINAL DECISION
  -- ============================================
  final_status text,
  final_decision_by uuid REFERENCES auth.users(id),
  final_decision_at timestamptz,
  final_decision_notes text,
  
  -- ============================================
  -- POST-APPROVAL
  -- ============================================
  created_vendor_id uuid,                     -- References vendors table after creation
  vendor_created_at timestamptz,
  
  -- Due diligence triggered
  due_diligence_required boolean DEFAULT true,
  due_diligence_scope text,
  
  -- ============================================
  -- AUDIT
  -- ============================================
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  version integer DEFAULT 1
);

-- Onboarding Tasks Table
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
  
  -- Task Definition
  task_type text NOT NULL,                    -- 'review', 'approval', 'document_request', 'due_diligence', 'information_request'
  defense_line defense_line NOT NULL,
  sequence_order integer DEFAULT 0,
  
  -- Assignment
  assigned_to uuid REFERENCES auth.users(id),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  
  -- Task Details
  title text NOT NULL,
  description text,
  instructions text,
  
  -- Timing
  due_date timestamptz,
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  
  -- Priority & Status
  priority text DEFAULT 'medium',
  status task_status DEFAULT 'pending',
  
  -- Completion
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  completion_notes text,
  outcome text,                               -- Result of the task
  
  -- Escalation
  escalated boolean DEFAULT false,
  escalated_to uuid REFERENCES auth.users(id),
  escalated_at timestamptz,
  escalation_reason text,
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Onboarding Comments Table (Communication Thread)
CREATE TABLE IF NOT EXISTS onboarding_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
  task_id uuid REFERENCES onboarding_tasks(id) ON DELETE SET NULL,
  parent_comment_id uuid REFERENCES onboarding_comments(id) ON DELETE SET NULL,
  
  -- Comment Details
  comment_type text DEFAULT 'general',        -- 'general', 'question', 'response', 'decision', 'system'
  defense_line defense_line,                  -- Which line made the comment
  
  -- Content
  content text NOT NULL,
  
  -- Visibility
  is_internal boolean DEFAULT false,          -- Internal to defense line
  visible_to_lines defense_line[] DEFAULT ARRAY['1a', '1b', '2nd', 'admin']::defense_line[],
  
  -- Author
  author_id uuid REFERENCES auth.users(id),
  author_name text,
  author_role text,
  
  -- Mentions
  mentioned_users uuid[],
  
  -- Attachments (references to documents)
  attachment_ids uuid[],
  
  -- Status
  is_edited boolean DEFAULT false,
  edited_at timestamptz,
  
  -- Audit
  created_at timestamptz DEFAULT now()
);

-- Onboarding Documents Table
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
  task_id uuid REFERENCES onboarding_tasks(id) ON DELETE SET NULL,
  
  -- Document Details
  document_type text,                         -- 'business_case', 'vendor_info', 'security_assessment', etc.
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  storage_path text NOT NULL,
  
  -- Metadata
  description text,
  version integer DEFAULT 1,
  is_current boolean DEFAULT true,
  
  -- Upload Info
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  
  -- Review Status
  reviewed boolean DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  
  -- Audit
  created_at timestamptz DEFAULT now()
);

-- Onboarding Audit Log Table
CREATE TABLE IF NOT EXISTS onboarding_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
  
  -- Action Details
  action_type text NOT NULL,                  -- 'created', 'updated', 'status_changed', 'assigned', 'reviewed', 'commented', etc.
  action_description text,
  
  -- State Change
  previous_status onboarding_status,
  new_status onboarding_status,
  previous_defense_line defense_line,
  new_defense_line defense_line,
  
  -- Changed Data (for detailed auditing)
  changed_fields jsonb,
  previous_values jsonb,
  new_values jsonb,
  
  -- Actor
  performed_by uuid REFERENCES auth.users(id),
  performed_by_name text,
  performed_by_defense_line defense_line,
  
  -- Technical Details
  ip_address inet,
  user_agent text,
  
  -- Timestamp
  performed_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_org ON onboarding_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status ON onboarding_requests(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_defense_line ON onboarding_requests(current_defense_line);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_requested_by ON onboarding_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_1b_reviewer ON onboarding_requests(assigned_1b_reviewer);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_2nd_reviewer ON onboarding_requests(assigned_2nd_reviewer);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_number ON onboarding_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_vendor_name ON onboarding_requests(vendor_legal_name);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_org ON onboarding_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_request ON onboarding_tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_assigned ON onboarding_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON onboarding_tasks(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_defense_line ON onboarding_tasks(defense_line);

CREATE INDEX IF NOT EXISTS idx_onboarding_comments_request ON onboarding_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_comments_author ON onboarding_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_request ON onboarding_documents(request_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_audit_request ON onboarding_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_audit_actor ON onboarding_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_audit_time ON onboarding_audit_log(performed_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: Get user's defense line in an organization
CREATE OR REPLACE FUNCTION get_user_defense_line(org_id uuid)
RETURNS defense_line AS $$
  SELECT defense_line
  FROM organization_users
  WHERE organization_id = org_id
  AND user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: Check if user can review (1B or 2nd line)
CREATE OR REPLACE FUNCTION user_can_review(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND defense_line IN ('1b', '2nd', 'admin')
    AND can_review = true
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Onboarding Requests: Users can view requests in their org
CREATE POLICY "Users can view org onboarding requests"
  ON onboarding_requests
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- Onboarding Requests: 1A can create
CREATE POLICY "Users can create onboarding requests"
  ON onboarding_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- Onboarding Requests: Requestor can update draft, reviewers can update assigned
CREATE POLICY "Users can update appropriate onboarding requests"
  ON onboarding_requests
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND (
      -- Requestor can update their own draft
      (requested_by = auth.uid() AND status = 'draft')
      -- 1B reviewer can update during 1b_review
      OR (assigned_1b_reviewer = auth.uid() AND status = '1b_review')
      -- 2nd line reviewer can update during 2nd_review
      OR (assigned_2nd_reviewer = auth.uid() AND status = '2nd_review')
      -- Admins can always update
      OR is_org_admin(organization_id)
    )
  );

-- Tasks: Users can view tasks in their org
CREATE POLICY "Users can view org tasks"
  ON onboarding_tasks
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- Tasks: Admins and system can create tasks
CREATE POLICY "System can create tasks"
  ON onboarding_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- Tasks: Assigned users can update their tasks
CREATE POLICY "Users can update assigned tasks"
  ON onboarding_tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR is_org_admin(organization_id)
  );

-- Comments: Users can view comments in their org (respecting visibility)
CREATE POLICY "Users can view visible comments"
  ON onboarding_comments
  FOR SELECT
  TO authenticated
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND (
      get_user_defense_line(organization_id) = ANY(visible_to_lines)
      OR is_org_admin(organization_id)
    )
  );

-- Comments: Users can create comments
CREATE POLICY "Users can create comments"
  ON onboarding_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- Documents: Users can view documents in their org
CREATE POLICY "Users can view org documents"
  ON onboarding_documents
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- Documents: Users can upload documents
CREATE POLICY "Users can upload documents"
  ON onboarding_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- Audit Log: Users can view audit log in their org
CREATE POLICY "Users can view org audit log"
  ON onboarding_audit_log
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- Audit Log: System can insert (no user should insert directly)
CREATE POLICY "System can insert audit log"
  ON onboarding_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-generate request number
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part text;
  seq_num integer;
  new_number text;
BEGIN
  IF NEW.request_number IS NULL THEN
    year_part := to_char(now(), 'YYYY');
    
    -- Get next sequence number for this org and year
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(request_number FROM 'ONB-' || year_part || '-(\d+)') AS integer)
    ), 0) + 1
    INTO seq_num
    FROM onboarding_requests
    WHERE organization_id = NEW.organization_id
    AND request_number LIKE 'ONB-' || year_part || '-%';
    
    NEW.request_number := 'ONB-' || year_part || '-' || LPAD(seq_num::text, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_onboarding_request_number ON onboarding_requests;
CREATE TRIGGER generate_onboarding_request_number
  BEFORE INSERT ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION generate_request_number();

-- Auto-calculate preliminary risk tier based on indicators
CREATE OR REPLACE FUNCTION calculate_preliminary_risk()
RETURNS TRIGGER AS $$
DECLARE
  risk_score integer := 0;
  risk_tier text;
BEGIN
  -- Calculate risk score based on indicators
  IF NEW.is_critical_service THEN risk_score := risk_score + 30; END IF;
  IF NEW.supports_essential_operations THEN risk_score := risk_score + 25; END IF;
  IF NEW.handles_sensitive_data THEN risk_score := risk_score + 20; END IF;
  IF NEW.has_system_access THEN risk_score := risk_score + 15; END IF;
  IF NEW.is_outsourcing THEN risk_score := risk_score + 15; END IF;
  IF NEW.uses_subcontractors THEN risk_score := risk_score + 10; END IF;
  IF NEW.offshore_components THEN risk_score := risk_score + 10; END IF;
  
  -- Add score based on contract value
  IF NEW.estimated_contract_value_cad IS NOT NULL THEN
    IF NEW.estimated_contract_value_cad >= 1000000 THEN risk_score := risk_score + 20;
    ELSIF NEW.estimated_contract_value_cad >= 500000 THEN risk_score := risk_score + 15;
    ELSIF NEW.estimated_contract_value_cad >= 100000 THEN risk_score := risk_score + 10;
    ELSIF NEW.estimated_contract_value_cad >= 50000 THEN risk_score := risk_score + 5;
    END IF;
  END IF;
  
  -- Determine tier
  IF risk_score >= 80 THEN
    risk_tier := 'tier_5_critical';
    NEW.requires_2nd_line_review := true;
  ELSIF risk_score >= 60 THEN
    risk_tier := 'tier_4_high';
    NEW.requires_2nd_line_review := true;
  ELSIF risk_score >= 40 THEN
    risk_tier := 'tier_3_moderate';
    NEW.requires_2nd_line_review := true;
  ELSIF risk_score >= 20 THEN
    risk_tier := 'tier_2_low';
    NEW.requires_2nd_line_review := false;
  ELSE
    risk_tier := 'tier_1_informational';
    NEW.requires_2nd_line_review := false;
  END IF;
  
  NEW.preliminary_risk_score := risk_score;
  NEW.preliminary_risk_tier := risk_tier;
  
  -- Critical services always require 2nd line
  IF NEW.is_critical_service THEN
    NEW.requires_2nd_line_review := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_onboarding_risk ON onboarding_requests;
CREATE TRIGGER calculate_onboarding_risk
  BEFORE INSERT OR UPDATE ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION calculate_preliminary_risk();

-- Log status changes to audit
CREATE OR REPLACE FUNCTION log_onboarding_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.current_defense_line IS DISTINCT FROM NEW.current_defense_line THEN
    INSERT INTO onboarding_audit_log (
      organization_id,
      request_id,
      action_type,
      action_description,
      previous_status,
      new_status,
      previous_defense_line,
      new_defense_line,
      performed_by
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      'status_changed',
      'Request status changed from ' || COALESCE(OLD.status::text, 'null') || ' to ' || NEW.status::text,
      OLD.status,
      NEW.status,
      OLD.current_defense_line,
      NEW.current_defense_line,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_onboarding_status_changes ON onboarding_requests;
CREATE TRIGGER log_onboarding_status_changes
  AFTER UPDATE ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION log_onboarding_status_change();

-- Update timestamp trigger
DROP TRIGGER IF EXISTS update_onboarding_requests_updated_at ON onboarding_requests;
CREATE TRIGGER update_onboarding_requests_updated_at
  BEFORE UPDATE ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_onboarding_tasks_updated_at ON onboarding_tasks;
CREATE TRIGGER update_onboarding_tasks_updated_at
  BEFORE UPDATE ON onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- WORKFLOW HELPER FUNCTIONS
-- ============================================

-- Submit request (moves from draft to submitted, creates 1B task)
CREATE OR REPLACE FUNCTION submit_onboarding_request(request_id uuid)
RETURNS jsonb AS $$
DECLARE
  req onboarding_requests%ROWTYPE;
  reviewer_id uuid;
  task_id uuid;
BEGIN
  -- Get the request
  SELECT * INTO req FROM onboarding_requests WHERE id = request_id;
  
  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  IF req.status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not in draft status');
  END IF;
  
  -- Find a 1B reviewer in the same business unit
  SELECT ou.user_id INTO reviewer_id
  FROM organization_users ou
  WHERE ou.organization_id = req.organization_id
  AND ou.defense_line = '1b'
  AND ou.business_unit = req.requesting_business_unit
  AND ou.can_review = true
  AND ou.is_active = true
  LIMIT 1;
  
  -- If no BU-specific reviewer, find any 1B reviewer
  IF reviewer_id IS NULL THEN
    SELECT ou.user_id INTO reviewer_id
    FROM organization_users ou
    WHERE ou.organization_id = req.organization_id
    AND ou.defense_line = '1b'
    AND ou.can_review = true
    AND ou.is_active = true
    LIMIT 1;
  END IF;
  
  -- Update request status
  UPDATE onboarding_requests
  SET 
    status = '1b_review',
    current_defense_line = '1b',
    submitted_at = now(),
    requested_at = now(),
    assigned_1b_reviewer = reviewer_id,
    assigned_1b_at = now(),
    target_completion_date = CURRENT_DATE + INTERVAL '30 days'
  WHERE id = request_id;
  
  -- Create review task for 1B
  INSERT INTO onboarding_tasks (
    organization_id,
    request_id,
    task_type,
    defense_line,
    assigned_to,
    assigned_by,
    title,
    description,
    due_date,
    priority
  ) VALUES (
    req.organization_id,
    request_id,
    'review',
    '1b',
    reviewer_id,
    auth.uid(),
    'Review Onboarding Request: ' || req.vendor_legal_name,
    'Please review and confirm the completeness of this onboarding request.',
    now() + INTERVAL '72 hours',
    CASE 
      WHEN req.is_critical_service THEN 'high'
      ELSE 'medium'
    END
  )
  RETURNING id INTO task_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'status', '1b_review',
    'assigned_to', reviewer_id,
    'task_id', task_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1B Review Decision
CREATE OR REPLACE FUNCTION process_1b_review(
  request_id uuid,
  decision review_decision,
  notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  req onboarding_requests%ROWTYPE;
  reviewer_id uuid;
  task_id uuid;
BEGIN
  -- Get the request
  SELECT * INTO req FROM onboarding_requests WHERE id = request_id;
  
  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  IF req.status != '1b_review' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not in 1B review status');
  END IF;
  
  -- Complete the 1B review task
  UPDATE onboarding_tasks
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = auth.uid(),
    completion_notes = notes,
    outcome = decision::text
  WHERE request_id = process_1b_review.request_id
  AND defense_line = '1b'
  AND status IN ('pending', 'in_progress');
  
  IF decision = 'confirmed' THEN
    -- Move to 2nd line review if required
    IF req.requires_2nd_line_review THEN
      -- Find a 2nd line reviewer
      SELECT ou.user_id INTO reviewer_id
      FROM organization_users ou
      WHERE ou.organization_id = req.organization_id
      AND ou.defense_line = '2nd'
      AND ou.can_review = true
      AND ou.is_active = true
      LIMIT 1;
      
      UPDATE onboarding_requests
      SET 
        status = '2nd_review',
        current_defense_line = '2nd',
        reviewed_by_1b = auth.uid(),
        reviewed_at_1b = now(),
        review_decision_1b = decision,
        review_notes_1b = notes,
        completeness_confirmed = true,
        assigned_2nd_reviewer = reviewer_id,
        assigned_2nd_at = now()
      WHERE id = request_id;
      
      -- Create 2nd line review task
      INSERT INTO onboarding_tasks (
        organization_id,
        request_id,
        task_type,
        defense_line,
        assigned_to,
        assigned_by,
        title,
        description,
        due_date,
        priority
      ) VALUES (
        req.organization_id,
        request_id,
        'approval',
        '2nd',
        reviewer_id,
        auth.uid(),
        'Risk Review: ' || req.vendor_legal_name,
        'Please review risk assessment and provide approval decision.',
        now() + INTERVAL '72 hours',
        CASE 
          WHEN req.is_critical_service THEN 'high'
          ELSE 'medium'
        END
      );
      
      RETURN jsonb_build_object('success', true, 'status', '2nd_review');
    ELSE
      -- Auto-approve if 2nd line not required
      UPDATE onboarding_requests
      SET 
        status = 'approved',
        reviewed_by_1b = auth.uid(),
        reviewed_at_1b = now(),
        review_decision_1b = decision,
        review_notes_1b = notes,
        completeness_confirmed = true,
        final_status = 'approved',
        final_decision_by = auth.uid(),
        final_decision_at = now()
      WHERE id = request_id;
      
      RETURN jsonb_build_object('success', true, 'status', 'approved');
    END IF;
    
  ELSIF decision = 'returned' THEN
    UPDATE onboarding_requests
    SET 
      status = '1b_returned',
      current_defense_line = '1a',
      reviewed_by_1b = auth.uid(),
      reviewed_at_1b = now(),
      review_decision_1b = decision,
      review_notes_1b = notes
    WHERE id = request_id;
    
    RETURN jsonb_build_object('success', true, 'status', '1b_returned');
  END IF;
  
  RETURN jsonb_build_object('success', false, 'error', 'Invalid decision');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2nd Line Review Decision
CREATE OR REPLACE FUNCTION process_2nd_line_review(
  request_id uuid,
  decision review_decision,
  notes text DEFAULT NULL,
  conditions text[] DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  req onboarding_requests%ROWTYPE;
BEGIN
  -- Get the request
  SELECT * INTO req FROM onboarding_requests WHERE id = request_id;
  
  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  IF req.status != '2nd_review' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not in 2nd line review status');
  END IF;
  
  -- Complete the 2nd line review task
  UPDATE onboarding_tasks
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = auth.uid(),
    completion_notes = notes,
    outcome = decision::text
  WHERE request_id = process_2nd_line_review.request_id
  AND defense_line = '2nd'
  AND status IN ('pending', 'in_progress');
  
  IF decision = 'accepted' THEN
    UPDATE onboarding_requests
    SET 
      status = 'approved',
      reviewed_by_2nd = auth.uid(),
      reviewed_at_2nd = now(),
      review_decision_2nd = decision,
      review_notes_2nd = notes,
      final_status = 'approved',
      final_decision_by = auth.uid(),
      final_decision_at = now()
    WHERE id = request_id;
    
    RETURN jsonb_build_object('success', true, 'status', 'approved');
    
  ELSIF decision = 'conditionally_approved' THEN
    UPDATE onboarding_requests
    SET 
      status = 'conditionally_approved',
      reviewed_by_2nd = auth.uid(),
      reviewed_at_2nd = now(),
      review_decision_2nd = decision,
      review_notes_2nd = notes,
      approval_conditions = conditions,
      final_status = 'conditionally_approved',
      final_decision_by = auth.uid(),
      final_decision_at = now()
    WHERE id = request_id;
    
    RETURN jsonb_build_object('success', true, 'status', 'conditionally_approved');
    
  ELSIF decision = 'rejected' THEN
    UPDATE onboarding_requests
    SET 
      status = 'rejected',
      reviewed_by_2nd = auth.uid(),
      reviewed_at_2nd = now(),
      review_decision_2nd = decision,
      review_notes_2nd = notes,
      final_status = 'rejected',
      final_decision_by = auth.uid(),
      final_decision_at = now()
    WHERE id = request_id;
    
    RETURN jsonb_build_object('success', true, 'status', 'rejected');
    
  ELSIF decision = 'returned' THEN
    UPDATE onboarding_requests
    SET 
      status = '2nd_returned',
      current_defense_line = '1b',
      reviewed_by_2nd = auth.uid(),
      reviewed_at_2nd = now(),
      review_decision_2nd = decision,
      review_notes_2nd = notes
    WHERE id = request_id;
    
    RETURN jsonb_build_object('success', true, 'status', '2nd_returned');
  END IF;
  
  RETURN jsonb_build_object('success', false, 'error', 'Invalid decision');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
/*
  # Create Due Diligence Document Collection Workflow

  Implements OSFI B-10 Section 2.2.2 requiring "due diligence proportionate to risk level."

  ## Summary of Changes

  1. New Table: `due_diligence_document_types`
    - Defines standard document types (SOC 2, SIG, Financial Statements, etc.)
    - Configures which documents are required per tier
    - Configures which documents block vendor activation

  2. New Table: `due_diligence_document_requests`
    - Tracks document requests created after 2nd line approval
    - Links to vendor, onboarding request, and document type
    - Status workflow: requested -> received -> reviewed -> approved/rejected

  3. New Table: `due_diligence_request_reminders`
    - Tracks reminder notifications sent for outstanding documents
    - Supports escalation paths

  4. New Table: `vendor_activation_blocks`
    - Records blocking status when critical documents are missing
    - Tracks when blocks are resolved

  5. Organization Configuration
    - Customizable blocking rules per organization
    - Tier-specific document requirements

  ## Security
    - RLS policies for all new tables
    - Organization-scoped access
*/

-- ============================================
-- SECTION 1: DUE DILIGENCE DOCUMENT TYPES
-- ============================================

CREATE TABLE IF NOT EXISTS due_diligence_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',

  required_for_tiers text[] DEFAULT ARRAY[]::text[],
  blocks_activation_for_tiers text[] DEFAULT ARRAY[]::text[],
  default_due_days integer DEFAULT 30,
  reminder_days integer[] DEFAULT ARRAY[7, 3, 1]::integer[],

  is_active boolean DEFAULT true,
  display_order integer DEFAULT 100,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dd_doc_types_code ON due_diligence_document_types(code);
CREATE INDEX IF NOT EXISTS idx_dd_doc_types_active ON due_diligence_document_types(is_active);

INSERT INTO due_diligence_document_types (code, name, description, category, required_for_tiers, blocks_activation_for_tiers, default_due_days, display_order) VALUES
  ('soc2_report', 'SOC 2 Type II Report', 'Service Organization Control report covering security, availability, processing integrity, confidentiality, and privacy', 'security', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY['tier_5_critical']::text[], 30, 10),
  ('soc1_report', 'SOC 1 Type II Report', 'Service Organization Control report for financial reporting controls', 'security', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY[]::text[], 30, 15),
  ('iso27001_cert', 'ISO 27001 Certification', 'Information Security Management System certification', 'security', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY[]::text[], 30, 20),
  ('sig_questionnaire', 'SIG Questionnaire', 'Standardized Information Gathering questionnaire for vendor security assessment', 'security', ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate']::text[], ARRAY['tier_5_critical', 'tier_4_high']::text[], 21, 25),
  ('security_questionnaire', 'Security Questionnaire', 'General security assessment questionnaire', 'security', ARRAY['tier_3_moderate', 'tier_2_low']::text[], ARRAY[]::text[], 14, 30),
  ('penetration_test', 'Penetration Test Results', 'Third-party penetration testing report (within last 12 months)', 'security', ARRAY['tier_5_critical']::text[], ARRAY['tier_5_critical']::text[], 45, 35),
  ('vulnerability_assessment', 'Vulnerability Assessment', 'Vulnerability scan and assessment results', 'security', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY[]::text[], 30, 40),
  ('financial_statements', 'Audited Financial Statements', 'Most recent audited financial statements (annual report)', 'financial', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY['tier_5_critical']::text[], 30, 50),
  ('credit_report', 'Credit Report / D&B Report', 'Business credit report or Dun & Bradstreet report', 'financial', ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate']::text[], ARRAY[]::text[], 14, 55),
  ('insurance_certificates', 'Insurance Certificates', 'Certificates of insurance (liability, E&O, cyber)', 'legal', ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low']::text[], ARRAY['tier_5_critical', 'tier_4_high']::text[], 14, 60),
  ('bcp_plan', 'Business Continuity Plan', 'Business continuity and disaster recovery plan', 'operational', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY['tier_5_critical']::text[], 30, 70),
  ('dr_plan', 'Disaster Recovery Plan', 'Disaster recovery plan with RTO/RPO details', 'operational', ARRAY['tier_5_critical']::text[], ARRAY['tier_5_critical']::text[], 30, 75),
  ('bcp_test_results', 'BCP/DR Test Results', 'Results from most recent BCP/DR testing', 'operational', ARRAY['tier_5_critical']::text[], ARRAY[]::text[], 45, 80),
  ('incident_response_plan', 'Incident Response Plan', 'Security incident response procedures', 'security', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY[]::text[], 30, 85),
  ('regulatory_compliance_attestation', 'Regulatory Compliance Attestation', 'Attestation of compliance with relevant regulations', 'compliance', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY['tier_5_critical']::text[], 21, 90),
  ('privacy_impact_assessment', 'Privacy Impact Assessment', 'Privacy impact assessment or DPIA', 'compliance', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY[]::text[], 30, 95),
  ('subcontractor_list', 'Subcontractor/Fourth Party List', 'List of material subcontractors and fourth parties', 'operational', ARRAY['tier_5_critical', 'tier_4_high']::text[], ARRAY[]::text[], 21, 100),
  ('reference_checks', 'Reference Checks', 'Client references and reference check results', 'general', ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate']::text[], ARRAY[]::text[], 21, 105),
  ('basic_vendor_information', 'Basic Vendor Information', 'Company profile and basic information form', 'general', ARRAY['tier_5_critical', 'tier_4_high', 'tier_3_moderate', 'tier_2_low', 'tier_1_informational']::text[], ARRAY[]::text[], 7, 110),
  ('on_site_assessment', 'On-Site Assessment Report', 'Results from on-site vendor assessment', 'security', ARRAY['tier_5_critical']::text[], ARRAY[]::text[], 60, 115)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  required_for_tiers = EXCLUDED.required_for_tiers,
  blocks_activation_for_tiers = EXCLUDED.blocks_activation_for_tiers,
  default_due_days = EXCLUDED.default_due_days,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ============================================
-- SECTION 2: DUE DILIGENCE DOCUMENT REQUESTS
-- ============================================

DO $$ BEGIN
  CREATE TYPE dd_request_status AS ENUM (
    'requested',
    'received',
    'under_review',
    'approved',
    'rejected',
    'waived',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS due_diligence_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  onboarding_request_id uuid REFERENCES onboarding_requests(id) ON DELETE CASCADE,

  document_type_code text NOT NULL REFERENCES due_diligence_document_types(code),
  status dd_request_status NOT NULL DEFAULT 'requested',

  is_critical boolean DEFAULT false,
  blocks_activation boolean DEFAULT false,

  requested_at timestamptz DEFAULT now(),
  requested_by uuid REFERENCES auth.users(id),
  requested_by_name text,
  due_date date NOT NULL,

  received_document_id uuid,
  received_at timestamptz,
  received_by_name text,

  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_notes text,
  rejection_reason text,

  waived_by uuid REFERENCES auth.users(id),
  waived_by_name text,
  waived_at timestamptz,
  waiver_reason text,
  waiver_approved_by uuid REFERENCES auth.users(id),
  waiver_approved_at timestamptz,

  reminder_count integer DEFAULT 0,
  last_reminder_at timestamptz,
  next_reminder_at timestamptz,

  notes text,
  internal_notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dd_requests_org ON due_diligence_document_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_dd_requests_vendor ON due_diligence_document_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_dd_requests_onboarding ON due_diligence_document_requests(onboarding_request_id);
CREATE INDEX IF NOT EXISTS idx_dd_requests_status ON due_diligence_document_requests(status);
CREATE INDEX IF NOT EXISTS idx_dd_requests_due_date ON due_diligence_document_requests(due_date);
CREATE INDEX IF NOT EXISTS idx_dd_requests_doc_type ON due_diligence_document_requests(document_type_code);

ALTER TABLE due_diligence_document_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view DD requests in their org"
  ON due_diligence_document_requests
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can insert DD requests in their org"
  ON due_diligence_document_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can update DD requests in their org"
  ON due_diligence_document_requests
  FOR UPDATE
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()))
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SECTION 3: DOCUMENT REQUEST REMINDERS
-- ============================================

CREATE TABLE IF NOT EXISTS due_diligence_request_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_request_id uuid NOT NULL REFERENCES due_diligence_document_requests(id) ON DELETE CASCADE,

  reminder_type text NOT NULL DEFAULT 'standard',
  reminder_number integer NOT NULL DEFAULT 1,

  sent_at timestamptz DEFAULT now(),
  sent_to_email text,
  sent_to_name text,
  sent_by_system boolean DEFAULT true,

  escalated boolean DEFAULT false,
  escalated_to uuid REFERENCES auth.users(id),
  escalation_reason text,

  response_received boolean DEFAULT false,
  response_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dd_reminders_org ON due_diligence_request_reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_dd_reminders_request ON due_diligence_request_reminders(document_request_id);
CREATE INDEX IF NOT EXISTS idx_dd_reminders_sent ON due_diligence_request_reminders(sent_at);

ALTER TABLE due_diligence_request_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view reminders in their org"
  ON due_diligence_request_reminders
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can insert reminders in their org"
  ON due_diligence_request_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SECTION 4: VENDOR ACTIVATION BLOCKS
-- ============================================

CREATE TABLE IF NOT EXISTS vendor_activation_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  block_reason text NOT NULL,
  blocking_document_request_ids uuid[] DEFAULT ARRAY[]::uuid[],
  missing_document_types text[] DEFAULT ARRAY[]::text[],

  is_active boolean DEFAULT true,
  blocked_at timestamptz DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id),

  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_notes text,

  override_allowed boolean DEFAULT false,
  override_by uuid REFERENCES auth.users(id),
  override_at timestamptz,
  override_reason text,
  override_approved_by uuid REFERENCES auth.users(id),
  override_expires_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_blocks_org ON vendor_activation_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_activation_blocks_vendor ON vendor_activation_blocks(vendor_id);

ALTER TABLE vendor_activation_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view activation blocks in their org"
  ON vendor_activation_blocks
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can manage activation blocks in their org"
  ON vendor_activation_blocks
  FOR ALL
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()))
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SECTION 5: ORGANIZATION DD CONFIG
-- ============================================

CREATE TABLE IF NOT EXISTS organization_dd_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  enforce_blocking boolean DEFAULT true,
  allow_blocking_override boolean DEFAULT true,
  override_requires_approval boolean DEFAULT true,
  override_approver_defense_line defense_line DEFAULT '2nd',

  auto_create_requests_on_approval boolean DEFAULT true,
  auto_send_reminders boolean DEFAULT true,
  reminder_frequency_days integer DEFAULT 7,
  max_reminders integer DEFAULT 3,
  escalation_after_reminders integer DEFAULT 2,

  custom_document_requirements jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT org_dd_config_unique UNIQUE (organization_id)
);

ALTER TABLE organization_dd_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view DD config in their org"
  ON organization_dd_config
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can manage DD config in their org"
  ON organization_dd_config
  FOR ALL
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()))
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SECTION 6: FUNCTION TO CREATE DOCUMENT REQUESTS
-- ============================================

CREATE OR REPLACE FUNCTION create_due_diligence_document_requests(
  p_organization_id uuid,
  p_vendor_id uuid,
  p_onboarding_request_id uuid,
  p_validated_tier text,
  p_due_diligence_requirements text[],
  p_requested_by uuid,
  p_requested_by_name text
)
RETURNS jsonb AS $$
DECLARE
  doc_type RECORD;
  created_count integer := 0;
  blocking_count integer := 0;
  request_ids uuid[] := ARRAY[]::uuid[];
  new_request_id uuid;
  calc_due_date date;
BEGIN
  FOR doc_type IN
    SELECT dt.code, dt.name, dt.default_due_days, dt.blocks_activation_for_tiers
    FROM due_diligence_document_types dt
    WHERE dt.is_active = true
    AND (
      p_validated_tier = ANY(dt.required_for_tiers)
      OR dt.code = ANY(p_due_diligence_requirements)
    )
    ORDER BY dt.display_order
  LOOP
    calc_due_date := CURRENT_DATE + doc_type.default_due_days;

    INSERT INTO due_diligence_document_requests (
      organization_id,
      vendor_id,
      onboarding_request_id,
      document_type_code,
      status,
      is_critical,
      blocks_activation,
      requested_by,
      requested_by_name,
      due_date,
      next_reminder_at
    ) VALUES (
      p_organization_id,
      p_vendor_id,
      p_onboarding_request_id,
      doc_type.code,
      'requested',
      p_validated_tier IN ('tier_5_critical', 'tier_4_high'),
      p_validated_tier = ANY(doc_type.blocks_activation_for_tiers),
      p_requested_by,
      p_requested_by_name,
      calc_due_date,
      CURRENT_DATE + LEAST(doc_type.default_due_days - 7, 7)
    )
    RETURNING id INTO new_request_id;

    request_ids := array_append(request_ids, new_request_id);
    created_count := created_count + 1;

    IF p_validated_tier = ANY(doc_type.blocks_activation_for_tiers) THEN
      blocking_count := blocking_count + 1;
    END IF;
  END LOOP;

  IF blocking_count > 0 AND p_vendor_id IS NOT NULL THEN
    INSERT INTO vendor_activation_blocks (
      organization_id,
      vendor_id,
      block_reason,
      blocking_document_request_ids,
      missing_document_types,
      blocked_by
    )
    SELECT
      p_organization_id,
      p_vendor_id,
      'Missing critical due diligence documents',
      request_ids,
      ARRAY(
        SELECT document_type_code
        FROM due_diligence_document_requests
        WHERE id = ANY(request_ids) AND blocks_activation = true
      ),
      p_requested_by
    WHERE NOT EXISTS (
      SELECT 1 FROM vendor_activation_blocks
      WHERE vendor_id = p_vendor_id AND is_active = true
    );

    UPDATE vendors
    SET status = 'pending_assessment',
        lifecycle_stage = 'due_diligence',
        updated_at = now()
    WHERE id = p_vendor_id
    AND status NOT IN ('suspended', 'terminated');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'created_count', created_count,
    'blocking_count', blocking_count,
    'request_ids', request_ids
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 7: FUNCTION TO CHECK ACTIVATION STATUS
-- ============================================

CREATE OR REPLACE FUNCTION check_vendor_activation_status(p_vendor_id uuid)
RETURNS jsonb AS $$
DECLARE
  pending_blocking integer;
  total_requests integer;
  approved_requests integer;
  block_record RECORD;
BEGIN
  SELECT COUNT(*) INTO pending_blocking
  FROM due_diligence_document_requests
  WHERE vendor_id = p_vendor_id
  AND blocks_activation = true
  AND status NOT IN ('approved', 'waived');

  SELECT COUNT(*) INTO total_requests
  FROM due_diligence_document_requests
  WHERE vendor_id = p_vendor_id;

  SELECT COUNT(*) INTO approved_requests
  FROM due_diligence_document_requests
  WHERE vendor_id = p_vendor_id
  AND status IN ('approved', 'waived');

  SELECT * INTO block_record
  FROM vendor_activation_blocks
  WHERE vendor_id = p_vendor_id AND is_active = true
  LIMIT 1;

  IF pending_blocking = 0 AND block_record.id IS NOT NULL THEN
    UPDATE vendor_activation_blocks
    SET is_active = false,
        resolved_at = now(),
        resolution_notes = 'All blocking documents received and approved'
    WHERE id = block_record.id;

    UPDATE vendors
    SET status = 'active',
        lifecycle_stage = 'monitoring',
        updated_at = now()
    WHERE id = p_vendor_id
    AND status = 'pending_assessment';
  END IF;

  RETURN jsonb_build_object(
    'can_activate', pending_blocking = 0,
    'pending_blocking_documents', pending_blocking,
    'total_requests', total_requests,
    'approved_requests', approved_requests,
    'completion_percentage', CASE WHEN total_requests > 0 THEN ROUND((approved_requests::numeric / total_requests) * 100) ELSE 0 END,
    'is_blocked', block_record.id IS NOT NULL AND block_record.is_active,
    'block_id', block_record.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 8: FUNCTION TO UPDATE REQUEST STATUS
-- ============================================

CREATE OR REPLACE FUNCTION update_document_request_status(
  p_request_id uuid,
  p_new_status text,
  p_user_id uuid,
  p_user_name text,
  p_notes text DEFAULT NULL,
  p_document_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  req RECORD;
  vendor_status jsonb;
BEGIN
  SELECT * INTO req FROM due_diligence_document_requests WHERE id = p_request_id;

  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  CASE p_new_status
    WHEN 'received' THEN
      UPDATE due_diligence_document_requests
      SET status = 'received',
          received_at = now(),
          received_by_name = p_user_name,
          received_document_id = p_document_id,
          notes = COALESCE(p_notes, notes),
          updated_at = now()
      WHERE id = p_request_id;

    WHEN 'under_review' THEN
      UPDATE due_diligence_document_requests
      SET status = 'under_review',
          reviewed_by = p_user_id,
          reviewed_by_name = p_user_name,
          updated_at = now()
      WHERE id = p_request_id;

    WHEN 'approved' THEN
      UPDATE due_diligence_document_requests
      SET status = 'approved',
          reviewed_by = COALESCE(reviewed_by, p_user_id),
          reviewed_by_name = COALESCE(reviewed_by_name, p_user_name),
          reviewed_at = now(),
          review_notes = p_notes,
          updated_at = now()
      WHERE id = p_request_id;

      IF req.vendor_id IS NOT NULL THEN
        SELECT check_vendor_activation_status(req.vendor_id) INTO vendor_status;
      END IF;

    WHEN 'rejected' THEN
      UPDATE due_diligence_document_requests
      SET status = 'rejected',
          reviewed_by = COALESCE(reviewed_by, p_user_id),
          reviewed_by_name = COALESCE(reviewed_by_name, p_user_name),
          reviewed_at = now(),
          rejection_reason = p_notes,
          updated_at = now()
      WHERE id = p_request_id;

    WHEN 'waived' THEN
      UPDATE due_diligence_document_requests
      SET status = 'waived',
          waived_by = p_user_id,
          waived_by_name = p_user_name,
          waived_at = now(),
          waiver_reason = p_notes,
          updated_at = now()
      WHERE id = p_request_id;

      IF req.vendor_id IS NOT NULL THEN
        SELECT check_vendor_activation_status(req.vendor_id) INTO vendor_status;
      END IF;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END CASE;

  RETURN jsonb_build_object(
    'success', true,
    'new_status', p_new_status,
    'vendor_activation_status', vendor_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 9: TRIGGER FOR AUTO-CREATING REQUESTS
-- ============================================

CREATE OR REPLACE FUNCTION auto_create_dd_requests_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  config RECORD;
  result jsonb;
  user_name text;
BEGIN
  IF NEW.status IN ('approved', 'conditionally_approved')
  AND OLD.status NOT IN ('approved', 'conditionally_approved')
  AND NEW.due_diligence_requirements IS NOT NULL
  AND array_length(NEW.due_diligence_requirements, 1) > 0 THEN

    SELECT * INTO config
    FROM organization_dd_config
    WHERE organization_id = NEW.organization_id;

    IF config.id IS NULL OR config.auto_create_requests_on_approval THEN
      SELECT COALESCE(p.full_name, 'System') INTO user_name
      FROM profiles p WHERE p.id = NEW.reviewed_by_2nd;

      SELECT create_due_diligence_document_requests(
        NEW.organization_id,
        NEW.created_vendor_id,
        NEW.id,
        COALESCE(NEW.validated_tier, NEW.calculated_tier, NEW.preliminary_risk_tier),
        NEW.due_diligence_requirements,
        NEW.reviewed_by_2nd,
        user_name
      ) INTO result;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_create_dd_requests ON onboarding_requests;
CREATE TRIGGER trigger_auto_create_dd_requests
  AFTER UPDATE ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION auto_create_dd_requests_on_approval();

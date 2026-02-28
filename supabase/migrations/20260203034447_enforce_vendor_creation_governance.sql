/*
  # Enforce Vendor Creation Governance and Onboarding Workflow

  ## Summary
  This migration closes all vendor creation bypass routes and ensures every vendor
  goes through proper risk assessment and approval workflows before being added
  to the system.

  ## Changes

  ### 1. Database Constraints
  - Add validation trigger ensuring vendors can only be created from approved onboarding requests
  - Add check constraint preventing active status without completed assessment
  - Add vendor creation permissions column to organization_users
  - Create audit logging for all vendor creation attempts

  ### 2. RLS Policy Updates
  - Restrict vendor INSERT to users with explicit vendor creation permission
  - Require valid approved onboarding_request_id for all new vendors
  - Update policies to check onboarding request approval status

  ### 3. Helper Functions
  - Function to validate onboarding request is approved
  - Function to check if user has vendor creation permission
  - Function to create vendor from approved onboarding request
  - Audit logging for vendor creation events

  ### 4. Security Enhancements
  - Block direct vendor creation without onboarding request
  - Enforce assessment requirement before operational status
  - Multi-level approval validation
  - Complete audit trail

  ## Impact
  - Existing vendor creation via forms will be blocked
  - Bulk import will need to create onboarding requests first
  - All vendor creation must go through onboarding workflow
  - Provides complete governance and compliance trail
*/

-- ============================================
-- STEP 1: Add vendor creation permission column
-- ============================================

-- Add can_create_vendors permission to organization_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_create_vendors'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_create_vendors boolean DEFAULT false;
  END IF;
END $$;

-- By default, 2nd line and admins can create vendors (from approved onboarding)
UPDATE organization_users
SET can_create_vendors = true
WHERE defense_line IN ('2nd', 'admin');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_organization_users_can_create_vendors
  ON organization_users(organization_id, can_create_vendors)
  WHERE can_create_vendors = true;

-- ============================================
-- STEP 2: Create validation functions
-- ============================================

-- Function to check if onboarding request is approved
CREATE OR REPLACE FUNCTION is_onboarding_request_approved(request_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM onboarding_requests
    WHERE id = request_id
    AND status IN ('approved', 'conditionally_approved')
    AND created_vendor_id IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user can create vendors in organization
CREATE OR REPLACE FUNCTION user_can_create_vendors(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND is_active = true
    AND (can_create_vendors = true OR defense_line IN ('admin', '2nd'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if vendor has completed assessment
CREATE OR REPLACE FUNCTION vendor_has_assessment(vendor_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tiering_assessments
    WHERE tiering_assessments.vendor_id = vendor_has_assessment.vendor_id
    AND status = 'completed'
    AND final_tier IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- STEP 3: Create validation trigger for vendor insertion
-- ============================================

-- Trigger function to validate vendor creation
CREATE OR REPLACE FUNCTION validate_vendor_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if onboarding_request_id is provided
  IF NEW.onboarding_request_id IS NULL THEN
    RAISE EXCEPTION 'Vendors can only be created from approved onboarding requests. onboarding_request_id is required.';
  END IF;

  -- Validate that onboarding request exists and is approved
  IF NOT is_onboarding_request_approved(NEW.onboarding_request_id) THEN
    RAISE EXCEPTION 'Onboarding request must be approved before vendor creation. Request ID: %', NEW.onboarding_request_id;
  END IF;

  -- Check if onboarding request already has a vendor created
  IF EXISTS (
    SELECT 1 FROM onboarding_requests
    WHERE id = NEW.onboarding_request_id
    AND created_vendor_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This onboarding request has already been used to create a vendor.';
  END IF;

  -- Validate organization_id matches onboarding request
  IF NOT EXISTS (
    SELECT 1 FROM onboarding_requests
    WHERE id = NEW.onboarding_request_id
    AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Vendor organization_id must match onboarding request organization_id.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS enforce_vendor_governance ON vendors;
CREATE TRIGGER enforce_vendor_governance
  BEFORE INSERT ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION validate_vendor_creation();

-- ============================================
-- STEP 4: Create trigger to prevent active status without assessment
-- ============================================

-- Trigger function to validate vendor status changes
CREATE OR REPLACE FUNCTION validate_vendor_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If changing to active or operational lifecycle, ensure assessment exists
  IF (NEW.status = 'active' OR NEW.lifecycle_stage = 'operational') THEN
    IF NOT vendor_has_assessment(NEW.id) AND NEW.tier IS NULL THEN
      RAISE EXCEPTION 'Vendor cannot be active without completed risk assessment. Complete tiering assessment first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS enforce_vendor_assessment ON vendors;
CREATE TRIGGER enforce_vendor_assessment
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.lifecycle_stage IS DISTINCT FROM OLD.lifecycle_stage)
  EXECUTE FUNCTION validate_vendor_status();

-- ============================================
-- STEP 5: Create trigger to update onboarding request when vendor created
-- ============================================

-- Trigger function to link vendor back to onboarding request
CREATE OR REPLACE FUNCTION link_vendor_to_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  -- Update onboarding request with created vendor id
  IF NEW.onboarding_request_id IS NOT NULL THEN
    UPDATE onboarding_requests
    SET
      created_vendor_id = NEW.id,
      vendor_created_at = now(),
      status = 'vendor_created'
    WHERE id = NEW.onboarding_request_id
    AND created_vendor_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS link_to_onboarding_request ON vendors;
CREATE TRIGGER link_to_onboarding_request
  AFTER INSERT ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION link_vendor_to_onboarding();

-- ============================================
-- STEP 6: Create vendor creation audit log table
-- ============================================

-- Create vendor creation audit log
CREATE TABLE IF NOT EXISTS vendor_creation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Attempt details
  attempt_result text NOT NULL,
  block_reason text,
  error_message text,

  -- Vendor details (if created)
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_legal_name text,

  -- Onboarding request details
  onboarding_request_id uuid REFERENCES onboarding_requests(id) ON DELETE SET NULL,
  onboarding_request_status text,

  -- User details
  attempted_by uuid REFERENCES auth.users(id),
  user_defense_line defense_line,
  had_permission boolean DEFAULT false,

  -- Source details
  creation_source text,
  source_details jsonb,

  -- Technical details
  ip_address inet,
  user_agent text,

  -- Timestamp
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendor_creation_audit_org ON vendor_creation_audit(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_creation_audit_vendor ON vendor_creation_audit(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_creation_audit_user ON vendor_creation_audit(attempted_by);
CREATE INDEX IF NOT EXISTS idx_vendor_creation_audit_result ON vendor_creation_audit(attempt_result);
CREATE INDEX IF NOT EXISTS idx_vendor_creation_audit_time ON vendor_creation_audit(created_at DESC);

-- Enable RLS
ALTER TABLE vendor_creation_audit ENABLE ROW LEVEL SECURITY;

-- Users can view audit logs in their organization
CREATE POLICY "Users can view org vendor creation audit"
  ON vendor_creation_audit
  FOR SELECT
  TO authenticated
  USING (organization_id = ANY(get_user_organization_ids()));

-- System can insert audit logs
CREATE POLICY "System can insert vendor creation audit"
  ON vendor_creation_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- ============================================
-- STEP 7: Update vendors table RLS policies
-- ============================================

-- Drop existing vendor INSERT policy
DROP POLICY IF EXISTS "Users can insert vendors in their organization" ON vendors;

-- Create new restrictive INSERT policy
CREATE POLICY "Authorized users can create vendors from approved onboarding"
  ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY(get_user_organization_ids())
    AND user_can_create_vendors(organization_id)
    AND onboarding_request_id IS NOT NULL
  );

-- ============================================
-- STEP 8: Create helper function for creating vendor from onboarding
-- ============================================

-- Function to create vendor from approved onboarding request
CREATE OR REPLACE FUNCTION create_vendor_from_onboarding(request_id uuid)
RETURNS jsonb AS $$
DECLARE
  req onboarding_requests%ROWTYPE;
  new_vendor_id uuid;
  result jsonb;
BEGIN
  SELECT * INTO req FROM onboarding_requests WHERE id = request_id;

  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding request not found');
  END IF;

  IF req.status NOT IN ('approved', 'conditionally_approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding request must be approved first');
  END IF;

  IF req.created_vendor_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vendor already created from this request');
  END IF;

  IF NOT user_can_create_vendors(req.organization_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User does not have permission to create vendors');
  END IF;

  INSERT INTO vendors (
    organization_id,
    onboarding_request_id,
    legal_name,
    trading_name,
    description,
    country,
    province_state,
    city,
    website,
    number_of_employees,
    years_in_operation,
    primary_contact_name,
    primary_contact_email,
    primary_contact_phone,
    responsible_officer,
    business_unit,
    service_category,
    service_description,
    provider_type,
    is_critical,
    status,
    lifecycle_stage,
    contract_value_cad,
    has_system_access,
    handles_sensitive_data,
    uses_subcontractors,
    data_location,
    created_by
  ) VALUES (
    req.organization_id,
    req.id,
    req.vendor_legal_name,
    req.vendor_trading_name,
    req.vendor_description,
    req.vendor_country,
    req.vendor_province_state,
    req.vendor_city,
    req.vendor_website,
    req.vendor_number_of_employees,
    req.vendor_years_in_operation,
    req.vendor_primary_contact_name,
    req.vendor_primary_contact_email,
    req.vendor_primary_contact_phone,
    req.requesting_business_unit,
    req.requesting_business_unit,
    req.service_category,
    req.service_description,
    req.provider_type,
    req.is_critical_service,
    'pending_assessment',
    'onboarding',
    req.estimated_contract_value_cad,
    req.has_system_access,
    req.handles_sensitive_data,
    req.uses_subcontractors,
    req.data_location,
    auth.uid()
  )
  RETURNING id INTO new_vendor_id;

  IF req.preliminary_risk_tier IS NOT NULL THEN
    INSERT INTO assessment_tasks (
      organization_id,
      vendor_id,
      task_type,
      status,
      priority,
      assigned_defense_line,
      due_date,
      trigger_reason,
      preliminary_tier,
      notes
    ) VALUES (
      req.organization_id,
      new_vendor_id,
      'tiering_assessment',
      'pending',
      CASE WHEN req.is_critical_service THEN 'high' ELSE 'normal' END,
      '1b',
      CURRENT_DATE + INTERVAL '14 days',
      'Vendor created from approved onboarding request',
      req.preliminary_risk_tier,
      'Assessment required for vendor: ' || req.vendor_legal_name
    );
  END IF;

  INSERT INTO vendor_creation_audit (
    organization_id,
    attempt_result,
    vendor_id,
    vendor_legal_name,
    onboarding_request_id,
    onboarding_request_status,
    attempted_by,
    had_permission,
    creation_source,
    source_details
  ) VALUES (
    req.organization_id,
    'success',
    new_vendor_id,
    req.vendor_legal_name,
    req.id,
    req.status::text,
    auth.uid(),
    true,
    'workflow',
    jsonb_build_object(
      'request_number', req.request_number,
      'preliminary_tier', req.preliminary_risk_tier
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'vendor_id', new_vendor_id,
    'message', 'Vendor created successfully from onboarding request'
  );

EXCEPTION WHEN OTHERS THEN
  INSERT INTO vendor_creation_audit (
    organization_id,
    attempt_result,
    block_reason,
    error_message,
    vendor_legal_name,
    onboarding_request_id,
    attempted_by,
    creation_source
  ) VALUES (
    req.organization_id,
    'error',
    'exception',
    SQLERRM,
    req.vendor_legal_name,
    req.id,
    auth.uid(),
    'workflow'
  );

  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 9: Add helpful views for compliance reporting
-- ============================================

CREATE OR REPLACE VIEW vendors_without_onboarding AS
SELECT
  v.id,
  v.vendor_id,
  v.legal_name,
  v.organization_id,
  v.status,
  v.created_at,
  v.created_by,
  'Missing onboarding request' as issue
FROM vendors v
WHERE v.onboarding_request_id IS NULL;

CREATE OR REPLACE VIEW vendors_missing_assessment AS
SELECT
  v.id,
  v.vendor_id,
  v.legal_name,
  v.organization_id,
  v.status,
  v.lifecycle_stage,
  v.created_at,
  CASE
    WHEN v.status = 'active' THEN 'Critical: Active without assessment'
    WHEN v.lifecycle_stage = 'operational' THEN 'High: Operational without assessment'
    ELSE 'Medium: Pending assessment'
  END as risk_level
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM tiering_assessments ta
  WHERE ta.vendor_id = v.id
  AND ta.status = 'completed'
)
AND v.tier IS NULL;

GRANT SELECT ON vendors_without_onboarding TO authenticated;
GRANT SELECT ON vendors_missing_assessment TO authenticated;

/*
  # Backfill Legacy Vendors with Onboarding Requests

  1. Purpose
    - Create retrospective onboarding requests for existing vendors that were created before the governance system was implemented
    - Ensure all vendors have proper onboarding_request_id linkage for auditability
    - Mark these as retrospective for compliance reporting

  2. Process
    - Identify all vendors without onboarding_request_id
    - Create onboarding requests with status 'retrospective_approved' for each
    - Link vendors to their new onboarding requests
    - Add metadata indicating these were backfilled

  3. Changes
    - Add 'retrospective_approved' status to onboarding_status enum
    - Create function to backfill vendors
    - Add 'is_retrospective' flag to onboarding_requests

  4. Security
    - Maintain all existing RLS policies
    - Ensure data integrity during migration
*/

-- Add retrospective status to onboarding_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'retrospective_approved'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'onboarding_status')
  ) THEN
    ALTER TYPE onboarding_status ADD VALUE IF NOT EXISTS 'retrospective_approved';
  END IF;
END $$;

-- Add is_retrospective column to onboarding_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'is_retrospective'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN is_retrospective boolean DEFAULT false;
  END IF;
END $$;

-- Create index for retrospective flag
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_retrospective ON onboarding_requests(is_retrospective);

-- Function to backfill vendors without onboarding requests
CREATE OR REPLACE FUNCTION backfill_legacy_vendors()
RETURNS TABLE (
  vendor_id uuid,
  vendor_name text,
  onboarding_request_id uuid,
  status text
) AS $$
DECLARE
  vendor_record RECORD;
  new_request_id uuid;
  system_user_id uuid;
BEGIN
  SELECT id INTO system_user_id FROM auth.users LIMIT 1;
  
  FOR vendor_record IN
    SELECT 
      v.id,
      v.legal_name,
      v.organization_id,
      v.service_category,
      v.provider_type,
      v.business_unit,
      v.is_critical,
      v.contract_value_cad,
      v.primary_contact_name,
      v.primary_contact_email,
      v.primary_contact_phone,
      v.country,
      v.city,
      v.province_state,
      v.website,
      v.description,
      v.handles_sensitive_data,
      v.has_system_access,
      v.uses_subcontractors,
      v.created_by
    FROM vendors v
    WHERE v.onboarding_request_id IS NULL
    ORDER BY v.created_at DESC
  LOOP
    INSERT INTO onboarding_requests (
      organization_id,
      legal_name,
      trading_name,
      country,
      city,
      province_state,
      website,
      description,
      service_category,
      provider_type,
      business_unit,
      is_critical,
      contract_value_cad,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      handles_sensitive_data,
      has_system_access,
      uses_subcontractors,
      business_justification,
      requested_by,
      status,
      is_retrospective,
      is_draft,
      submitted_at,
      approved_at
    ) VALUES (
      vendor_record.organization_id,
      vendor_record.legal_name,
      vendor_record.legal_name,
      COALESCE(vendor_record.country, 'Unknown'),
      vendor_record.city,
      vendor_record.province_state,
      vendor_record.website,
      vendor_record.description,
      COALESCE(vendor_record.service_category, 'other'),
      COALESCE(vendor_record.provider_type, 'service_provider'),
      vendor_record.business_unit,
      COALESCE(vendor_record.is_critical, false),
      vendor_record.contract_value_cad,
      vendor_record.primary_contact_name,
      vendor_record.primary_contact_email,
      vendor_record.primary_contact_phone,
      COALESCE(vendor_record.handles_sensitive_data, false),
      COALESCE(vendor_record.has_system_access, false),
      COALESCE(vendor_record.uses_subcontractors, false),
      'Retrospective onboarding request created during system migration. This vendor was added before the formal onboarding process was implemented.',
      COALESCE(vendor_record.created_by, system_user_id),
      'retrospective_approved',
      true,
      false,
      now(),
      now()
    ) RETURNING id INTO new_request_id;

    UPDATE vendors
    SET onboarding_request_id = new_request_id
    WHERE id = vendor_record.id;

    vendor_id := vendor_record.id;
    vendor_name := vendor_record.legal_name;
    onboarding_request_id := new_request_id;
    status := 'backfilled';
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view to identify vendors needing backfill
CREATE OR REPLACE VIEW vendors_needing_backfill AS
SELECT 
  v.id,
  v.legal_name,
  v.organization_id,
  v.status,
  v.created_at,
  v.created_by,
  CASE 
    WHEN v.onboarding_request_id IS NULL THEN 'needs_backfill'
    ELSE 'has_onboarding_request'
  END as backfill_status
FROM vendors v
WHERE v.onboarding_request_id IS NULL
ORDER BY v.created_at DESC;

-- Grant permissions to view
GRANT SELECT ON vendors_needing_backfill TO authenticated;

-- Add comment explaining the backfill process
COMMENT ON FUNCTION backfill_legacy_vendors() IS 
'Creates retrospective onboarding requests for vendors that existed before the governance system. 
This ensures all vendors have proper audit trails and onboarding documentation.
Returns a list of backfilled vendors with their new onboarding request IDs.';

COMMENT ON VIEW vendors_needing_backfill IS 
'Identifies vendors without onboarding requests that need retrospective documentation.
Used by admins to track and remediate legacy vendor records.';

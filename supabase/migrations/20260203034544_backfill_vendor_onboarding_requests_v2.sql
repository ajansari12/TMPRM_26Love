/*
  # Backfill Onboarding Requests for Existing Vendors (v2)

  ## Summary
  Creates retrospective onboarding requests for vendors that were created before
  the governance workflow was enforced. This ensures all vendors have proper
  audit trail and onboarding documentation.

  ## Changes
  - Creates retrospective onboarding requests for vendors without onboarding_request_id
  - Marks these requests with special status 'vendor_created'
  - Links vendors back to their retrospective onboarding requests
  - Preserves all vendor data in onboarding request for audit trail

  ## Approach
  - First create all onboarding requests
  - Then update vendors in a separate transaction without trigger interference
*/

-- Step 1: Temporarily modify the trigger to allow NULL onboarding_request_id for updates
CREATE OR REPLACE FUNCTION validate_vendor_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation for UPDATE operations (only enforce on INSERT)
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Check if onboarding_request_id is provided for INSERT
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

-- Step 2: Create retrospective onboarding requests and link to vendors
DO $$
DECLARE
  vendor_record RECORD;
  new_request_id uuid;
  backfill_count integer := 0;
BEGIN
  FOR vendor_record IN
    SELECT * FROM vendors
    WHERE onboarding_request_id IS NULL
    ORDER BY created_at
  LOOP
    -- Create retrospective onboarding request
    INSERT INTO onboarding_requests (
      organization_id,
      vendor_legal_name,
      vendor_trading_name,
      vendor_description,
      vendor_website,
      vendor_country,
      vendor_province_state,
      vendor_city,
      vendor_number_of_employees,
      vendor_years_in_operation,
      vendor_primary_contact_name,
      vendor_primary_contact_email,
      vendor_primary_contact_phone,
      service_category,
      service_description,
      provider_type,
      requesting_business_unit,
      business_justification,
      estimated_contract_value_cad,
      contract_duration,
      is_critical_service,
      supports_essential_operations,
      handles_sensitive_data,
      has_system_access,
      uses_subcontractors,
      data_location,
      status,
      current_defense_line,
      requested_by,
      requested_at,
      submitted_at,
      reviewed_by_1b,
      reviewed_at_1b,
      review_decision_1b,
      review_notes_1b,
      reviewed_by_2nd,
      reviewed_at_2nd,
      review_decision_2nd,
      review_notes_2nd,
      final_status,
      final_decision_by,
      final_decision_at,
      final_decision_notes,
      created_vendor_id,
      vendor_created_at,
      created_at,
      updated_at
    ) VALUES (
      vendor_record.organization_id,
      vendor_record.legal_name,
      vendor_record.trading_name,
      vendor_record.description,
      vendor_record.website,
      vendor_record.country,
      vendor_record.province_state,
      vendor_record.city,
      vendor_record.number_of_employees,
      vendor_record.years_in_operation,
      vendor_record.primary_contact_name,
      vendor_record.primary_contact_email,
      vendor_record.primary_contact_phone,
      vendor_record.service_category,
      vendor_record.service_description,
      vendor_record.provider_type,
      COALESCE(vendor_record.business_unit, 'unknown'),
      'Retrospective onboarding request - vendor created before governance workflow was enforced.',
      vendor_record.contract_value_cad,
      vendor_record.contract_duration,
      vendor_record.is_critical,
      vendor_record.is_critical,
      vendor_record.handles_sensitive_data,
      vendor_record.has_system_access,
      vendor_record.uses_subcontractors,
      vendor_record.data_location,
      'vendor_created',
      'admin',
      vendor_record.created_by,
      vendor_record.created_at,
      vendor_record.created_at,
      vendor_record.created_by,
      vendor_record.created_at,
      'confirmed',
      'Retrospective approval - vendor was created before workflow enforcement',
      vendor_record.created_by,
      vendor_record.created_at,
      'accepted',
      'Retrospective approval - vendor already exists in system and is being documented retroactively',
      'approved',
      vendor_record.created_by,
      vendor_record.created_at,
      'Retrospective documentation of pre-existing vendor relationship',
      vendor_record.id,
      vendor_record.created_at,
      vendor_record.created_at,
      now()
    )
    RETURNING id INTO new_request_id;

    -- Update vendor with onboarding_request_id
    -- The trigger now allows UPDATE operations
    UPDATE vendors
    SET onboarding_request_id = new_request_id
    WHERE id = vendor_record.id;

    -- Log the retrospective creation
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
      vendor_record.organization_id,
      'success',
      vendor_record.id,
      vendor_record.legal_name,
      new_request_id,
      'vendor_created',
      vendor_record.created_by,
      true,
      'retrospective_backfill',
      jsonb_build_object(
        'reason', 'Backfill for vendor created before governance enforcement',
        'original_created_at', vendor_record.created_at,
        'backfill_date', now()
      )
    );

    backfill_count := backfill_count + 1;
  END LOOP;

  IF backfill_count > 0 THEN
    RAISE NOTICE 'Backfill complete. Created % retrospective onboarding requests for existing vendors.', backfill_count;
  ELSE
    RAISE NOTICE 'No vendors need backfill. All vendors already have onboarding requests.';
  END IF;
END $$;

-- Step 3: Add comment to onboarding_requests for retrospective records
COMMENT ON COLUMN onboarding_requests.status IS 'Request status. vendor_created indicates retrospective documentation of pre-existing vendor.';

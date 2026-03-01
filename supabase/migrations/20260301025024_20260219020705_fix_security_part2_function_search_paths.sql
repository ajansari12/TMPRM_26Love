/*
  # Security Fix Part 2: Function Search Path Mutable
  Note: clone_onboarding_request and backfill_legacy_vendors use corrected column names
  to match the current onboarding_requests schema (vendor_legal_name, vendor_country, etc.)
*/

DROP POLICY IF EXISTS "Authorized users can create vendors from approved onboarding" ON public.vendors;

DROP FUNCTION IF EXISTS public.is_onboarding_request_approved(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_create_vendors(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.vendor_has_assessment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_vendor_status() CASCADE;
DROP FUNCTION IF EXISTS public.link_vendor_to_onboarding() CASCADE;
DROP FUNCTION IF EXISTS public.update_onboarding_template_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.validate_vendor_creation() CASCADE;
DROP FUNCTION IF EXISTS public.create_vendor_from_onboarding(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.clone_onboarding_request(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.backfill_legacy_vendors() CASCADE;

CREATE FUNCTION public.is_onboarding_request_approved(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.onboarding_requests
    WHERE id = request_id
      AND status IN ('approved', 'conditionally_approved')
      AND created_vendor_id IS NULL
  );
END;
$$;

CREATE FUNCTION public.user_can_create_vendors(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND is_active = true
      AND (can_create_vendors = true OR defense_line IN ('admin', '2nd'))
  );
END;
$$;

CREATE FUNCTION public.vendor_has_assessment(vendor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tiering_assessments ta
    WHERE ta.vendor_id = vendor_has_assessment.vendor_id
      AND ta.status = 'completed'
      AND ta.calculated_tier IS NOT NULL
  );
END;
$$;

CREATE FUNCTION public.validate_vendor_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.status = 'active' OR NEW.lifecycle_stage = 'operational') THEN
    IF NOT public.vendor_has_assessment(NEW.id) AND NEW.tier IS NULL THEN
      RAISE EXCEPTION 'Vendor cannot be active without completed risk assessment. Complete tiering assessment first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.link_vendor_to_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.onboarding_request_id IS NOT NULL THEN
    UPDATE public.onboarding_requests
    SET
      created_vendor_id = NEW.id,
      vendor_created_at = now(),
      status = 'vendor_created'
    WHERE id = NEW.onboarding_request_id
      AND created_vendor_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_onboarding_template_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.validate_vendor_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.onboarding_request_id IS NULL THEN
    RAISE EXCEPTION 'Vendors can only be created from approved onboarding requests. onboarding_request_id is required.';
  END IF;

  IF NOT public.is_onboarding_request_approved(NEW.onboarding_request_id) THEN
    RAISE EXCEPTION 'Onboarding request must be approved before vendor creation. Request ID: %', NEW.onboarding_request_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.onboarding_requests
    WHERE id = NEW.onboarding_request_id
      AND created_vendor_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This onboarding request has already been used to create a vendor.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_requests
    WHERE id = NEW.onboarding_request_id
      AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Vendor organization_id must match onboarding request organization_id.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.create_vendor_from_onboarding(request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  req public.onboarding_requests%ROWTYPE;
  new_vendor_id uuid;
BEGIN
  SELECT * INTO req FROM public.onboarding_requests WHERE id = request_id;

  IF req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding request not found');
  END IF;

  IF req.status NOT IN ('approved', 'conditionally_approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding request must be approved first');
  END IF;

  IF req.created_vendor_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vendor already created from this request');
  END IF;

  IF NOT public.user_can_create_vendors(req.organization_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User does not have permission to create vendors');
  END IF;

  INSERT INTO public.vendors (
    organization_id, onboarding_request_id, legal_name, trading_name, description,
    country, province_state, city, website, number_of_employees, years_in_operation,
    primary_contact_name, primary_contact_email, primary_contact_phone, responsible_officer,
    business_unit, service_category, service_description, provider_type, is_critical,
    status, lifecycle_stage, contract_value_cad, has_system_access, handles_sensitive_data,
    uses_subcontractors, data_location, created_by
  ) VALUES (
    req.organization_id, req.id, req.vendor_legal_name, req.vendor_trading_name, req.vendor_description,
    req.vendor_country, req.vendor_province_state, req.vendor_city, req.vendor_website,
    req.vendor_number_of_employees, req.vendor_years_in_operation,
    req.vendor_primary_contact_name, req.vendor_primary_contact_email, req.vendor_primary_contact_phone,
    req.requesting_business_unit, req.requesting_business_unit,
    req.service_category, req.service_description, req.provider_type, req.is_critical_service,
    'pending_assessment', 'onboarding', req.estimated_contract_value_cad,
    req.has_system_access, req.handles_sensitive_data, req.uses_subcontractors,
    req.data_location, auth.uid()
  )
  RETURNING id INTO new_vendor_id;

  IF req.preliminary_risk_tier IS NOT NULL THEN
    INSERT INTO public.assessment_tasks (
      organization_id, vendor_id, task_type, status, priority, assigned_defense_line,
      due_date, trigger_reason, preliminary_tier, notes
    ) VALUES (
      req.organization_id, new_vendor_id, 'tiering_assessment', 'pending',
      CASE WHEN req.is_critical_service THEN 'high' ELSE 'normal' END,
      '1b', CURRENT_DATE + INTERVAL '14 days',
      'Vendor created from approved onboarding request',
      req.preliminary_risk_tier,
      'Assessment required for vendor: ' || req.vendor_legal_name
    );
  END IF;

  INSERT INTO public.vendor_creation_audit (
    organization_id, attempt_result, vendor_id, vendor_legal_name, onboarding_request_id,
    onboarding_request_status, attempted_by, had_permission, creation_source, source_details
  ) VALUES (
    req.organization_id, 'success', new_vendor_id, req.vendor_legal_name, req.id,
    req.status::text, auth.uid(), true, 'workflow',
    jsonb_build_object('request_number', req.request_number, 'preliminary_tier', req.preliminary_risk_tier)
  );

  RETURN jsonb_build_object(
    'success', true,
    'vendor_id', new_vendor_id,
    'message', 'Vendor created successfully from onboarding request'
  );

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.vendor_creation_audit (
    organization_id, attempt_result, block_reason, error_message, vendor_legal_name,
    onboarding_request_id, attempted_by, creation_source
  ) VALUES (
    req.organization_id, 'error', 'exception', SQLERRM, req.vendor_legal_name,
    req.id, auth.uid(), 'workflow'
  );
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE FUNCTION public.clone_onboarding_request(
  source_request_id uuid,
  new_organization_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_request_id uuid;
  source_request public.onboarding_requests;
BEGIN
  SELECT * INTO source_request
  FROM public.onboarding_requests
  WHERE id = source_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source onboarding request not found';
  END IF;

  INSERT INTO public.onboarding_requests (
    organization_id, vendor_legal_name, vendor_trading_name,
    vendor_country, vendor_city, vendor_province_state, vendor_website,
    vendor_description, service_category, provider_type, requesting_business_unit,
    is_critical_service, estimated_contract_value_cad,
    vendor_primary_contact_name, vendor_primary_contact_email, vendor_primary_contact_phone,
    handles_sensitive_data, has_system_access, uses_subcontractors, business_justification,
    requested_by, status, cloned_from, is_draft
  ) VALUES (
    COALESCE(new_organization_id, source_request.organization_id),
    source_request.vendor_legal_name || ' (Copy)',
    source_request.vendor_trading_name,
    source_request.vendor_country, source_request.vendor_city, source_request.vendor_province_state,
    source_request.vendor_website, source_request.vendor_description,
    source_request.service_category, source_request.provider_type,
    source_request.requesting_business_unit, source_request.is_critical_service,
    source_request.estimated_contract_value_cad,
    source_request.vendor_primary_contact_name,
    source_request.vendor_primary_contact_email,
    source_request.vendor_primary_contact_phone,
    source_request.handles_sensitive_data, source_request.has_system_access,
    source_request.uses_subcontractors, source_request.business_justification,
    auth.uid(), 'draft', source_request_id, true
  )
  RETURNING id INTO new_request_id;

  RETURN new_request_id;
END;
$$;

CREATE FUNCTION public.backfill_legacy_vendors()
RETURNS TABLE(vendor_id uuid, vendor_name text, onboarding_request_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  vendor_record RECORD;
  new_request_id uuid;
  system_user_id uuid;
BEGIN
  SELECT id INTO system_user_id FROM auth.users LIMIT 1;

  FOR vendor_record IN
    SELECT
      v.id, v.legal_name, v.organization_id, v.service_category, v.provider_type,
      v.business_unit, v.is_critical, v.contract_value_cad, v.primary_contact_name,
      v.primary_contact_email, v.primary_contact_phone, v.country, v.city,
      v.province_state, v.website, v.description, v.handles_sensitive_data,
      v.has_system_access, v.uses_subcontractors, v.created_by
    FROM public.vendors v
    WHERE v.onboarding_request_id IS NULL
    ORDER BY v.created_at DESC
  LOOP
    INSERT INTO public.onboarding_requests (
      organization_id, vendor_legal_name, vendor_trading_name,
      vendor_country, vendor_city, vendor_province_state,
      vendor_website, vendor_description, service_category, provider_type,
      requesting_business_unit, is_critical_service, estimated_contract_value_cad,
      vendor_primary_contact_name, vendor_primary_contact_email, vendor_primary_contact_phone,
      handles_sensitive_data, has_system_access, uses_subcontractors,
      business_justification, requested_by, status, is_retrospective, is_draft,
      submitted_at, approved_at
    ) VALUES (
      vendor_record.organization_id,
      vendor_record.legal_name,
      vendor_record.legal_name,
      COALESCE(vendor_record.country, 'Unknown'),
      vendor_record.city, vendor_record.province_state, vendor_record.website,
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
      'Retrospective onboarding request created during system migration.',
      COALESCE(vendor_record.created_by, system_user_id),
      'retrospective_approved', true, false, now(), now()
    ) RETURNING id INTO new_request_id;

    UPDATE public.vendors
    SET onboarding_request_id = new_request_id
    WHERE id = vendor_record.id;

    backfill_legacy_vendors.vendor_id             := vendor_record.id;
    backfill_legacy_vendors.vendor_name           := vendor_record.legal_name;
    backfill_legacy_vendors.onboarding_request_id := new_request_id;
    backfill_legacy_vendors.status                := 'backfilled';

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

CREATE TRIGGER enforce_vendor_governance
  BEFORE INSERT ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_vendor_creation();

CREATE TRIGGER enforce_vendor_assessment
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  WHEN (
    (NEW.status IS DISTINCT FROM OLD.status)
    OR (NEW.lifecycle_stage IS DISTINCT FROM OLD.lifecycle_stage)
  )
  EXECUTE FUNCTION public.validate_vendor_status();

CREATE TRIGGER link_to_onboarding_request
  AFTER INSERT ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.link_vendor_to_onboarding();

CREATE TRIGGER set_onboarding_template_updated_at
  BEFORE UPDATE ON public.onboarding_request_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_onboarding_template_updated_at();

CREATE POLICY "Authorized users can create vendors from approved onboarding"
  ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = ANY (get_user_organization_ids()))
    AND public.user_can_create_vendors(organization_id)
    AND (onboarding_request_id IS NOT NULL)
  );

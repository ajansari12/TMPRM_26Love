/*
  # Fix NOT NULL violation when creating onboarding from template
*/

CREATE OR REPLACE FUNCTION create_onboarding_from_template(
  template_id uuid,
  org_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_request_id uuid;
  template_record onboarding_request_templates;
  template_json jsonb;
BEGIN
  SELECT * INTO template_record
  FROM onboarding_request_templates
  WHERE id = template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  template_json := template_record.template_data;

  INSERT INTO onboarding_requests (
    organization_id,
    vendor_legal_name,
    vendor_trading_name,
    vendor_country,
    vendor_city,
    vendor_province_state,
    vendor_website,
    vendor_description,
    service_category,
    provider_type,
    requesting_business_unit,
    is_critical_service,
    estimated_contract_value_cad,
    handles_sensitive_data,
    has_system_access,
    uses_subcontractors,
    business_justification,
    requested_by,
    status,
    is_draft
  ) VALUES (
    org_id,
    COALESCE(template_json->>'legal_name', ''),
    template_json->>'trading_name',
    template_json->>'country',
    template_json->>'city',
    template_json->>'province_state',
    template_json->>'website',
    template_json->>'description',
    COALESCE(template_json->>'service_category', ''),
    COALESCE(template_json->>'provider_type', ''),
    COALESCE(template_json->>'business_unit', ''),
    COALESCE((template_json->>'is_critical')::boolean, false),
    COALESCE((template_json->>'contract_value_cad')::numeric, 0),
    COALESCE((template_json->>'handles_sensitive_data')::boolean, false),
    COALESCE((template_json->>'has_system_access')::boolean, false),
    COALESCE((template_json->>'uses_subcontractors')::boolean, false),
    template_json->>'business_justification',
    auth.uid(),
    'draft',
    true
  ) RETURNING id INTO new_request_id;

  RETURN new_request_id;
END;
$$;

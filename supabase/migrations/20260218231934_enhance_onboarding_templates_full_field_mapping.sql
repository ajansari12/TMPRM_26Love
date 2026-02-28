/*
  # Enhance Onboarding Templates - Full Field Mapping

  ## Summary
  This migration does two things:

  1. **Expands the `create_onboarding_from_template` RPC function** to map ~60 additional fields
     from template JSON into the new onboarding request, including:
     - Service description, strategic rationale, alternatives considered
     - Contract duration, payment terms, priority
     - Sensitive data types (array), data location, system access description
     - Outsourcing, offshore components flags
     - All 39+ assessment question columns (q15 through q53e)

  2. **Enriches all 6 system templates** with comprehensive pre-filled data so that
     users only need to fill in the specific vendor's name and contact details.
     Each template now pre-answers the full risk assessment with sensible defaults
     appropriate to that vendor category.

  ## Templates Updated
  - Cloud Service Provider    → High risk, critical service, cloud_data_services
  - Consulting Firm           → Moderate risk, legal_audit_consulting
  - Facilities Management     → Low risk, facilities_real_estate
  - Financial Services        → Critical risk, financial_insurance_services
  - IT Services Provider      → Moderate-high risk, it_telecom_services
  - Marketing Agency          → Low-moderate risk, marketing_services

  ## Notes
  - Templates no longer pre-fill vendor identity fields (name, contact) to stay flexible
  - All service_category and provider_type values corrected to match form enum values
  - Assessment answers pre-filled to realistic defaults for each vendor archetype
*/

-- ============================================================
-- STEP 1: Replace the create_onboarding_from_template function
-- with full field mapping
-- ============================================================
CREATE OR REPLACE FUNCTION create_onboarding_from_template(
  template_id uuid,
  org_id uuid,
  vendor_name text DEFAULT NULL
)
RETURNS uuid
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
    -- Vendor identity
    vendor_legal_name,
    vendor_trading_name,
    vendor_country,
    vendor_city,
    vendor_province_state,
    vendor_website,
    vendor_description,
    -- Service classification
    service_category,
    provider_type,
    service_description,
    requesting_business_unit,
    -- Business context
    business_justification,
    strategic_rationale,
    alternatives_considered,
    -- Financial
    estimated_contract_value_cad,
    contract_duration,
    payment_terms,
    -- Risk flags
    is_critical_service,
    supports_essential_operations,
    handles_sensitive_data,
    sensitive_data_types,
    data_location,
    has_system_access,
    system_access_description,
    is_outsourcing,
    outsourcing_type,
    uses_subcontractors,
    offshore_components,
    -- Workflow
    priority,
    -- Assessment: Section 1 - Criticality
    q15_supports_essential_operations,
    q16_essential_to_business,
    q17_failure_impact,
    -- Assessment: Section 2 - Service Classification
    q18_product_service_types,
    q19_service_description,
    q20_service_recipient,
    q21_provider_type,
    -- Assessment: Section 3 - Dependency
    q22_dependency_level,
    -- Assessment: Section 4 - Financial & Operational
    q23_contract_value_cad,
    q24_total_financial_input,
    q25_operational_effort,
    q26_replacement_complexity,
    q27_disruption_downtime,
    q27b_exit_plan_documented,
    q27c_transition_period,
    q27d_data_portability,
    q27e_exit_fees,
    q27f_bcp_documented,
    q27g_bcp_tested,
    q27h_rto_rpo,
    q27i_geographic_redundancy,
    -- Assessment: Section 5 - Reputational
    q28_reputational_impact,
    q29_public_association,
    -- Assessment: Section 6 - Cyber & Data
    q30_has_system_access,
    q31_data_sensitivity,
    q32_cybersecurity_risk,
    q32b_incident_response_plan,
    q32c_notification_period,
    q32d_past_incidents,
    q32e_incident_testing,
    -- Assessment: Section 7 - Concentration
    q33_provider_availability,
    q34_services_relied_on,
    -- Assessment: Section 8 - Access & Location
    q35_data_access_location,
    q36_system_access_level,
    q37_sensitive_data_access,
    -- Assessment: Section 9 - Subcontractors
    q38_uses_subcontractors,
    q39_subcontractor_oversight,
    q40_subcontractor_access,
    -- Assessment: Section 10 - Legal & Regulatory
    q41_regulatory_oversight,
    q42_non_compliance_consequences,
    q43_fraud_misconduct_history,
    q43b_audit_rights,
    q43c_osfi_access,
    q43d_certifications,
    q43e_audit_exercised,
    -- Assessment: Section 11 - Maturity & Viability
    q44_operational_maturity,
    q45_reliability_track_record,
    q45b_financial_stability,
    q45c_ownership_changes,
    q45d_ownership_type,
    q45e_going_concern,
    -- Assessment: Section 12 - Other Risk
    q46_geopolitical_risk,
    q47_negative_coverage,
    q48_esg_concerns,
    q49_child_labor_verification,
    -- Assessment: Section 13 - Contract & Insurance
    q50_has_formal_contract,
    q51_contract_type,
    q52_contract_duration,
    q53_requires_formal_contract,
    q53b_professional_liability,
    q53c_cyber_liability,
    q53d_coverage_adequacy,
    q53e_indemnification,
    -- Metadata
    requested_by,
    status,
    is_draft
  ) VALUES (
    org_id,
    -- Vendor identity
    COALESCE(vendor_name, template_json->>'legal_name', ''),
    template_json->>'trading_name',
    template_json->>'country',
    template_json->>'city',
    template_json->>'province_state',
    template_json->>'website',
    template_json->>'description',
    -- Service classification
    COALESCE(template_json->>'service_category', ''),
    COALESCE(template_json->>'provider_type', ''),
    template_json->>'service_description',
    COALESCE(template_json->>'business_unit', ''),
    -- Business context
    template_json->>'business_justification',
    template_json->>'strategic_rationale',
    template_json->>'alternatives_considered',
    -- Financial
    COALESCE((template_json->>'contract_value_cad')::numeric, 0),
    template_json->>'contract_duration',
    template_json->>'payment_terms',
    -- Risk flags
    COALESCE((template_json->>'is_critical')::boolean, false),
    COALESCE((template_json->>'supports_essential_operations')::boolean, false),
    COALESCE((template_json->>'handles_sensitive_data')::boolean, false),
    CASE
      WHEN template_json->'sensitive_data_types' IS NOT NULL
        AND jsonb_typeof(template_json->'sensitive_data_types') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(template_json->'sensitive_data_types'))
      ELSE NULL
    END,
    template_json->>'data_location',
    COALESCE((template_json->>'has_system_access')::boolean, false),
    template_json->>'system_access_description',
    COALESCE((template_json->>'is_outsourcing')::boolean, false),
    template_json->>'outsourcing_type',
    COALESCE((template_json->>'uses_subcontractors')::boolean, false),
    COALESCE((template_json->>'offshore_components')::boolean, false),
    -- Workflow
    template_json->>'priority',
    -- Assessment: Section 1
    template_json->>'q15_supports_essential_operations',
    template_json->>'q16_essential_to_business',
    template_json->>'q17_failure_impact',
    -- Assessment: Section 2
    CASE
      WHEN template_json->'q18_product_service_types' IS NOT NULL
        AND jsonb_typeof(template_json->'q18_product_service_types') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(template_json->'q18_product_service_types'))
      ELSE NULL
    END,
    template_json->>'q19_service_description',
    template_json->>'q20_service_recipient',
    template_json->>'q21_provider_type',
    -- Assessment: Section 3
    template_json->>'q22_dependency_level',
    -- Assessment: Section 4
    (template_json->>'q23_contract_value_cad')::numeric,
    template_json->>'q24_total_financial_input',
    template_json->>'q25_operational_effort',
    template_json->>'q26_replacement_complexity',
    template_json->>'q27_disruption_downtime',
    template_json->>'q27b_exit_plan_documented',
    template_json->>'q27c_transition_period',
    template_json->>'q27d_data_portability',
    template_json->>'q27e_exit_fees',
    template_json->>'q27f_bcp_documented',
    template_json->>'q27g_bcp_tested',
    template_json->>'q27h_rto_rpo',
    template_json->>'q27i_geographic_redundancy',
    -- Assessment: Section 5
    template_json->>'q28_reputational_impact',
    template_json->>'q29_public_association',
    -- Assessment: Section 6
    (template_json->>'q30_has_system_access')::boolean,
    template_json->>'q31_data_sensitivity',
    template_json->>'q32_cybersecurity_risk',
    template_json->>'q32b_incident_response_plan',
    template_json->>'q32c_notification_period',
    template_json->>'q32d_past_incidents',
    template_json->>'q32e_incident_testing',
    -- Assessment: Section 7
    template_json->>'q33_provider_availability',
    template_json->>'q34_services_relied_on',
    -- Assessment: Section 8
    template_json->>'q35_data_access_location',
    template_json->>'q36_system_access_level',
    template_json->>'q37_sensitive_data_access',
    -- Assessment: Section 9
    (template_json->>'q38_uses_subcontractors')::boolean,
    template_json->>'q39_subcontractor_oversight',
    template_json->>'q40_subcontractor_access',
    -- Assessment: Section 10
    template_json->>'q41_regulatory_oversight',
    template_json->>'q42_non_compliance_consequences',
    template_json->>'q43_fraud_misconduct_history',
    template_json->>'q43b_audit_rights',
    template_json->>'q43c_osfi_access',
    CASE
      WHEN template_json->'q43d_certifications' IS NOT NULL
        AND jsonb_typeof(template_json->'q43d_certifications') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(template_json->'q43d_certifications'))
      ELSE NULL
    END,
    template_json->>'q43e_audit_exercised',
    -- Assessment: Section 11
    template_json->>'q44_operational_maturity',
    template_json->>'q45_reliability_track_record',
    template_json->>'q45b_financial_stability',
    template_json->>'q45c_ownership_changes',
    template_json->>'q45d_ownership_type',
    template_json->>'q45e_going_concern',
    -- Assessment: Section 12
    template_json->>'q46_geopolitical_risk',
    template_json->>'q47_negative_coverage',
    template_json->>'q48_esg_concerns',
    template_json->>'q49_child_labor_verification',
    -- Assessment: Section 13
    (template_json->>'q50_has_formal_contract')::boolean,
    template_json->>'q51_contract_type',
    template_json->>'q52_contract_duration',
    (template_json->>'q53_requires_formal_contract')::boolean,
    template_json->>'q53b_professional_liability',
    template_json->>'q53c_cyber_liability',
    template_json->>'q53d_coverage_adequacy',
    template_json->>'q53e_indemnification',
    -- Metadata
    auth.uid(),
    'draft',
    true
  ) RETURNING id INTO new_request_id;

  RETURN new_request_id;
END;
$$;

-- ============================================================
-- STEP 2: Enrich all 6 templates with comprehensive pre-fills
-- ============================================================

-- Template 1: Cloud Service Provider
UPDATE onboarding_request_templates
SET
  description = 'Template for cloud infrastructure, SaaS platforms, and managed cloud services',
  template_data = '{
    "description": "Cloud infrastructure, hosting, storage, and SaaS application services",
    "service_category": "cloud_data_services",
    "provider_type": "tpsp_outsourced_external",
    "business_unit": "technology",
    "is_critical": true,
    "contract_value_cad": 500000,
    "contract_duration": "3_years",
    "payment_terms": "Net 30",
    "handles_sensitive_data": true,
    "sensitive_data_types": ["pii", "financial", "credentials", "proprietary"],
    "data_location": "Canada and United States (multi-region cloud infrastructure)",
    "has_system_access": true,
    "system_access_description": "API access, administrative console access, and network connectivity to cloud-hosted environments",
    "uses_subcontractors": true,
    "is_outsourcing": true,
    "outsourcing_type": "Technology infrastructure outsourcing",
    "offshore_components": true,
    "supports_essential_operations": true,
    "priority": "high",
    "business_justification": "Cloud infrastructure is essential for hosting core banking applications, data storage, and digital banking services. Without this provider, critical customer-facing systems and internal operations would be severely impacted.",
    "service_description": "Provision of cloud computing infrastructure (IaaS), platform services (PaaS), and software-as-a-service (SaaS) applications. Includes managed hosting, data storage, disaster recovery, and network services.",
    "strategic_rationale": "Cloud adoption enables scalability, cost efficiency, and operational resilience. This vendor provides foundational infrastructure supporting our digital transformation strategy and regulatory requirements for business continuity.",
    "alternatives_considered": "On-premise infrastructure (higher capital cost, limited scalability), alternative cloud providers (evaluated for pricing, compliance capabilities, and Canadian data residency support).",
    "q15_supports_essential_operations": "yes_critical",
    "q16_essential_to_business": "4_very_important",
    "q17_failure_impact": "4_major",
    "q18_product_service_types": ["it_infrastructure", "software", "data_processing"],
    "q19_service_description": "Cloud infrastructure, managed hosting, data storage, and SaaS application delivery",
    "q20_service_recipient": "both",
    "q21_provider_type": "tpsp_outsourced_external",
    "q22_dependency_level": "4_limited",
    "q23_contract_value_cad": 500000,
    "q24_total_financial_input": "3_1_to_2",
    "q25_operational_effort": "3_significant",
    "q26_replacement_complexity": "4_very",
    "q27_disruption_downtime": "4_hour",
    "q27b_exit_plan_documented": "documented",
    "q27c_transition_period": "3_to_6_months",
    "q27d_data_portability": "mostly_portable",
    "q27e_exit_fees": "reasonable_fees",
    "q27f_bcp_documented": "documented",
    "q27g_bcp_tested": "tested",
    "q27h_rto_rpo": "rto_4hr_rpo_1hr",
    "q27i_geographic_redundancy": "multi_region",
    "q28_reputational_impact": "3_moderate",
    "q29_public_association": "3_visible",
    "q30_has_system_access": true,
    "q31_data_sensitivity": "4_sensitive",
    "q32_cybersecurity_risk": "4_high",
    "q32b_incident_response_plan": "documented",
    "q32c_notification_period": "24_hours",
    "q32d_past_incidents": "no_incidents",
    "q32e_incident_testing": "annual",
    "q33_provider_availability": "3_limited",
    "q34_services_relied_on": "3_several",
    "q35_data_access_location": "4_multiple",
    "q36_system_access_level": "4_read_write",
    "q37_sensitive_data_access": "4_limited",
    "q38_uses_subcontractors": true,
    "q39_subcontractor_oversight": "3_moderate",
    "q40_subcontractor_access": "3_indirect",
    "q41_regulatory_oversight": "2_provincial",
    "q42_non_compliance_consequences": "4_major",
    "q43_fraud_misconduct_history": "1_none",
    "q43b_audit_rights": "limited",
    "q43c_osfi_access": "general",
    "q43d_certifications": ["soc2_type2", "iso27001"],
    "q43e_audit_exercised": "not_exercised",
    "q44_operational_maturity": "1_mature",
    "q45_reliability_track_record": "1_excellent",
    "q45b_financial_stability": "investment_grade",
    "q45c_ownership_changes": "no_changes",
    "q45d_ownership_type": "public",
    "q45e_going_concern": "no_concerns",
    "q46_geopolitical_risk": "3_moderate",
    "q47_negative_coverage": "2_minor",
    "q48_esg_concerns": "2_minor",
    "q49_child_labor_verification": "1_na",
    "q50_has_formal_contract": true,
    "q51_contract_type": "msa",
    "q52_contract_duration": "3_to_5_years",
    "q53_requires_formal_contract": true,
    "q53b_professional_liability": "adequate",
    "q53c_cyber_liability": "adequate",
    "q53d_coverage_adequacy": "adequate",
    "q53e_indemnification": "standard"
  }'::jsonb
WHERE name = 'Cloud Service Provider';

-- Template 2: Consulting Firm
UPDATE onboarding_request_templates
SET
  description = 'Template for professional services, advisory, and consulting engagements',
  template_data = '{
    "description": "Professional advisory, audit, and consulting services",
    "service_category": "legal_audit_consulting",
    "provider_type": "tpsp_other_providers",
    "business_unit": "legal_compliance",
    "is_critical": false,
    "contract_value_cad": 150000,
    "contract_duration": "1_year",
    "payment_terms": "Net 30",
    "handles_sensitive_data": true,
    "sensitive_data_types": ["pii", "proprietary", "regulatory"],
    "data_location": "Canada (on-site engagement with restricted data room access)",
    "has_system_access": false,
    "uses_subcontractors": false,
    "is_outsourcing": false,
    "offshore_components": false,
    "supports_essential_operations": false,
    "priority": "medium",
    "business_justification": "External consulting expertise is required for regulatory advisory, internal audits, or strategic assessments that cannot be performed with current internal resources.",
    "service_description": "Professional consulting, advisory services, or audit support including regulatory compliance advice, risk assessments, process reviews, and subject matter expertise.",
    "strategic_rationale": "Access to specialized expertise and independent perspectives that complement internal capabilities. Provides regulatory insight and supports compliance obligations that require external validation.",
    "alternatives_considered": "Internal resources (insufficient capacity or expertise for this engagement), alternative consulting firms (evaluated for sector expertise, cost, and relevant credentials).",
    "q15_supports_essential_operations": "yes_important",
    "q16_essential_to_business": "3_important",
    "q17_failure_impact": "2_minor",
    "q18_product_service_types": ["professional_services"],
    "q19_service_description": "Professional advisory, regulatory consulting, and audit support services",
    "q20_service_recipient": "internal",
    "q21_provider_type": "tpsp_other_providers",
    "q22_dependency_level": "2_many",
    "q23_contract_value_cad": 150000,
    "q24_total_financial_input": "1_under_half",
    "q25_operational_effort": "2_moderate",
    "q26_replacement_complexity": "2_somewhat",
    "q27_disruption_downtime": "2_24hours",
    "q27b_exit_plan_documented": "informal",
    "q27c_transition_period": "30_to_90_days",
    "q27d_data_portability": "fully_portable",
    "q27e_exit_fees": "no_restrictions",
    "q27f_bcp_documented": "basic",
    "q27g_bcp_tested": "not_tested",
    "q27h_rto_rpo": "rto_72hr_rpo_24hr",
    "q27i_geographic_redundancy": "backup_only",
    "q28_reputational_impact": "2_minor",
    "q29_public_association": "1_internal",
    "q30_has_system_access": false,
    "q31_data_sensitivity": "3_internal",
    "q32_cybersecurity_risk": "2_low",
    "q32b_incident_response_plan": "basic",
    "q32c_notification_period": "72_hours",
    "q32d_past_incidents": "no_incidents",
    "q32e_incident_testing": "none",
    "q33_provider_availability": "1_many",
    "q34_services_relied_on": "2_few",
    "q35_data_access_location": "1_canada",
    "q36_system_access_level": "1_none",
    "q37_sensitive_data_access": "2_aggregated",
    "q38_uses_subcontractors": false,
    "q41_regulatory_oversight": "2_provincial",
    "q42_non_compliance_consequences": "3_moderate",
    "q43_fraud_misconduct_history": "1_none",
    "q43b_audit_rights": "limited",
    "q43c_osfi_access": "general",
    "q43d_certifications": ["iso27001"],
    "q43e_audit_exercised": "not_applicable",
    "q44_operational_maturity": "2_established",
    "q45_reliability_track_record": "2_good",
    "q45b_financial_stability": "stable",
    "q45c_ownership_changes": "no_changes",
    "q45d_ownership_type": "private_transparent",
    "q45e_going_concern": "no_concerns",
    "q46_geopolitical_risk": "1_low",
    "q47_negative_coverage": "1_none",
    "q48_esg_concerns": "1_none",
    "q49_child_labor_verification": "1_na",
    "q50_has_formal_contract": true,
    "q51_contract_type": "sow",
    "q52_contract_duration": "less_than_year",
    "q53_requires_formal_contract": true,
    "q53b_professional_liability": "adequate",
    "q53c_cyber_liability": "exists",
    "q53d_coverage_adequacy": "adequate",
    "q53e_indemnification": "standard"
  }'::jsonb
WHERE name = 'Consulting Firm';

-- Template 3: Facilities Management
UPDATE onboarding_request_templates
SET
  description = 'Template for facilities maintenance, property management, and building operations vendors',
  template_data = '{
    "description": "Facilities maintenance, property management, and building operations services",
    "service_category": "facilities_real_estate",
    "provider_type": "tpsp_other_providers",
    "business_unit": "branch_operations",
    "is_critical": false,
    "contract_value_cad": 200000,
    "contract_duration": "2_years",
    "payment_terms": "Net 30",
    "handles_sensitive_data": false,
    "has_system_access": false,
    "uses_subcontractors": true,
    "is_outsourcing": false,
    "offshore_components": false,
    "supports_essential_operations": false,
    "priority": "low",
    "business_justification": "Facilities management services are required to maintain safe, clean, and operational physical premises including branch offices and administrative buildings in compliance with health, safety, and regulatory standards.",
    "service_description": "Comprehensive facilities management including janitorial services, HVAC maintenance, security systems maintenance, grounds keeping, minor renovations, and property management.",
    "strategic_rationale": "Outsourcing facilities management allows internal teams to focus on core banking operations while ensuring properties are maintained to regulatory and operational standards with consistent service levels.",
    "alternatives_considered": "In-house facilities team (higher fixed costs, difficulty scaling across locations), multiple specialized contractors (coordination complexity), alternative facilities management companies.",
    "q15_supports_essential_operations": "no",
    "q16_essential_to_business": "2_supportive",
    "q17_failure_impact": "1_minimal",
    "q18_product_service_types": ["facilities"],
    "q19_service_description": "Physical facilities management, building maintenance, and property services",
    "q20_service_recipient": "internal",
    "q21_provider_type": "tpsp_other_providers",
    "q22_dependency_level": "2_many",
    "q23_contract_value_cad": 200000,
    "q24_total_financial_input": "1_under_half",
    "q25_operational_effort": "1_minimal",
    "q26_replacement_complexity": "1_simple",
    "q27_disruption_downtime": "1_day",
    "q27b_exit_plan_documented": "informal",
    "q27c_transition_period": "30_to_90_days",
    "q27d_data_portability": "fully_portable",
    "q27e_exit_fees": "no_restrictions",
    "q27f_bcp_documented": "basic",
    "q27g_bcp_tested": "not_tested",
    "q27h_rto_rpo": "not_defined",
    "q27i_geographic_redundancy": "none",
    "q28_reputational_impact": "1_minimal",
    "q29_public_association": "1_internal",
    "q30_has_system_access": false,
    "q32_cybersecurity_risk": "1_minimal",
    "q32b_incident_response_plan": "none",
    "q32c_notification_period": "not_defined",
    "q32d_past_incidents": "no_incidents",
    "q32e_incident_testing": "none",
    "q33_provider_availability": "1_many",
    "q34_services_relied_on": "1_single",
    "q35_data_access_location": "1_canada",
    "q36_system_access_level": "1_none",
    "q37_sensitive_data_access": "1_none",
    "q38_uses_subcontractors": true,
    "q39_subcontractor_oversight": "3_moderate",
    "q40_subcontractor_access": "1_none",
    "q41_regulatory_oversight": "4_none",
    "q42_non_compliance_consequences": "1_minimal",
    "q43_fraud_misconduct_history": "1_none",
    "q43b_audit_rights": "limited",
    "q43c_osfi_access": "none",
    "q43d_certifications": [],
    "q43e_audit_exercised": "not_applicable",
    "q44_operational_maturity": "2_established",
    "q45_reliability_track_record": "2_good",
    "q45b_financial_stability": "stable",
    "q45c_ownership_changes": "no_changes",
    "q45d_ownership_type": "private_transparent",
    "q45e_going_concern": "no_concerns",
    "q46_geopolitical_risk": "1_low",
    "q47_negative_coverage": "1_none",
    "q48_esg_concerns": "2_minor",
    "q49_child_labor_verification": "1_na",
    "q50_has_formal_contract": true,
    "q51_contract_type": "sow",
    "q52_contract_duration": "1_to_3_years",
    "q53_requires_formal_contract": true,
    "q53b_professional_liability": "adequate",
    "q53c_cyber_liability": "none",
    "q53d_coverage_adequacy": "adequate",
    "q53e_indemnification": "standard"
  }'::jsonb
WHERE name = 'Facilities Management';

-- Template 4: Financial Services
UPDATE onboarding_request_templates
SET
  description = 'Template for financial institutions, payment processors, and regulated financial service providers',
  template_data = '{
    "description": "Financial services including payment processing, clearing, settlement, or financial institution services",
    "service_category": "financial_insurance_services",
    "provider_type": "tpsp_outsourced_external",
    "business_unit": "financial_controls",
    "is_critical": true,
    "contract_value_cad": 1000000,
    "contract_duration": "3_years",
    "payment_terms": "Net 30",
    "handles_sensitive_data": true,
    "sensitive_data_types": ["pii", "financial"],
    "data_location": "Canada (primary), United States (backup/DR only)",
    "has_system_access": true,
    "system_access_description": "Direct integration with core banking systems, payment networks, and financial reporting platforms via secure API and dedicated encrypted network connections",
    "uses_subcontractors": false,
    "is_outsourcing": true,
    "outsourcing_type": "Critical financial processing outsourcing",
    "offshore_components": false,
    "supports_essential_operations": true,
    "priority": "critical",
    "business_justification": "Critical financial processing capabilities are required for payment clearing, settlement, or financial services that cannot be performed internally. This provider enables core financial operations that directly support customer and regulatory obligations.",
    "service_description": "Financial processing services including payment clearing, fund settlement, transaction processing, financial data services, or insurance underwriting support. Directly integrated with core banking operations.",
    "strategic_rationale": "Partnership with a regulated financial services provider enables access to payment networks and financial infrastructure that would be prohibitively expensive to replicate internally. Essential for meeting regulatory payment obligations and customer service commitments.",
    "alternatives_considered": "Alternative financial services providers (evaluated for regulatory standing, network membership, pricing, and integration capability), in-house processing (not viable given payment network access requirements).",
    "q15_supports_essential_operations": "yes_disruption_stops_operations",
    "q16_essential_to_business": "5_essential",
    "q17_failure_impact": "5_severe",
    "q18_product_service_types": ["payment_processing", "data_processing"],
    "q19_service_description": "Payment clearing, settlement, and financial transaction processing services",
    "q20_service_recipient": "customers",
    "q21_provider_type": "tpsp_outsourced_external",
    "q22_dependency_level": "5_sole_source",
    "q23_contract_value_cad": 1000000,
    "q24_total_financial_input": "4_2_to_5",
    "q25_operational_effort": "4_extensive",
    "q26_replacement_complexity": "5_extremely",
    "q27_disruption_downtime": "5_zero",
    "q27b_exit_plan_documented": "documented",
    "q27c_transition_period": "6_to_12_months",
    "q27d_data_portability": "mostly_portable",
    "q27e_exit_fees": "significant_fees",
    "q27f_bcp_documented": "comprehensive",
    "q27g_bcp_tested": "tested_documented",
    "q27h_rto_rpo": "rto_1hr_rpo_0",
    "q27i_geographic_redundancy": "multi_region",
    "q28_reputational_impact": "5_severe",
    "q29_public_association": "5_cobranded",
    "q30_has_system_access": true,
    "q31_data_sensitivity": "5_highly_sensitive",
    "q32_cybersecurity_risk": "5_critical",
    "q32b_incident_response_plan": "comprehensive",
    "q32c_notification_period": "immediate",
    "q32d_past_incidents": "no_incidents",
    "q32e_incident_testing": "regular_joint",
    "q33_provider_availability": "4_very_few",
    "q34_services_relied_on": "4_majority",
    "q35_data_access_location": "2_foreign_equivalent",
    "q36_system_access_level": "4_read_write",
    "q37_sensitive_data_access": "5_full",
    "q38_uses_subcontractors": false,
    "q41_regulatory_oversight": "1_federal",
    "q42_non_compliance_consequences": "5_severe",
    "q43_fraud_misconduct_history": "1_none",
    "q43b_audit_rights": "comprehensive",
    "q43c_osfi_access": "explicit",
    "q43d_certifications": ["soc1_type2", "soc2_type2", "pci_dss"],
    "q43e_audit_exercised": "yes_findings_resolved",
    "q44_operational_maturity": "1_mature",
    "q45_reliability_track_record": "1_excellent",
    "q45b_financial_stability": "investment_grade",
    "q45c_ownership_changes": "no_changes",
    "q45d_ownership_type": "public",
    "q45e_going_concern": "no_concerns",
    "q46_geopolitical_risk": "1_low",
    "q47_negative_coverage": "1_none",
    "q48_esg_concerns": "1_none",
    "q49_child_labor_verification": "1_na",
    "q50_has_formal_contract": true,
    "q51_contract_type": "msa",
    "q52_contract_duration": "3_to_5_years",
    "q53_requires_formal_contract": true,
    "q53b_professional_liability": "adequate",
    "q53c_cyber_liability": "adequate",
    "q53d_coverage_adequacy": "exceeds",
    "q53e_indemnification": "comprehensive"
  }'::jsonb
WHERE name = 'Financial Services';

-- Template 5: IT Services Provider
UPDATE onboarding_request_templates
SET
  description = 'Template for IT service providers, software vendors, managed services, and technology companies',
  template_data = '{
    "description": "IT services, software development, managed IT services, or technology support",
    "service_category": "it_telecom_services",
    "provider_type": "tpsp_outsourced_external",
    "business_unit": "technology",
    "is_critical": false,
    "contract_value_cad": 300000,
    "contract_duration": "2_years",
    "payment_terms": "Net 30",
    "handles_sensitive_data": true,
    "sensitive_data_types": ["credentials", "proprietary", "pii"],
    "data_location": "Canada (primary operations), offshore development access restricted to non-production environments",
    "has_system_access": true,
    "system_access_description": "Access to development, test, and production environments including code repository access, system administration rights for managed services, and network access via VPN",
    "uses_subcontractors": false,
    "is_outsourcing": true,
    "outsourcing_type": "IT services and managed technology outsourcing",
    "offshore_components": true,
    "supports_essential_operations": false,
    "priority": "high",
    "business_justification": "IT services are required to maintain, develop, and support technology systems that underpin banking operations. External expertise is needed for specialized development, managed services, or capacity augmentation.",
    "service_description": "Information technology services including software development, application maintenance, managed IT services, cybersecurity services, network management, or IT support and helpdesk.",
    "strategic_rationale": "Technology services partnerships enable access to specialized technical skills, accelerate delivery timelines, and provide managed operations capability critical for maintaining competitive technology infrastructure.",
    "alternatives_considered": "In-house development team expansion (longer hiring timeline, higher fixed costs), alternative IT service providers (evaluated for technical capability, security certifications, and banking sector experience).",
    "q15_supports_essential_operations": "yes_important",
    "q16_essential_to_business": "3_important",
    "q17_failure_impact": "3_moderate",
    "q18_product_service_types": ["it_infrastructure", "software", "professional_services"],
    "q19_service_description": "IT managed services, software development, and technology support",
    "q20_service_recipient": "internal",
    "q21_provider_type": "tpsp_outsourced_external",
    "q22_dependency_level": "3_moderate",
    "q23_contract_value_cad": 300000,
    "q24_total_financial_input": "2_half_to_1",
    "q25_operational_effort": "3_significant",
    "q26_replacement_complexity": "3_moderately",
    "q27_disruption_downtime": "3_4hours",
    "q27b_exit_plan_documented": "documented",
    "q27c_transition_period": "3_to_6_months",
    "q27d_data_portability": "mostly_portable",
    "q27e_exit_fees": "reasonable_fees",
    "q27f_bcp_documented": "documented",
    "q27g_bcp_tested": "planned",
    "q27h_rto_rpo": "rto_24hr_rpo_4hr",
    "q27i_geographic_redundancy": "dr_site",
    "q28_reputational_impact": "2_minor",
    "q29_public_association": "1_internal",
    "q30_has_system_access": true,
    "q31_data_sensitivity": "4_sensitive",
    "q32_cybersecurity_risk": "4_high",
    "q32b_incident_response_plan": "documented",
    "q32c_notification_period": "24_hours",
    "q32d_past_incidents": "minor_handled",
    "q32e_incident_testing": "annual",
    "q33_provider_availability": "2_several",
    "q34_services_relied_on": "2_few",
    "q35_data_access_location": "4_multiple",
    "q36_system_access_level": "4_read_write",
    "q37_sensitive_data_access": "4_limited",
    "q38_uses_subcontractors": false,
    "q41_regulatory_oversight": "3_limited",
    "q42_non_compliance_consequences": "3_moderate",
    "q43_fraud_misconduct_history": "1_none",
    "q43b_audit_rights": "limited",
    "q43c_osfi_access": "general",
    "q43d_certifications": ["iso27001", "soc2_type2"],
    "q43e_audit_exercised": "not_exercised",
    "q44_operational_maturity": "2_established",
    "q45_reliability_track_record": "2_good",
    "q45b_financial_stability": "stable",
    "q45c_ownership_changes": "no_changes",
    "q45d_ownership_type": "private_transparent",
    "q45e_going_concern": "no_concerns",
    "q46_geopolitical_risk": "3_moderate",
    "q47_negative_coverage": "1_none",
    "q48_esg_concerns": "1_none",
    "q49_child_labor_verification": "1_na",
    "q50_has_formal_contract": true,
    "q51_contract_type": "msa",
    "q52_contract_duration": "1_to_3_years",
    "q53_requires_formal_contract": true,
    "q53b_professional_liability": "adequate",
    "q53c_cyber_liability": "adequate",
    "q53d_coverage_adequacy": "adequate",
    "q53e_indemnification": "standard"
  }'::jsonb
WHERE name = 'IT Services Provider';

-- Template 6: Marketing Agency
UPDATE onboarding_request_templates
SET
  description = 'Template for marketing agencies, advertising firms, and communications service providers',
  template_data = '{
    "description": "Marketing, advertising, and communications services",
    "service_category": "marketing_services",
    "provider_type": "tpsp_other_providers",
    "business_unit": "business_development_marketing",
    "is_critical": false,
    "contract_value_cad": 100000,
    "contract_duration": "1_year",
    "payment_terms": "Net 30",
    "handles_sensitive_data": true,
    "sensitive_data_types": ["pii"],
    "data_location": "Canada (customer data handled under data processing agreement with strict retention limits)",
    "has_system_access": false,
    "uses_subcontractors": true,
    "is_outsourcing": false,
    "offshore_components": false,
    "supports_essential_operations": false,
    "priority": "low",
    "business_justification": "Marketing and advertising services are required for brand promotion, customer acquisition campaigns, and communications. External agency expertise is needed for specialized creative, media buying, and digital marketing capabilities.",
    "service_description": "Marketing and advertising services including campaign strategy, creative development, digital marketing, media planning and buying, content creation, brand management, and marketing analytics.",
    "strategic_rationale": "External marketing agency provides specialized creative expertise, media relationships, and campaign management capabilities that complement internal resources and support business growth objectives.",
    "alternatives_considered": "Expanded internal marketing team (higher fixed costs, limited creative specialization), alternative marketing agencies (evaluated for sector experience, digital capabilities, and data privacy practices).",
    "q15_supports_essential_operations": "no",
    "q16_essential_to_business": "2_supportive",
    "q17_failure_impact": "1_minimal",
    "q18_product_service_types": ["marketing"],
    "q19_service_description": "Marketing campaigns, advertising, creative services, and digital marketing",
    "q20_service_recipient": "customers",
    "q21_provider_type": "tpsp_other_providers",
    "q22_dependency_level": "1_abundant",
    "q23_contract_value_cad": 100000,
    "q24_total_financial_input": "1_under_half",
    "q25_operational_effort": "1_minimal",
    "q26_replacement_complexity": "1_simple",
    "q27_disruption_downtime": "1_day",
    "q27b_exit_plan_documented": "informal",
    "q27c_transition_period": "under_30_days",
    "q27d_data_portability": "fully_portable",
    "q27e_exit_fees": "no_restrictions",
    "q27f_bcp_documented": "none",
    "q27g_bcp_tested": "not_tested",
    "q27h_rto_rpo": "not_defined",
    "q27i_geographic_redundancy": "none",
    "q28_reputational_impact": "3_moderate",
    "q29_public_association": "5_cobranded",
    "q30_has_system_access": false,
    "q31_data_sensitivity": "3_internal",
    "q32_cybersecurity_risk": "2_low",
    "q32b_incident_response_plan": "basic",
    "q32c_notification_period": "72_hours",
    "q32d_past_incidents": "no_incidents",
    "q32e_incident_testing": "none",
    "q33_provider_availability": "1_many",
    "q34_services_relied_on": "1_single",
    "q35_data_access_location": "1_canada",
    "q36_system_access_level": "1_none",
    "q37_sensitive_data_access": "2_aggregated",
    "q38_uses_subcontractors": true,
    "q39_subcontractor_oversight": "3_moderate",
    "q40_subcontractor_access": "1_none",
    "q41_regulatory_oversight": "4_none",
    "q42_non_compliance_consequences": "3_moderate",
    "q43_fraud_misconduct_history": "1_none",
    "q43b_audit_rights": "none",
    "q43c_osfi_access": "none",
    "q43d_certifications": [],
    "q43e_audit_exercised": "not_applicable",
    "q44_operational_maturity": "2_established",
    "q45_reliability_track_record": "2_good",
    "q45b_financial_stability": "stable",
    "q45c_ownership_changes": "no_changes",
    "q45d_ownership_type": "private_transparent",
    "q45e_going_concern": "no_concerns",
    "q46_geopolitical_risk": "1_low",
    "q47_negative_coverage": "1_none",
    "q48_esg_concerns": "1_none",
    "q49_child_labor_verification": "1_na",
    "q50_has_formal_contract": true,
    "q51_contract_type": "sow",
    "q52_contract_duration": "less_than_year",
    "q53_requires_formal_contract": true,
    "q53b_professional_liability": "exists",
    "q53c_cyber_liability": "basic",
    "q53d_coverage_adequacy": "adequate",
    "q53e_indemnification": "standard"
  }'::jsonb
WHERE name = 'Marketing Agency';

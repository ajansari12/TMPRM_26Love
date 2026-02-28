import { ProfileQuestionConfig, VendorArchetype } from './vendorProfiles';

export interface AssessmentQuestion {
  id: string;
  text: string;
  helpText?: string;
  type: 'radio' | 'checkbox' | 'text' | 'textarea' | 'number' | 'boolean';
  options?: Array<{
    value: string;
    label: string;
    score?: number;
  }>;
  conditional?: {
    dependsOn: string;
    showWhen: unknown;
  };
  profileConfig?: ProfileQuestionConfig;
  osfiReference?: string;
  riskCategory?: string;
}

export interface AssessmentSection {
  id: string;
  title: string;
  description: string;
  osfiSection?: string;
  questions: AssessmentQuestion[];
}

export const assessmentSections: AssessmentSection[] = [
  {
    id: 'section1',
    title: 'Section 1: Criticality Assessment',
    description: 'Evaluate the criticality of the third party to your operations',
    osfiSection: 'B-10 Section 3.2 - Criticality Assessment',
    questions: [
      {
        id: 'q15_supports_essential_operations',
        text: 'Q15. Does the third party support essential operations or critical business activities?',
        helpText: 'Consider whether the service is fundamental to core banking operations',
        type: 'radio',
        riskCategory: 'criticality',
        osfiReference: 'B-10 3.2.1',
        options: [
          { value: 'yes_disruption_stops_operations', label: 'Yes - Disruption would stop core operations', score: 5 },
          { value: 'yes_critical', label: 'Yes - Critical to operations', score: 4 },
          { value: 'yes_important', label: 'Yes - Important but not critical', score: 3 },
          { value: 'no', label: 'No - Supports non-critical activities', score: 1 },
        ],
      },
      {
        id: 'q16_essential_to_business',
        text: 'Q16. Is the third party essential to a specific business line or service offering?',
        type: 'radio',
        riskCategory: 'criticality',
        osfiReference: 'B-10 3.2.2',
        options: [
          { value: '5_essential', label: 'Essential and irreplaceable', score: 5 },
          { value: '4_very_important', label: 'Very important to operations', score: 4 },
          { value: '3_important', label: 'Important but replaceable', score: 3 },
          { value: '2_supportive', label: 'Supportive role', score: 2 },
          { value: '1_not_essential', label: 'Not essential', score: 1 },
        ],
      },
      {
        id: 'q17_failure_impact',
        text: 'Q17. What would be the impact if this third party failed to deliver services?',
        helpText: 'Consider operational, financial, and reputational impacts',
        type: 'radio',
        riskCategory: 'criticality',
        osfiReference: 'B-10 3.2.3',
        options: [
          { value: '5_severe', label: 'Severe - Immediate operational disruption', score: 5 },
          { value: '4_major', label: 'Major - Significant disruption within hours', score: 4 },
          { value: '3_moderate', label: 'Moderate - Disruption within days', score: 3 },
          { value: '2_minor', label: 'Minor - Limited disruption', score: 2 },
          { value: '1_minimal', label: 'Minimal - Negligible impact', score: 1 },
        ],
      },
    ],
  },
  {
    id: 'section2',
    title: 'Section 2: Service Classification',
    description: 'Categorize the type of service provided',
    osfiSection: 'B-10 Section 3.1 - Identification',
    questions: [
      {
        id: 'q18_product_service_types',
        text: 'Q18. What type(s) of product or service does the third party provide?',
        type: 'checkbox',
        riskCategory: 'classification',
        options: [
          { value: 'it_infrastructure', label: 'IT Infrastructure & Cloud Services' },
          { value: 'software', label: 'Software Applications' },
          { value: 'data_processing', label: 'Data Processing & Analytics' },
          { value: 'payment_processing', label: 'Payment Processing' },
          { value: 'custody_clearing', label: 'Custody & Clearing Services' },
          { value: 'professional_services', label: 'Professional Services (Legal, Audit, Consulting)' },
          { value: 'marketing', label: 'Marketing & Customer Acquisition' },
          { value: 'facilities', label: 'Facilities & Physical Security' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        id: 'q19_service_description',
        text: 'Q19. Provide a brief description of the service',
        type: 'textarea',
        riskCategory: 'classification',
      },
      {
        id: 'q20_service_recipient',
        text: 'Q20. Who is the primary recipient of the service?',
        type: 'radio',
        riskCategory: 'classification',
        options: [
          { value: 'customers', label: 'External customers' },
          { value: 'internal', label: 'Internal business units' },
          { value: 'both', label: 'Both external and internal' },
        ],
      },
      {
        id: 'q21_provider_type',
        text: 'Q21. What type of third-party service provider (TPSP) is this?',
        helpText: 'Classify based on OSFI B-10 TPSP categories. Outsourcing arrangements require enhanced due diligence.',
        type: 'radio',
        riskCategory: 'classification',
        osfiReference: 'B-10 2.1',
        options: [
          { value: 'tpsp_outsourced_group', label: 'Outsourced - Intra-Group (services from parent or affiliated entities)', score: 3 },
          { value: 'tpsp_outsourced_external', label: 'Outsourced - External (activities performed by unrelated third party)', score: 5 },
          { value: 'tpsp_other_providers', label: 'Other Service Providers (non-outsourcing service relationships)', score: 2 },
          { value: 'tpsp_vendor', label: 'Vendor (product suppliers, software licenses, equipment)', score: 1 },
          { value: 'tpsp_business_partner', label: 'Business Partner (strategic partnerships, joint ventures)', score: 4 },
        ],
      },
    ],
  },
  {
    id: 'section3',
    title: 'Section 3: Dependency Level',
    description: 'Assess the level of dependency on this third party',
    osfiSection: 'B-10 Section 3.3 - Dependency Assessment',
    questions: [
      {
        id: 'q22_dependency_level',
        text: 'Q22. How dependent is your organization on this third party?',
        helpText: 'Consider ease of replacement and availability of alternatives',
        type: 'radio',
        riskCategory: 'dependency',
        osfiReference: 'B-10 3.3.1',
        options: [
          { value: '5_sole_source', label: 'Sole source - No viable alternatives', score: 5 },
          { value: '4_limited', label: 'Limited alternatives - Difficult to replace', score: 4 },
          { value: '3_moderate', label: 'Moderate alternatives - Could replace with effort', score: 3 },
          { value: '2_many', label: 'Many alternatives - Easy to replace', score: 2 },
          { value: '1_abundant', label: 'Easily replaceable - Abundant alternatives', score: 1 },
        ],
      },
    ],
  },
  {
    id: 'section4',
    title: 'Section 4: Financial & Operational Significance',
    description: 'Evaluate financial and operational importance, including exit planning and business continuity',
    osfiSection: 'B-10 Section 3.4 - Risk Assessment / Section 4.4 - Exit Strategy',
    questions: [
      {
        id: 'q23_contract_value_cad',
        text: 'Q23. What is the annual contract value (CAD)?',
        type: 'number',
        riskCategory: 'financial',
      },
      {
        id: 'q24_total_financial_input',
        text: 'Q24. What percentage of total financial input does this represent?',
        type: 'radio',
        riskCategory: 'financial',
        options: [
          { value: '5_over_5', label: 'Over 5% of total spend', score: 5 },
          { value: '4_2_to_5', label: '2-5% of total spend', score: 4 },
          { value: '3_1_to_2', label: '1-2% of total spend', score: 3 },
          { value: '2_half_to_1', label: '0.5-1% of total spend', score: 2 },
          { value: '1_under_half', label: 'Under 0.5% of total spend', score: 1 },
        ],
      },
      {
        id: 'q25_operational_effort',
        text: 'Q25. What level of operational effort is required to manage this relationship?',
        type: 'radio',
        riskCategory: 'operational',
        options: [
          { value: '4_extensive', label: 'Extensive - Multiple FTEs dedicated', score: 4 },
          { value: '3_significant', label: 'Significant - 1+ FTE', score: 3 },
          { value: '2_moderate', label: 'Moderate - Part-time management', score: 2 },
          { value: '1_minimal', label: 'Minimal - Little ongoing management', score: 1 },
        ],
      },
      {
        id: 'q26_replacement_complexity',
        text: 'Q26. How complex would it be to replace this third party?',
        type: 'radio',
        riskCategory: 'operational',
        options: [
          { value: '5_extremely', label: 'Extremely complex - 12+ months', score: 5 },
          { value: '4_very', label: 'Very complex - 6-12 months', score: 4 },
          { value: '3_moderately', label: 'Moderately complex - 3-6 months', score: 3 },
          { value: '2_somewhat', label: 'Somewhat complex - 1-3 months', score: 2 },
          { value: '1_simple', label: 'Simple - Less than 1 month', score: 1 },
        ],
      },
      {
        id: 'q27_disruption_downtime',
        text: 'Q27. What is the acceptable downtime or disruption period?',
        type: 'radio',
        riskCategory: 'operational',
        options: [
          { value: '5_zero', label: 'Zero tolerance - Requires 24/7 availability', score: 5 },
          { value: '4_hour', label: 'Less than 1 hour', score: 4 },
          { value: '3_4hours', label: '1-4 hours', score: 3 },
          { value: '2_24hours', label: '4-24 hours', score: 2 },
          { value: '1_day', label: 'More than 1 day', score: 1 },
        ],
      },
      {
        id: 'q27b_exit_plan_documented',
        text: 'Q27b. Does the third party have a documented exit/transition plan?',
        helpText: 'OSFI B-10 requires documented exit strategies for material arrangements',
        type: 'radio',
        riskCategory: 'exit_strategy',
        osfiReference: 'B-10 4.4.1',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services', 'strategic_partner'],
          excludeForProviderTypes: ['tpsp_vendor'],
          priorityMultiplier: 1.2,
        },
        options: [
          { value: 'comprehensive', label: 'Yes - Comprehensive and tested exit plan', score: 1 },
          { value: 'documented', label: 'Yes - Documented but not tested', score: 2 },
          { value: 'informal', label: 'Informal exit procedures only', score: 3 },
          { value: 'none', label: 'No documented exit plan', score: 5 },
        ],
      },
      {
        id: 'q27c_transition_period',
        text: 'Q27c. What is the estimated transition period if services need to be moved?',
        helpText: 'Consider data migration, system integration, and operational handover',
        type: 'radio',
        riskCategory: 'exit_strategy',
        osfiReference: 'B-10 4.4.2',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services', 'strategic_partner'],
          excludeForProviderTypes: ['tpsp_vendor'],
        },
        options: [
          { value: 'under_30_days', label: 'Under 30 days', score: 1 },
          { value: '30_to_90_days', label: '30-90 days', score: 2 },
          { value: '3_to_6_months', label: '3-6 months', score: 3 },
          { value: '6_to_12_months', label: '6-12 months', score: 4 },
          { value: 'over_12_months', label: 'Over 12 months', score: 5 },
        ],
      },
      {
        id: 'q27d_data_portability',
        text: 'Q27d. Is data portable and in a standard format for transition?',
        helpText: 'Assess ability to extract and migrate data to alternative providers',
        type: 'radio',
        riskCategory: 'exit_strategy',
        osfiReference: 'B-10 4.4.3',
        profileConfig: {
          showForArchetypes: ['technology_data_processor'],
          showForCategories: ['cloud_data_services', 'it_telecom_services', 'data_research_subscription'],
        },
        options: [
          { value: 'fully_portable', label: 'Fully portable - Standard formats, documented APIs', score: 1 },
          { value: 'mostly_portable', label: 'Mostly portable - Some conversion needed', score: 2 },
          { value: 'partially_portable', label: 'Partially portable - Significant conversion required', score: 3 },
          { value: 'difficult', label: 'Difficult - Proprietary formats, limited export', score: 4 },
          { value: 'locked_in', label: 'Locked in - No practical data portability', score: 5 },
        ],
      },
      {
        id: 'q27e_exit_fees',
        text: 'Q27e. Are there exit fees or lock-in provisions that could impede transition?',
        type: 'radio',
        riskCategory: 'exit_strategy',
        osfiReference: 'B-10 4.4.4',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services', 'strategic_partner'],
          showWhenFormalContract: true,
        },
        options: [
          { value: 'no_restrictions', label: 'No exit fees or lock-in provisions', score: 1 },
          { value: 'reasonable_fees', label: 'Reasonable exit fees (< 3 months value)', score: 2 },
          { value: 'significant_fees', label: 'Significant exit fees (3-12 months value)', score: 3 },
          { value: 'prohibitive', label: 'Prohibitive fees or long notice periods (> 12 months)', score: 4 },
          { value: 'unknown', label: 'Unknown or unclear exit terms', score: 5 },
        ],
      },
      {
        id: 'q27f_bcp_documented',
        text: 'Q27f. Does the third party have a documented Business Continuity Plan (BCP)?',
        helpText: 'OSFI B-10 requires assessment of third-party BCP capabilities',
        type: 'radio',
        riskCategory: 'business_continuity',
        osfiReference: 'B-10 4.3.1',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services'],
          showWhenCritical: true,
          isRequiredFor: ['technology_data_processor'],
        },
        options: [
          { value: 'comprehensive', label: 'Yes - Comprehensive BCP aligned with industry standards', score: 1 },
          { value: 'documented', label: 'Yes - Documented BCP', score: 2 },
          { value: 'basic', label: 'Basic continuity procedures only', score: 3 },
          { value: 'none', label: 'No documented BCP', score: 5 },
        ],
      },
      {
        id: 'q27g_bcp_tested',
        text: 'Q27g. Has the BCP been tested within the past 12 months?',
        type: 'radio',
        riskCategory: 'business_continuity',
        osfiReference: 'B-10 4.3.2',
        conditional: {
          dependsOn: 'q27f_bcp_documented',
          showWhen: 'comprehensive',
        },
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services'],
        },
        options: [
          { value: 'tested_documented', label: 'Yes - Tested with documented results shared', score: 1 },
          { value: 'tested', label: 'Yes - Tested but results not shared', score: 2 },
          { value: 'planned', label: 'Test planned but not yet conducted', score: 3 },
          { value: 'not_tested', label: 'Not tested in past 12 months', score: 4 },
          { value: 'unknown', label: 'Unknown', score: 5 },
        ],
      },
      {
        id: 'q27h_rto_rpo',
        text: 'Q27h. What are the Recovery Time Objective (RTO) and Recovery Point Objective (RPO)?',
        helpText: 'RTO: Time to restore service. RPO: Maximum acceptable data loss window.',
        type: 'radio',
        riskCategory: 'business_continuity',
        osfiReference: 'B-10 4.3.3',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services'],
          showWhenCritical: true,
        },
        options: [
          { value: 'rto_1hr_rpo_0', label: 'RTO < 1 hour, RPO near-zero (continuous replication)', score: 1 },
          { value: 'rto_4hr_rpo_1hr', label: 'RTO < 4 hours, RPO < 1 hour', score: 2 },
          { value: 'rto_24hr_rpo_4hr', label: 'RTO < 24 hours, RPO < 4 hours', score: 3 },
          { value: 'rto_72hr_rpo_24hr', label: 'RTO < 72 hours, RPO < 24 hours', score: 4 },
          { value: 'not_defined', label: 'RTO/RPO not defined or > 72 hours', score: 5 },
        ],
      },
      {
        id: 'q27i_geographic_redundancy',
        text: 'Q27i. Does the third party have geographic redundancy or disaster recovery capabilities?',
        type: 'radio',
        riskCategory: 'business_continuity',
        osfiReference: 'B-10 4.3.4',
        profileConfig: {
          showForArchetypes: ['technology_data_processor'],
          showForCategories: ['cloud_data_services', 'it_telecom_services', 'exchange_clearing_services'],
        },
        options: [
          { value: 'multi_region', label: 'Yes - Multi-region with automatic failover', score: 1 },
          { value: 'dr_site', label: 'Yes - Dedicated DR site with manual failover', score: 2 },
          { value: 'backup_only', label: 'Backup systems only, no DR site', score: 3 },
          { value: 'limited', label: 'Limited redundancy', score: 4 },
          { value: 'none', label: 'No geographic redundancy', score: 5 },
        ],
      },
    ],
  },
  {
    id: 'section5',
    title: 'Section 5: Strategic & Reputational Risk',
    description: 'Assess strategic importance and reputational considerations',
    osfiSection: 'B-10 Section 3.4.5 - Reputational Risk',
    questions: [
      {
        id: 'q28_reputational_impact',
        text: 'Q28. What is the potential reputational impact if this third party experiences issues?',
        helpText: 'Consider public visibility and brand association',
        type: 'radio',
        riskCategory: 'reputational',
        osfiReference: 'B-10 3.4.5',
        options: [
          { value: '5_severe', label: 'Severe - Major public/media attention likely', score: 5 },
          { value: '4_major', label: 'Major - Significant reputational damage', score: 4 },
          { value: '3_moderate', label: 'Moderate - Some reputational concern', score: 3 },
          { value: '2_minor', label: 'Minor - Limited reputational impact', score: 2 },
          { value: '1_minimal', label: 'Minimal - No significant impact', score: 1 },
        ],
      },
      {
        id: 'q29_public_association',
        text: 'Q29. Is your organization publicly associated with this third party?',
        type: 'radio',
        riskCategory: 'reputational',
        options: [
          { value: '5_cobranded', label: 'Highly visible - Co-branded or public partnership', score: 5 },
          { value: '3_visible', label: 'Visible - Known to customers/public', score: 3 },
          { value: '1_internal', label: 'Not visible - Internal relationship only', score: 1 },
        ],
      },
    ],
  },
  {
    id: 'section6',
    title: 'Section 6: Data Sensitivity & Cybersecurity',
    description: 'Evaluate data access, cybersecurity risk, and incident response capabilities',
    osfiSection: 'B-10 Section 3.4.3 - Technology and Cyber Risk / Section 4.2 - Incident Management',
    questions: [
      {
        id: 'q30_has_system_access',
        text: 'Q30. Does the third party have access to your systems or data?',
        type: 'boolean',
        riskCategory: 'data_security',
      },
      {
        id: 'q31_data_sensitivity',
        text: 'Q31. What level of data sensitivity does the third party handle?',
        helpText: 'Consider PII, financial data, confidential information',
        type: 'radio',
        riskCategory: 'data_security',
        osfiReference: 'B-10 3.4.3',
        conditional: {
          dependsOn: 'q30_has_system_access',
          showWhen: true,
        },
        options: [
          { value: '5_highly_sensitive', label: 'Highly sensitive - Customer PII, financial data', score: 5 },
          { value: '4_sensitive', label: 'Sensitive - Internal confidential data', score: 4 },
          { value: '3_internal', label: 'Internal - Non-confidential internal data', score: 3 },
          { value: '1_public', label: 'Public - No sensitive data', score: 1 },
        ],
      },
      {
        id: 'q32_cybersecurity_risk',
        text: 'Q32. What is the cybersecurity risk posed by this third party?',
        type: 'radio',
        riskCategory: 'cyber_security',
        osfiReference: 'B-10 3.4.3',
        options: [
          { value: '5_critical', label: 'Critical - Direct access to critical systems', score: 5 },
          { value: '4_high', label: 'High - Access to important systems/data', score: 4 },
          { value: '3_moderate', label: 'Moderate - Limited system access', score: 3 },
          { value: '2_low', label: 'Low - Minimal system interaction', score: 2 },
          { value: '1_minimal', label: 'Minimal - No system access', score: 1 },
        ],
      },
      {
        id: 'q32b_incident_response_plan',
        text: 'Q32b. Does the third party have a documented incident response plan?',
        helpText: 'OSFI B-10 requires incident management capabilities assessment',
        type: 'radio',
        riskCategory: 'incident_response',
        osfiReference: 'B-10 4.2.1',
        profileConfig: {
          showWhenDataAccess: true,
          showForArchetypes: ['technology_data_processor', 'financial_services'],
          isRequiredFor: ['technology_data_processor'],
        },
        options: [
          { value: 'comprehensive', label: 'Yes - Comprehensive plan with defined roles and escalation', score: 1 },
          { value: 'documented', label: 'Yes - Documented procedures', score: 2 },
          { value: 'basic', label: 'Basic incident handling only', score: 3 },
          { value: 'none', label: 'No documented incident response plan', score: 5 },
        ],
      },
      {
        id: 'q32c_notification_period',
        text: 'Q32c. What is the contractual notification period for security incidents?',
        helpText: 'Timely notification is critical for regulatory compliance and incident response',
        type: 'radio',
        riskCategory: 'incident_response',
        osfiReference: 'B-10 4.2.2',
        profileConfig: {
          showWhenDataAccess: true,
          showWhenFormalContract: true,
        },
        options: [
          { value: 'immediate', label: 'Immediate (within 1 hour)', score: 1 },
          { value: 'same_day', label: 'Same business day', score: 2 },
          { value: '24_hours', label: 'Within 24 hours', score: 3 },
          { value: '72_hours', label: 'Within 72 hours', score: 4 },
          { value: 'not_defined', label: 'Not defined or > 72 hours', score: 5 },
        ],
      },
      {
        id: 'q32d_past_incidents',
        text: 'Q32d. Has the third party experienced any security incidents in the past 24 months?',
        type: 'radio',
        riskCategory: 'incident_response',
        osfiReference: 'B-10 4.2.3',
        profileConfig: {
          showWhenDataAccess: true,
        },
        options: [
          { value: 'no_incidents', label: 'No known security incidents', score: 1 },
          { value: 'minor_handled', label: 'Minor incidents, properly handled and disclosed', score: 2 },
          { value: 'incidents_improved', label: 'Incidents occurred, improvements implemented', score: 3 },
          { value: 'recurring', label: 'Recurring or significant incidents', score: 4 },
          { value: 'major_breach', label: 'Major breach or data loss event', score: 5 },
        ],
      },
      {
        id: 'q32e_incident_testing',
        text: 'Q32e. Does the third party conduct regular incident response testing or tabletop exercises?',
        type: 'radio',
        riskCategory: 'incident_response',
        osfiReference: 'B-10 4.2.4',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services'],
          showWhenCritical: true,
        },
        options: [
          { value: 'regular_joint', label: 'Yes - Regular exercises including joint tests with clients', score: 1 },
          { value: 'annual', label: 'Yes - Annual tabletop exercises', score: 2 },
          { value: 'occasional', label: 'Occasional testing', score: 3 },
          { value: 'none', label: 'No regular testing', score: 4 },
          { value: 'unknown', label: 'Unknown', score: 5 },
        ],
      },
    ],
  },
  {
    id: 'section7',
    title: 'Section 7: Concentration Risk',
    description: 'Assess concentration and availability risks',
    osfiSection: 'B-10 Section 3.4.6 - Concentration Risk',
    questions: [
      {
        id: 'q33_provider_availability',
        text: 'Q33. How many other similar providers are available in the market?',
        type: 'radio',
        riskCategory: 'concentration',
        osfiReference: 'B-10 3.4.6',
        options: [
          { value: '5_sole', label: 'Sole provider - No alternatives', score: 5 },
          { value: '4_very_few', label: 'Very few (1-2 alternatives)', score: 4 },
          { value: '3_limited', label: 'Limited (3-5 alternatives)', score: 3 },
          { value: '2_several', label: 'Several (6-10 alternatives)', score: 2 },
          { value: '1_many', label: 'Many (10+ alternatives)', score: 1 },
        ],
      },
      {
        id: 'q34_services_relied_on',
        text: 'Q34. How many of your services or products rely on this third party?',
        type: 'radio',
        riskCategory: 'concentration',
        options: [
          { value: '5_all', label: 'All or nearly all services', score: 5 },
          { value: '4_majority', label: 'Majority of services (>50%)', score: 4 },
          { value: '3_several', label: 'Several key services (25-50%)', score: 3 },
          { value: '2_few', label: 'Few services (<25%)', score: 2 },
          { value: '1_single', label: 'Single service or product line', score: 1 },
        ],
      },
    ],
  },
  {
    id: 'section8',
    title: 'Section 8: Access Level & Data Location',
    description: 'Evaluate system access and data location',
    osfiSection: 'B-10 Section 3.4.3 - Data Location / Section 4.1 - Access Controls',
    questions: [
      {
        id: 'q35_data_access_location',
        text: 'Q35. Where is data accessed or stored by the third party?',
        type: 'radio',
        riskCategory: 'data_location',
        osfiReference: 'B-10 3.4.3',
        options: [
          { value: '5_non_equivalent', label: 'Non-equivalent jurisdiction with weak privacy laws', score: 5 },
          { value: '4_multiple', label: 'Multiple jurisdictions including non-equivalent', score: 4 },
          { value: '2_foreign_equivalent', label: 'Foreign but equivalent jurisdiction', score: 2 },
          { value: '1_canada', label: 'Canada only', score: 1 },
        ],
      },
      {
        id: 'q36_system_access_level',
        text: 'Q36. What level of system access does the third party have?',
        type: 'radio',
        riskCategory: 'access_level',
        osfiReference: 'B-10 4.1.1',
        options: [
          { value: '5_admin', label: 'Administrative/Privileged access', score: 5 },
          { value: '4_read_write', label: 'Read and write access', score: 4 },
          { value: '3_read_only', label: 'Read-only access', score: 3 },
          { value: '2_limited', label: 'Limited/restricted access', score: 2 },
          { value: '1_none', label: 'No direct system access', score: 1 },
        ],
      },
      {
        id: 'q37_sensitive_data_access',
        text: 'Q37. Does the third party have access to customer data or sensitive information?',
        type: 'radio',
        riskCategory: 'access_level',
        options: [
          { value: '5_full', label: 'Full customer data including financial details', score: 5 },
          { value: '4_limited', label: 'Limited customer data', score: 4 },
          { value: '2_aggregated', label: 'Aggregated/anonymized data only', score: 2 },
          { value: '1_none', label: 'No customer or sensitive data', score: 1 },
        ],
      },
    ],
  },
  {
    id: 'section9',
    title: 'Section 9: Subcontractors & Fourth Parties',
    description: 'Assess fourth-party risk and oversight',
    osfiSection: 'B-10 Section 3.5 - Sub-outsourcing',
    questions: [
      {
        id: 'q38_uses_subcontractors',
        text: 'Q38. Does the third party use subcontractors or fourth parties?',
        type: 'boolean',
        riskCategory: 'subcontractor',
        osfiReference: 'B-10 3.5.1',
      },
      {
        id: 'q39_subcontractor_oversight',
        text: 'Q39. What level of oversight do you have over subcontractors?',
        type: 'radio',
        riskCategory: 'subcontractor',
        osfiReference: 'B-10 3.5.2',
        conditional: {
          dependsOn: 'q38_uses_subcontractors',
          showWhen: true,
        },
        options: [
          { value: '5_none', label: 'None - No visibility or control', score: 5 },
          { value: '4_minimal', label: 'Minimal - Limited information', score: 4 },
          { value: '3_moderate', label: 'Moderate - Some oversight mechanisms', score: 3 },
          { value: '2_significant', label: 'Significant - Regular monitoring', score: 2 },
          { value: '1_comprehensive', label: 'Comprehensive - Full visibility and approval rights', score: 1 },
        ],
      },
      {
        id: 'q40_subcontractor_access',
        text: 'Q40. Do subcontractors have access to your data or systems?',
        type: 'radio',
        riskCategory: 'subcontractor',
        osfiReference: 'B-10 3.5.3',
        conditional: {
          dependsOn: 'q38_uses_subcontractors',
          showWhen: true,
        },
        options: [
          { value: '5_direct', label: 'Yes - Direct access', score: 5 },
          { value: '3_indirect', label: 'Yes - Indirect access through third party', score: 3 },
          { value: '1_none', label: 'No - No access', score: 1 },
          { value: '4_unknown', label: 'Unknown', score: 4 },
        ],
      },
    ],
  },
  {
    id: 'section10',
    title: 'Section 10: Legal & Regulatory Risk',
    description: 'Evaluate regulatory compliance, audit rights, and certifications',
    osfiSection: 'B-10 Section 3.4.4 - Legal and Regulatory Risk / Section 5.2 - Audit Rights',
    questions: [
      {
        id: 'q41_regulatory_oversight',
        text: 'Q41. Is the third party subject to regulatory oversight?',
        type: 'radio',
        riskCategory: 'regulatory',
        osfiReference: 'B-10 3.4.4',
        options: [
          { value: '4_none', label: 'No regulatory oversight', score: 4 },
          { value: '3_limited', label: 'Limited or foreign oversight', score: 3 },
          { value: '2_provincial', label: 'Canadian provincial oversight', score: 2 },
          { value: '1_federal', label: 'Canadian federal oversight (OSFI, etc.)', score: 1 },
        ],
      },
      {
        id: 'q42_non_compliance_consequences',
        text: 'Q42. What are the consequences if this third party fails to comply with regulations?',
        type: 'radio',
        riskCategory: 'regulatory',
        options: [
          { value: '5_severe', label: 'Severe - Regulatory sanctions, license risk', score: 5 },
          { value: '4_major', label: 'Major - Significant penalties likely', score: 4 },
          { value: '3_moderate', label: 'Moderate - Some regulatory concern', score: 3 },
          { value: '2_minor', label: 'Minor - Limited regulatory impact', score: 2 },
          { value: '1_minimal', label: 'Minimal - No regulatory impact', score: 1 },
        ],
      },
      {
        id: 'q43_fraud_misconduct_history',
        text: 'Q43. Is there any history of fraud, misconduct, or regulatory issues?',
        type: 'radio',
        riskCategory: 'regulatory',
        options: [
          { value: '5_significant', label: 'Significant history of issues', score: 5 },
          { value: '3_some', label: 'Some past issues', score: 3 },
          { value: '1_none', label: 'No known issues', score: 1 },
        ],
      },
      {
        id: 'q43b_audit_rights',
        text: 'Q43b. Does the contract include audit and inspection rights for the FRFI?',
        helpText: 'OSFI B-10 requires FRFIs to maintain audit rights over material third parties',
        type: 'radio',
        riskCategory: 'audit_rights',
        osfiReference: 'B-10 5.2.1',
        profileConfig: {
          showWhenFormalContract: true,
          isRequiredFor: ['technology_data_processor', 'financial_services'],
        },
        options: [
          { value: 'comprehensive', label: 'Yes - Comprehensive audit rights with on-site access', score: 1 },
          { value: 'limited', label: 'Yes - Limited audit rights (documentation review)', score: 2 },
          { value: 'third_party_only', label: 'Third-party audit reports only (SOC, ISO)', score: 3 },
          { value: 'none', label: 'No audit rights specified', score: 5 },
        ],
      },
      {
        id: 'q43c_osfi_access',
        text: 'Q43c. Does the contract include an OSFI access clause for regulatory examination?',
        helpText: 'OSFI requires access to third-party records and premises for examination purposes',
        type: 'radio',
        riskCategory: 'audit_rights',
        osfiReference: 'B-10 5.2.2',
        profileConfig: {
          showWhenFormalContract: true,
          showForArchetypes: ['technology_data_processor', 'financial_services', 'professional_services'],
        },
        options: [
          { value: 'explicit', label: 'Yes - Explicit OSFI access clause included', score: 1 },
          { value: 'general', label: 'General regulatory access clause (not OSFI-specific)', score: 2 },
          { value: 'none', label: 'No regulatory access clause', score: 4 },
          { value: 'refused', label: 'Third party refused OSFI access clause', score: 5 },
        ],
      },
      {
        id: 'q43d_certifications',
        text: 'Q43d. What third-party certifications or attestations are available?',
        helpText: 'Industry certifications provide independent assurance of controls',
        type: 'checkbox',
        riskCategory: 'audit_rights',
        osfiReference: 'B-10 5.2.3',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services'],
          showForCategories: ['cloud_data_services', 'it_telecom_services', 'info_cyber_security', 'financial_insurance_services', 'exchange_clearing_services'],
        },
        options: [
          { value: 'soc2_type2', label: 'SOC 2 Type II' },
          { value: 'soc1_type2', label: 'SOC 1 Type II (SSAE 18)' },
          { value: 'iso27001', label: 'ISO 27001' },
          { value: 'iso22301', label: 'ISO 22301 (Business Continuity)' },
          { value: 'pci_dss', label: 'PCI-DSS' },
          { value: 'csa_star', label: 'CSA STAR' },
          { value: 'fedramp', label: 'FedRAMP' },
          { value: 'other', label: 'Other industry certifications' },
          { value: 'none', label: 'No certifications available' },
        ],
      },
      {
        id: 'q43e_audit_exercised',
        text: 'Q43e. Have audit rights been exercised in the past 24 months?',
        type: 'radio',
        riskCategory: 'audit_rights',
        osfiReference: 'B-10 5.2.4',
        profileConfig: {
          showWhenFormalContract: true,
          showWhenCritical: true,
        },
        conditional: {
          dependsOn: 'q43b_audit_rights',
          showWhen: 'comprehensive',
        },
        options: [
          { value: 'yes_findings_resolved', label: 'Yes - Audit completed, findings resolved', score: 1 },
          { value: 'yes_findings_open', label: 'Yes - Audit completed, some findings open', score: 2 },
          { value: 'scheduled', label: 'Audit scheduled but not yet completed', score: 3 },
          { value: 'not_exercised', label: 'No - Audit rights not exercised', score: 4 },
          { value: 'not_applicable', label: 'Not applicable (new relationship)', score: 3 },
        ],
      },
    ],
  },
  {
    id: 'section11',
    title: 'Section 11: Operational Maturity & Financial Viability',
    description: 'Assess operational stability, maturity, and financial health',
    osfiSection: 'B-10 Section 3.4.2 - Operational Risk / Section 3.4.7 - Financial Viability',
    questions: [
      {
        id: 'q44_operational_maturity',
        text: 'Q44. What is the operational maturity level of the third party?',
        type: 'radio',
        riskCategory: 'operational_maturity',
        osfiReference: 'B-10 3.4.2',
        options: [
          { value: '4_startup', label: 'Startup - Less than 2 years, unproven', score: 4 },
          { value: '3_emerging', label: 'Emerging - 2-5 years, developing track record', score: 3 },
          { value: '2_established', label: 'Established - 5-10 years, proven capabilities', score: 2 },
          { value: '1_mature', label: 'Mature - 10+ years, industry leader', score: 1 },
        ],
      },
      {
        id: 'q45_reliability_track_record',
        text: 'Q45. What is the reliability and performance track record?',
        type: 'radio',
        riskCategory: 'operational_maturity',
        options: [
          { value: '5_poor', label: 'Poor - Frequent issues and service disruptions', score: 5 },
          { value: '3_fair', label: 'Fair - Occasional issues', score: 3 },
          { value: '2_good', label: 'Good - Reliable with rare issues', score: 2 },
          { value: '1_excellent', label: 'Excellent - Consistently reliable', score: 1 },
        ],
      },
      {
        id: 'q45b_financial_stability',
        text: 'Q45b. What is the financial stability rating or credit assessment of the third party?',
        helpText: 'OSFI B-10 requires assessment of financial viability for material arrangements',
        type: 'radio',
        riskCategory: 'financial_viability',
        osfiReference: 'B-10 3.4.7',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services', 'strategic_partner'],
          excludeForProviderTypes: ['tpsp_vendor'],
          showWhenCritical: true,
        },
        options: [
          { value: 'investment_grade', label: 'Investment grade rating or strong financials', score: 1 },
          { value: 'stable', label: 'Stable - Adequate financial position', score: 2 },
          { value: 'moderate_concerns', label: 'Some financial concerns or limited visibility', score: 3 },
          { value: 'weak', label: 'Weak financial position', score: 4 },
          { value: 'significant_concerns', label: 'Significant financial concerns or distress', score: 5 },
        ],
      },
      {
        id: 'q45c_ownership_changes',
        text: 'Q45c. Has there been any recent change in ownership, funding, or corporate structure?',
        type: 'radio',
        riskCategory: 'financial_viability',
        osfiReference: 'B-10 3.4.7',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services', 'strategic_partner'],
        },
        options: [
          { value: 'no_changes', label: 'No significant changes in past 24 months', score: 1 },
          { value: 'positive_change', label: 'Positive change (growth funding, strategic acquisition)', score: 1 },
          { value: 'neutral_change', label: 'Neutral change (ownership transfer, reorganization)', score: 2 },
          { value: 'concerning_change', label: 'Concerning change (distressed sale, layoffs)', score: 4 },
          { value: 'unknown', label: 'Unknown or insufficient information', score: 3 },
        ],
      },
      {
        id: 'q45d_ownership_type',
        text: 'Q45d. Is the third party publicly traded, privately held, or government-owned?',
        type: 'radio',
        riskCategory: 'financial_viability',
        profileConfig: {
          showForArchetypes: ['financial_services', 'strategic_partner'],
        },
        options: [
          { value: 'public', label: 'Publicly traded (financial disclosures available)', score: 1 },
          { value: 'government', label: 'Government-owned or sponsored', score: 1 },
          { value: 'private_transparent', label: 'Privately held with financial transparency', score: 2 },
          { value: 'private_limited', label: 'Privately held with limited visibility', score: 3 },
          { value: 'private_opaque', label: 'Privately held with no financial visibility', score: 4 },
        ],
      },
      {
        id: 'q45e_going_concern',
        text: 'Q45e. Are there any known financial concerns or going-concern issues?',
        type: 'radio',
        riskCategory: 'financial_viability',
        osfiReference: 'B-10 3.4.7',
        profileConfig: {
          showForArchetypes: ['technology_data_processor', 'financial_services', 'strategic_partner'],
          showWhenCritical: true,
        },
        options: [
          { value: 'no_concerns', label: 'No known concerns - Strong financial position', score: 1 },
          { value: 'minor_concerns', label: 'Minor concerns being monitored', score: 2 },
          { value: 'moderate_concerns', label: 'Moderate concerns requiring attention', score: 3 },
          { value: 'significant_concerns', label: 'Significant concerns identified', score: 4 },
          { value: 'going_concern', label: 'Going concern issues or imminent risk', score: 5 },
        ],
      },
    ],
  },
  {
    id: 'section12',
    title: 'Section 12: Other Risk Factors',
    description: 'Consider additional risk factors including ESG and geopolitical',
    osfiSection: 'B-10 Section 3.4.8 - Other Risk Factors',
    questions: [
      {
        id: 'q46_geopolitical_risk',
        text: 'Q46. Are there geopolitical or jurisdictional risks?',
        type: 'radio',
        riskCategory: 'other_risks',
        osfiReference: 'B-10 3.4.8',
        options: [
          { value: '5_high', label: 'High risk - Sanctions, instability concerns', score: 5 },
          { value: '3_moderate', label: 'Moderate risk - Some concerns', score: 3 },
          { value: '1_low', label: 'Low risk - Stable jurisdiction', score: 1 },
        ],
      },
      {
        id: 'q47_negative_coverage',
        text: 'Q47. Has there been negative media coverage or public controversies?',
        type: 'radio',
        riskCategory: 'other_risks',
        options: [
          { value: '4_significant', label: 'Significant negative coverage', score: 4 },
          { value: '3_some', label: 'Some negative coverage', score: 3 },
          { value: '2_minor', label: 'Minor or isolated incidents', score: 2 },
          { value: '1_none', label: 'No significant negative coverage', score: 1 },
        ],
      },
      {
        id: 'q48_esg_concerns',
        text: 'Q48. Are there environmental, social, or governance (ESG) concerns?',
        type: 'radio',
        riskCategory: 'other_risks',
        options: [
          { value: '4_significant', label: 'Significant ESG concerns identified', score: 4 },
          { value: '3_moderate', label: 'Moderate concerns', score: 3 },
          { value: '2_minor', label: 'Minor concerns', score: 2 },
          { value: '1_none', label: 'No known ESG concerns', score: 1 },
        ],
      },
      {
        id: 'q49_child_labor_verification',
        text: 'Q49. Has the third party been verified for child labor and human rights practices?',
        type: 'radio',
        riskCategory: 'other_risks',
        options: [
          { value: '4_not_verified', label: 'Not verified - High risk industry', score: 4 },
          { value: '3_partial', label: 'Partially verified', score: 3 },
          { value: '1_verified', label: 'Verified - No concerns', score: 1 },
          { value: '1_na', label: 'Not applicable', score: 1 },
        ],
      },
    ],
  },
  {
    id: 'section13',
    title: 'Section 13: Contract Status & Insurance',
    description: 'Assess contractual arrangements, insurance coverage, and liability provisions',
    osfiSection: 'B-10 Section 5 - Contractual Provisions / Section 5.3 - Insurance',
    questions: [
      {
        id: 'q50_has_formal_contract',
        text: 'Q50. Is there a formal written contract in place?',
        type: 'boolean',
        riskCategory: 'contract',
        osfiReference: 'B-10 5.1',
      },
      {
        id: 'q51_contract_type',
        text: 'Q51. What type of contract is in place?',
        type: 'radio',
        riskCategory: 'contract',
        conditional: {
          dependsOn: 'q50_has_formal_contract',
          showWhen: true,
        },
        options: [
          { value: 'msa', label: 'Master Service Agreement (MSA)' },
          { value: 'sow', label: 'Statement of Work (SOW)' },
          { value: 'sla', label: 'Service Level Agreement (SLA)' },
          { value: 'standard', label: 'Standard vendor agreement' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        id: 'q52_contract_duration',
        text: 'Q52. What is the contract duration?',
        type: 'radio',
        riskCategory: 'contract',
        conditional: {
          dependsOn: 'q50_has_formal_contract',
          showWhen: true,
        },
        options: [
          { value: 'less_than_year', label: 'Less than 1 year' },
          { value: '1_to_3_years', label: '1-3 years' },
          { value: '3_to_5_years', label: '3-5 years' },
          { value: 'more_than_5_years', label: 'More than 5 years' },
          { value: 'evergreen', label: 'Evergreen / No fixed term' },
        ],
      },
      {
        id: 'q53_requires_formal_contract',
        text: 'Q53. Based on the assessment, should a formal contract be required?',
        helpText: 'Higher risk arrangements should have formal contractual protections',
        type: 'boolean',
        riskCategory: 'contract',
      },
      {
        id: 'q53b_professional_liability',
        text: 'Q53b. Does the third party maintain professional liability/E&O insurance?',
        helpText: 'Professional liability insurance protects against negligence claims',
        type: 'radio',
        riskCategory: 'insurance',
        osfiReference: 'B-10 5.3.1',
        profileConfig: {
          showWhenFormalContract: true,
          showForArchetypes: ['professional_services', 'technology_data_processor', 'financial_services'],
        },
        options: [
          { value: 'adequate', label: 'Yes - Adequate coverage limits verified', score: 1 },
          { value: 'exists', label: 'Yes - Coverage exists but limits not verified', score: 2 },
          { value: 'insufficient', label: 'Yes - But coverage may be insufficient', score: 3 },
          { value: 'none', label: 'No professional liability insurance', score: 4 },
          { value: 'unknown', label: 'Unknown', score: 5 },
        ],
      },
      {
        id: 'q53c_cyber_liability',
        text: 'Q53c. Does the third party maintain cyber liability insurance?',
        helpText: 'Cyber insurance covers data breaches and cyber incidents',
        type: 'radio',
        riskCategory: 'insurance',
        osfiReference: 'B-10 5.3.2',
        profileConfig: {
          showWhenFormalContract: true,
          showForArchetypes: ['technology_data_processor'],
          showForCategories: ['cloud_data_services', 'it_telecom_services', 'info_cyber_security'],
          showWhenDataAccess: true,
        },
        options: [
          { value: 'adequate', label: 'Yes - Adequate coverage with FRFI named', score: 1 },
          { value: 'exists', label: 'Yes - Coverage exists, limits verified', score: 2 },
          { value: 'basic', label: 'Yes - Basic coverage only', score: 3 },
          { value: 'none', label: 'No cyber liability insurance', score: 4 },
          { value: 'unknown', label: 'Unknown', score: 5 },
        ],
      },
      {
        id: 'q53d_coverage_adequacy',
        text: 'Q53d. Are insurance coverage limits adequate relative to contract value and risk exposure?',
        type: 'radio',
        riskCategory: 'insurance',
        osfiReference: 'B-10 5.3.3',
        profileConfig: {
          showWhenFormalContract: true,
          showWhenCritical: true,
        },
        options: [
          { value: 'exceeds', label: 'Coverage significantly exceeds contract value', score: 1 },
          { value: 'adequate', label: 'Coverage adequate for risk exposure', score: 2 },
          { value: 'borderline', label: 'Coverage borderline - may be insufficient', score: 3 },
          { value: 'insufficient', label: 'Coverage insufficient for risk exposure', score: 4 },
          { value: 'not_assessed', label: 'Not assessed', score: 5 },
        ],
      },
      {
        id: 'q53e_indemnification',
        text: 'Q53e. Are indemnification provisions included in the contract?',
        helpText: 'Indemnification protects the FRFI from third-party claims',
        type: 'radio',
        riskCategory: 'insurance',
        osfiReference: 'B-10 5.3.4',
        profileConfig: {
          showWhenFormalContract: true,
        },
        options: [
          { value: 'comprehensive', label: 'Yes - Comprehensive mutual indemnification', score: 1 },
          { value: 'standard', label: 'Yes - Standard indemnification clause', score: 2 },
          { value: 'limited', label: 'Limited indemnification', score: 3 },
          { value: 'none', label: 'No indemnification provisions', score: 4 },
          { value: 'capped', label: 'Indemnification capped at low amount', score: 4 },
        ],
      },
    ],
  },
  {
    id: 'section12_5',
    title: 'Section 12.5: ESG Risk Assessment',
    description: 'Evaluate environmental, social, and governance risks associated with this third party',
    osfiSection: 'OSFI ESG Risk Management / CSDDD / Scope 3 Reporting',
    questions: [
      {
        id: 'esg1_environmental_policy',
        text: 'ESG1. Does the vendor have a documented environmental policy with carbon reduction commitments?',
        helpText: 'Consider net-zero targets, emissions reporting, environmental certifications (ISO 14001)',
        type: 'radio',
        riskCategory: 'esg',
        options: [
          { value: '1_comprehensive', label: 'Comprehensive policy with verified targets and reporting', score: 1 },
          { value: '2_documented', label: 'Documented policy with stated commitments', score: 2 },
          { value: '3_basic', label: 'Basic environmental awareness, no formal policy', score: 3 },
          { value: '4_none', label: 'No environmental policy or commitments', score: 4 },
          { value: '1_na', label: 'Not applicable (low environmental impact)', score: 1 },
        ],
      },
      {
        id: 'esg2_labor_practices',
        text: 'ESG2. What is the vendor\'s approach to labor practices and modern slavery due diligence?',
        helpText: 'Consider ILO compliance, supply chain audits, modern slavery statements',
        type: 'radio',
        riskCategory: 'esg',
        options: [
          { value: '1_verified', label: 'Third-party verified labor compliance with supply chain audits', score: 1 },
          { value: '2_documented', label: 'Documented modern slavery statement and labor policies', score: 2 },
          { value: '3_basic', label: 'Basic labor policies, limited supply chain visibility', score: 3 },
          { value: '4_concerns', label: 'Known labor practice concerns or no policies', score: 4 },
        ],
      },
      {
        id: 'esg3_board_governance',
        text: 'ESG3. How would you rate the vendor\'s board governance structure and independence?',
        helpText: 'Consider board independence, committees, transparency, executive compensation alignment',
        type: 'radio',
        riskCategory: 'esg',
        options: [
          { value: '1_strong', label: 'Strong independent governance with diverse board and transparent reporting', score: 1 },
          { value: '2_adequate', label: 'Adequate governance structures in place', score: 2 },
          { value: '3_developing', label: 'Developing governance practices', score: 3 },
          { value: '4_weak', label: 'Weak governance or owner-controlled without oversight', score: 4 },
        ],
      },
      {
        id: 'esg4_sanctions_pep_exposure',
        text: 'ESG4. Is there any sanctions, PEP, or adverse media exposure related to this vendor?',
        helpText: 'Consider OFAC, EU, UN sanctions lists; politically exposed persons; negative news screening',
        type: 'radio',
        riskCategory: 'esg',
        options: [
          { value: '1_clear', label: 'Screened — no sanctions, PEP, or adverse media hits', score: 1 },
          { value: '2_minor', label: 'Minor adverse media, no sanctions or PEP connections', score: 2 },
          { value: '3_flagged', label: 'Flagged for review — some concerning connections', score: 3 },
          { value: '5_sanctioned', label: 'Active sanctions, PEP exposure, or significant adverse media', score: 5 },
        ],
      },
      {
        id: 'esg5_supply_chain_ethics',
        text: 'ESG5. Does the vendor enforce supply chain ethics policies?',
        helpText: 'Consider vendor code of conduct for suppliers, conflict minerals policy, fair trade practices',
        type: 'radio',
        riskCategory: 'esg',
        options: [
          { value: '1_enforced', label: 'Comprehensive supply chain ethics code with enforcement and audits', score: 1 },
          { value: '2_documented', label: 'Documented supplier code of conduct', score: 2 },
          { value: '3_informal', label: 'Informal expectations, no formal code', score: 3 },
          { value: '4_none', label: 'No supply chain ethics policies', score: 4 },
        ],
      },
      {
        id: 'esg6_dei_metrics',
        text: 'ESG6. Does the vendor track and report diversity, equity, and inclusion (DEI) metrics?',
        helpText: 'Consider workforce diversity data, pay equity, inclusion programs, public DEI reporting',
        type: 'radio',
        riskCategory: 'esg',
        options: [
          { value: '1_comprehensive', label: 'Comprehensive DEI reporting with measurable goals and progress', score: 1 },
          { value: '2_reported', label: 'DEI metrics tracked and reported', score: 2 },
          { value: '3_basic', label: 'Basic diversity awareness, limited tracking', score: 3 },
          { value: '4_none', label: 'No DEI tracking or reporting', score: 4 },
        ],
      },
    ],
  },
  {
    id: 'section14_5',
    title: 'Section 14.5: Vendor Control Effectiveness',
    description: 'Evaluate the effectiveness of vendor controls to determine residual risk after controls',
    osfiSection: 'B-10 Section 4 — Ongoing Monitoring / Shared Assessments SIG',
    questions: [
      {
        id: 'ce1_security_certifications',
        text: 'CE1. Which security certifications does the vendor currently hold?',
        helpText: 'Select all active, valid certifications held by the vendor',
        type: 'checkbox',
        riskCategory: 'control_effectiveness',
        options: [
          { value: 'soc2_type2', label: 'SOC 2 Type II' },
          { value: 'iso27001', label: 'ISO 27001' },
          { value: 'pci_dss', label: 'PCI DSS' },
          { value: 'iso22301', label: 'ISO 22301 (BCMS)' },
          { value: 'iso27701', label: 'ISO 27701 (Privacy)' },
          { value: 'fedramp', label: 'FedRAMP' },
          { value: 'csa_star', label: 'CSA STAR' },
          { value: 'hitrust', label: 'HITRUST' },
          { value: 'none', label: 'No recognized certifications' },
        ],
      },
      {
        id: 'ce2_last_audit_findings',
        text: 'CE2. What were the findings from the vendor\'s most recent external audit?',
        helpText: 'Consider SOC 2 reports, ISO audit findings, regulatory examination results',
        type: 'radio',
        riskCategory: 'control_effectiveness',
        options: [
          { value: '1_clean', label: 'Clean opinion / no material findings within last 12 months', score: 1 },
          { value: '2_minor', label: 'Minor findings, all remediated', score: 2 },
          { value: '3_moderate', label: 'Moderate findings, remediation in progress', score: 3 },
          { value: '4_significant', label: 'Significant findings or overdue remediation', score: 4 },
          { value: '5_none', label: 'No recent audit or audit not available', score: 5 },
        ],
      },
      {
        id: 'ce3_incident_response_maturity',
        text: 'CE3. How mature is the vendor\'s incident response capability?',
        helpText: 'Consider documented plan, trained team, regular exercises, post-incident reviews',
        type: 'radio',
        riskCategory: 'control_effectiveness',
        options: [
          { value: '1_advanced', label: 'Mature — documented, trained team, regularly exercised, lessons learned process', score: 1 },
          { value: '2_established', label: 'Established — documented plan, team trained, tested annually', score: 2 },
          { value: '3_developing', label: 'Developing — plan exists but untested or incomplete', score: 3 },
          { value: '4_basic', label: 'Basic — ad hoc response, no formal plan', score: 4 },
          { value: '5_none', label: 'None — no incident response capability', score: 5 },
        ],
      },
      {
        id: 'ce4_data_protection_controls',
        text: 'CE4. What data protection controls does the vendor implement?',
        helpText: 'Consider encryption at rest/in transit, access controls, DLP, data classification',
        type: 'radio',
        riskCategory: 'control_effectiveness',
        profileConfig: {
          showWhenDataAccess: true,
        },
        options: [
          { value: '1_comprehensive', label: 'Comprehensive — encryption, MFA, DLP, classification, regular audits', score: 1 },
          { value: '2_strong', label: 'Strong — encryption and access controls in place', score: 2 },
          { value: '3_standard', label: 'Standard — basic encryption, role-based access', score: 3 },
          { value: '4_limited', label: 'Limited — minimal data protection measures', score: 4 },
          { value: '5_none', label: 'No documented data protection controls', score: 5 },
        ],
      },
      {
        id: 'ce5_bcp_testing_frequency',
        text: 'CE5. How frequently does the vendor test their Business Continuity Plan?',
        helpText: 'Consider tabletop exercises, failover tests, full DR simulations',
        type: 'radio',
        riskCategory: 'control_effectiveness',
        options: [
          { value: '1_quarterly', label: 'Quarterly or more frequently with documented results', score: 1 },
          { value: '2_semiannual', label: 'Semi-annually with documented results', score: 2 },
          { value: '3_annual', label: 'Annually', score: 3 },
          { value: '4_infrequent', label: 'Less than annually or ad hoc', score: 4 },
          { value: '5_never', label: 'Never tested or no BCP exists', score: 5 },
        ],
      },
      {
        id: 'ce6_patch_management',
        text: 'CE6. What is the vendor\'s patch management cadence for critical vulnerabilities?',
        helpText: 'Consider SLA for critical patches, automated scanning, vulnerability management program',
        type: 'radio',
        riskCategory: 'control_effectiveness',
        options: [
          { value: '1_rapid', label: 'Critical patches within 24-48 hours, automated scanning', score: 1 },
          { value: '2_prompt', label: 'Critical patches within 7 days, regular scanning', score: 2 },
          { value: '3_scheduled', label: 'Monthly patch cycle, periodic scanning', score: 3 },
          { value: '4_delayed', label: 'Irregular patching, reactive approach', score: 4 },
          { value: '5_none', label: 'No formal patch management process', score: 5 },
        ],
      },
      {
        id: 'ce7_security_awareness_training',
        text: 'CE7. Does the vendor provide employee security awareness training?',
        helpText: 'Consider training frequency, phishing simulations, completion rates',
        type: 'radio',
        riskCategory: 'control_effectiveness',
        options: [
          { value: '1_comprehensive', label: 'Mandatory annual training + quarterly phishing simulations, >95% completion', score: 1 },
          { value: '2_regular', label: 'Regular training with tracking, >80% completion', score: 2 },
          { value: '3_annual', label: 'Annual training only', score: 3 },
          { value: '4_adhoc', label: 'Ad hoc or onboarding-only training', score: 4 },
          { value: '5_none', label: 'No security awareness training program', score: 5 },
        ],
      },
      {
        id: 'ce8_penetration_testing',
        text: 'CE8. Does the vendor conduct third-party penetration testing?',
        helpText: 'Consider scope, frequency, remediation tracking, and report availability',
        type: 'radio',
        riskCategory: 'control_effectiveness',
        options: [
          { value: '1_frequent', label: 'Annual or more frequent external pentest + bug bounty program', score: 1 },
          { value: '2_annual', label: 'Annual third-party penetration testing with remediation tracking', score: 2 },
          { value: '3_periodic', label: 'Periodic testing (every 2+ years)', score: 3 },
          { value: '4_internal', label: 'Internal testing only, no third-party assessment', score: 4 },
          { value: '5_none', label: 'No penetration testing conducted', score: 5 },
        ],
      },
    ],
  },
  {
    id: 'section14',
    title: 'Assessment Review',
    description: 'Review and finalize the assessment',
    questions: [
      {
        id: 'assessor_name',
        text: 'Assessor Name',
        type: 'text',
      },
      {
        id: 'assessment_notes',
        text: 'Assessment Notes',
        helpText: 'Any additional observations or notes about this assessment',
        type: 'textarea',
      },
    ],
  },
];

export function getQuestionsForProfile(
  archetype: VendorArchetype,
  serviceCategory: string,
  providerType: string,
  contextFlags: {
    hasDataAccess?: boolean;
    usesSubcontractors?: boolean;
    hasFormalContract?: boolean;
    isCritical?: boolean;
  } = {}
): AssessmentSection[] {
  const { isQuestionRelevantForProfile } = require('./vendorProfiles');

  return assessmentSections.map(section => ({
    ...section,
    questions: section.questions.filter(question =>
      isQuestionRelevantForProfile(
        question.profileConfig,
        archetype,
        serviceCategory as any,
        providerType as any,
        contextFlags
      )
    ),
  })).filter(section => section.questions.length > 0);
}

export function getTotalQuestionCount(sections: AssessmentSection[]): number {
  return sections.reduce((total, section) => total + section.questions.length, 0);
}

export function getRequiredQuestionsForArchetype(archetype: VendorArchetype): string[] {
  const required: string[] = [];

  assessmentSections.forEach(section => {
    section.questions.forEach(question => {
      if (question.profileConfig?.isRequiredFor?.includes(archetype)) {
        required.push(question.id);
      }
    });
  });

  return required;
}

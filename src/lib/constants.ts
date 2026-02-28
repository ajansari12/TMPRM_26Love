import { ServiceCategory, BusinessUnit, ProviderType, ContractType } from '../types';

export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'facilities_real_estate', label: 'Facilities & Real Estate' },
  { value: 'financial_insurance_services', label: 'Financial & Insurance Services' },
  { value: 'it_telecom_services', label: 'IT & Telecom Services' },
  { value: 'legal_audit_consulting', label: 'Legal, Audit & Consulting Services' },
  { value: 'office_support_supplies', label: 'Office Support & Supplies' },
  { value: 'physical_security', label: 'Physical Security' },
  { value: 'cloud_data_services', label: 'Cloud & Data Services' },
  { value: 'exchange_clearing_services', label: 'Exchange & Clearing Services' },
  { value: 'human_resources_services', label: 'Human Resources Services' },
  { value: 'info_cyber_security', label: 'Information & Cyber Security' },
  { value: 'transport_delivery', label: 'Transport & Delivery' },
  { value: 'marketing_services', label: 'Marketing Services' },
  { value: 'external_portals_platforms', label: 'External Portals & Platforms' },
  { value: 'data_research_subscription', label: 'Data & Research Subscription' },
  { value: 'other', label: 'Other' },
];

export const BUSINESS_UNITS: { value: BusinessUnit; label: string }[] = [
  { value: 'audit', label: 'Audit' },
  { value: 'branch_operations', label: 'Branch Operations' },
  { value: 'business_development_marketing', label: 'Business Development & Marketing' },
  { value: 'credit_risk_cad', label: 'Credit Risk / CAD' },
  { value: 'financial_controls', label: 'Financial Controls' },
  { value: 'human_resources', label: 'Human Resources' },
  { value: 'legal_compliance', label: 'Legal & Compliance' },
  { value: 'retail_banking', label: 'Retail Banking' },
  { value: 'risk_control', label: 'Risk Control' },
  { value: 'risk_control_ops', label: 'Risk Control - Ops Risk' },
  { value: 'technology', label: 'Technology' },
];

export const PROVIDER_TYPES: { value: ProviderType; label: string; description: string }[] = [
  {
    value: 'tpsp_outsourced_group',
    label: 'Outsourced - Intra-Group (services from parent or affiliated entities)',
    description: 'Intra-group outsourcing arrangement',
  },
  {
    value: 'tpsp_outsourced_external',
    label: 'Outsourced - External (activities performed by unrelated third party)',
    description: 'External outsourcing arrangement',
  },
  {
    value: 'tpsp_other_providers',
    label: 'Other Service Providers (non-outsourcing service relationships)',
    description: 'Non-outsourcing service providers',
  },
  {
    value: 'tpsp_vendor',
    label: 'Vendor (product suppliers, software licenses, equipment)',
    description: 'Product or supply vendors',
  },
  {
    value: 'tpsp_business_partner',
    label: 'Business Partner (strategic partnerships, joint ventures)',
    description: 'Strategic partnerships',
  },
];

export const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: 'formal_contract', label: 'Formal Contract' },
  { value: 'supply_agreement', label: 'Supply Agreement' },
  { value: 'procurement_invoice', label: 'Procurement - Invoice based' },
  { value: 'subscription_license', label: 'Subscription / License Terms' },
  { value: 'portal_regulatory_access', label: 'Portal / Regulatory Access' },
  { value: 'membership_association', label: 'Membership / Association Terms' },
  { value: 'terms_only', label: 'Terms Only' },
];

export const CONTRACT_DURATIONS: { value: string; label: string }[] = [
  { value: 'month_to_month', label: 'Month to Month' },
  { value: '6_months', label: '6 Months' },
  { value: '1_year', label: '1 Year' },
  { value: '2_years', label: '2 Years' },
  { value: '3_years', label: '3 Years' },
  { value: '5_years', label: '5 Years' },
  { value: 'indefinite', label: 'Indefinite' },
  { value: 'other', label: 'Other' },
];

export const VENDOR_STATUSES = [
  { value: 'active', label: 'Active', color: 'emerald' },
  { value: 'under_review', label: 'Under Review', color: 'amber' },
  { value: 'review_due', label: 'Review Due', color: 'orange' },
  { value: 'onboarding', label: 'Onboarding', color: 'blue' },
  { value: 'offboarding', label: 'Offboarding', color: 'slate' },
  { value: 'terminated', label: 'Terminated', color: 'slate' },
  { value: 'suspended', label: 'Suspended', color: 'red' },
  { value: 'non_compliant', label: 'Non-Compliant', color: 'red' },
  { value: 'pending_approval', label: 'Pending Approval', color: 'yellow' },
];

export const LIFECYCLE_STAGES = [
  { value: 'identification', label: 'Identification' },
  { value: 'tiering', label: 'Tiering' },
  { value: 'due_diligence', label: 'Due Diligence' },
  { value: 'contracting', label: 'Contracting' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'performance_review', label: 'Performance Review' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'terminated', label: 'Terminated' },
];

export const DATA_ACCESS_LEVELS = [
  { value: 'none', label: 'No Access' },
  { value: 'read_only', label: 'Read Only' },
  { value: 'limited', label: 'Limited' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'full_admin', label: 'Full Admin' },
];

export const INCIDENT_TYPES = [
  { value: 'cyber_security', label: 'Cyber Security' },
  { value: 'data_breach', label: 'Data Breach' },
  { value: 'service_outage', label: 'Service Outage' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'financial', label: 'Financial' },
  { value: 'operational', label: 'Operational' },
  { value: 'reputational', label: 'Reputational' },
  { value: 'other', label: 'Other' },
];

export const SEVERITY_LEVELS = [
  { value: 'critical', label: 'Critical', color: 'red' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'medium', label: 'Medium', color: 'amber' },
  { value: 'low', label: 'Low', color: 'emerald' },
];

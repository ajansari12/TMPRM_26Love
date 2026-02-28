import { ServiceCategory, ProviderType } from '../types';

export type VendorArchetype =
  | 'technology_data_processor'
  | 'financial_services'
  | 'professional_services'
  | 'operational_support'
  | 'strategic_partner'
  | 'general';

export interface VendorProfile {
  archetype: VendorArchetype;
  label: string;
  description: string;
  riskEmphasis: string[];
  keyQuestionAreas: string[];
}

export interface ProfileQuestionConfig {
  showForArchetypes?: VendorArchetype[];
  excludeForArchetypes?: VendorArchetype[];
  showForCategories?: ServiceCategory[];
  excludeForCategories?: ServiceCategory[];
  showForProviderTypes?: ProviderType[];
  excludeForProviderTypes?: ProviderType[];
  showWhenDataAccess?: boolean;
  showWhenSubcontractors?: boolean;
  showWhenFormalContract?: boolean;
  showWhenCritical?: boolean;
  priorityMultiplier?: number;
  isRequiredFor?: VendorArchetype[];
}

export const VENDOR_ARCHETYPES: Record<VendorArchetype, VendorProfile> = {
  technology_data_processor: {
    archetype: 'technology_data_processor',
    label: 'Technology & Data Processor',
    description: 'Cloud services, IT infrastructure, data processing, and cybersecurity providers',
    riskEmphasis: ['cybersecurity', 'data_sensitivity', 'business_continuity', 'incident_response'],
    keyQuestionAreas: [
      'Data Sensitivity & Cybersecurity',
      'Access Level & Data Location',
      'Business Continuity',
      'Incident Response',
    ],
  },
  financial_services: {
    archetype: 'financial_services',
    label: 'Financial Services Provider',
    description: 'Exchange, clearing, payment processing, and financial/insurance services',
    riskEmphasis: ['regulatory', 'concentration', 'financial_viability', 'operational_maturity'],
    keyQuestionAreas: [
      'Legal & Regulatory Risk',
      'Concentration Risk',
      'Financial Viability',
      'Operational Maturity',
    ],
  },
  professional_services: {
    archetype: 'professional_services',
    label: 'Professional Services',
    description: 'Legal, audit, consulting, and advisory services',
    riskEmphasis: ['confidentiality', 'audit_rights', 'contract_provisions', 'regulatory'],
    keyQuestionAreas: [
      'Contract Status',
      'Audit Rights',
      'Legal & Regulatory Risk',
      'Subcontractors',
    ],
  },
  operational_support: {
    archetype: 'operational_support',
    label: 'Operational Support',
    description: 'Facilities, transport, physical security, and office support services',
    riskEmphasis: ['physical_security', 'service_continuity', 'operational_maturity'],
    keyQuestionAreas: [
      'Financial & Operational Significance',
      'Operational Maturity',
      'Dependency Level',
    ],
  },
  strategic_partner: {
    archetype: 'strategic_partner',
    label: 'Strategic Partner',
    description: 'Business partners, joint ventures, external platforms, and co-branded services',
    riskEmphasis: ['reputational', 'exit_strategy', 'strategic_alignment', 'concentration'],
    keyQuestionAreas: [
      'Strategic & Reputational Risk',
      'Exit Strategy',
      'Concentration Risk',
      'Contract Status',
    ],
  },
  general: {
    archetype: 'general',
    label: 'General Third Party',
    description: 'Standard vendor or service provider',
    riskEmphasis: ['operational', 'financial', 'compliance'],
    keyQuestionAreas: [
      'Criticality Assessment',
      'Financial & Operational Significance',
      'Contract Status',
    ],
  },
};

const CATEGORY_TO_ARCHETYPE: Record<ServiceCategory, VendorArchetype> = {
  cloud_data_services: 'technology_data_processor',
  it_telecom_services: 'technology_data_processor',
  info_cyber_security: 'technology_data_processor',
  financial_insurance_services: 'financial_services',
  exchange_clearing_services: 'financial_services',
  legal_audit_consulting: 'professional_services',
  facilities_real_estate: 'operational_support',
  physical_security: 'operational_support',
  transport_delivery: 'operational_support',
  office_support_supplies: 'operational_support',
  human_resources_services: 'operational_support',
  external_portals_platforms: 'strategic_partner',
  marketing_services: 'strategic_partner',
  data_research_subscription: 'technology_data_processor',
  other: 'general',
};

const PROVIDER_TYPE_ARCHETYPE_OVERRIDE: Partial<Record<ProviderType, VendorArchetype>> = {
  tpsp_business_partner: 'strategic_partner',
  tpsp_outsourced_group: 'strategic_partner',
  tpsp_outsourced_external: 'operational_service_provider',
};

export function determineVendorArchetype(
  serviceCategory: ServiceCategory,
  providerType: ProviderType
): VendorArchetype {
  const providerOverride = PROVIDER_TYPE_ARCHETYPE_OVERRIDE[providerType];
  if (providerOverride) {
    return providerOverride;
  }
  return CATEGORY_TO_ARCHETYPE[serviceCategory] || 'general';
}

export function getVendorProfile(
  serviceCategory: ServiceCategory,
  providerType: ProviderType
): VendorProfile {
  const archetype = determineVendorArchetype(serviceCategory, providerType);
  return VENDOR_ARCHETYPES[archetype];
}

export function isQuestionRelevantForProfile(
  config: ProfileQuestionConfig | undefined,
  archetype: VendorArchetype,
  serviceCategory: ServiceCategory,
  providerType: ProviderType,
  contextFlags: {
    hasDataAccess?: boolean;
    usesSubcontractors?: boolean;
    hasFormalContract?: boolean;
    isCritical?: boolean;
  } = {}
): boolean {
  if (!config) return true;

  if (config.showForArchetypes && config.showForArchetypes.length > 0) {
    if (!config.showForArchetypes.includes(archetype)) return false;
  }

  if (config.excludeForArchetypes && config.excludeForArchetypes.includes(archetype)) {
    return false;
  }

  if (config.showForCategories && config.showForCategories.length > 0) {
    if (!config.showForCategories.includes(serviceCategory)) return false;
  }

  if (config.excludeForCategories && config.excludeForCategories.includes(serviceCategory)) {
    return false;
  }

  if (config.showForProviderTypes && config.showForProviderTypes.length > 0) {
    if (!config.showForProviderTypes.includes(providerType)) return false;
  }

  if (config.excludeForProviderTypes && config.excludeForProviderTypes.includes(providerType)) {
    return false;
  }

  if (config.showWhenDataAccess !== undefined && contextFlags.hasDataAccess !== undefined) {
    if (config.showWhenDataAccess && !contextFlags.hasDataAccess) return false;
  }

  if (config.showWhenSubcontractors !== undefined && contextFlags.usesSubcontractors !== undefined) {
    if (config.showWhenSubcontractors && !contextFlags.usesSubcontractors) return false;
  }

  if (config.showWhenFormalContract !== undefined && contextFlags.hasFormalContract !== undefined) {
    if (config.showWhenFormalContract && !contextFlags.hasFormalContract) return false;
  }

  if (config.showWhenCritical !== undefined && contextFlags.isCritical !== undefined) {
    if (config.showWhenCritical && !contextFlags.isCritical) return false;
  }

  return true;
}

export function getQuestionPriority(
  config: ProfileQuestionConfig | undefined,
  archetype: VendorArchetype,
  basePriority: number = 1
): number {
  if (!config) return basePriority;

  let priority = basePriority;

  if (config.priorityMultiplier) {
    priority *= config.priorityMultiplier;
  }

  if (config.isRequiredFor && config.isRequiredFor.includes(archetype)) {
    priority *= 2;
  }

  return priority;
}

export const ARCHETYPE_WEIGHT_ADJUSTMENTS: Record<VendorArchetype, Partial<Record<string, number>>> = {
  technology_data_processor: {
    weight_data_sensitivity: 1.3,
    weight_access_level: 1.2,
    weight_operational_maturity: 1.1,
  },
  financial_services: {
    weight_legal_regulatory: 1.3,
    weight_concentration: 1.2,
    weight_financial_resilience: 1.2,
  },
  professional_services: {
    weight_legal_regulatory: 1.2,
    weight_subcontractor: 1.1,
  },
  operational_support: {
    weight_operational_maturity: 1.2,
    weight_dependency: 1.1,
  },
  strategic_partner: {
    weight_strategic_reputational: 1.3,
    weight_concentration: 1.2,
  },
  general: {},
};

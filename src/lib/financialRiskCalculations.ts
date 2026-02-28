import type { TierLevel, ServiceCategory } from '../types';

export interface FinancialRiskEstimate {
  ale: number; // Annual Loss Exposure in CAD
  lossRangeLow: number; // 5th percentile
  lossRangeHigh: number; // 95th percentile
  lossEventFrequency: number; // Expected events per year
  lossMagnitude: number; // Expected loss per event
  drivers: LossDriver[];
}

export interface LossDriver {
  factor: string;
  contribution: number; // percentage of total ALE
  description: string;
}

// Loss Event Frequency (LEF) by tier — probability proxy
// Represents expected number of material loss events per year
const TIER_FREQUENCY: Record<TierLevel, { min: number; max: number; expected: number }> = {
  tier_5_critical: { min: 0.3, max: 1.5, expected: 0.8 },
  tier_4_high: { min: 0.15, max: 0.8, expected: 0.4 },
  tier_3_moderate: { min: 0.05, max: 0.3, expected: 0.15 },
  tier_2_low: { min: 0.01, max: 0.1, expected: 0.05 },
  tier_1_informational: { min: 0.001, max: 0.05, expected: 0.01 },
};

// Loss Magnitude Multipliers by category
// Expressed as multipliers of contract value
const CATEGORY_MAGNITUDE: Partial<Record<ServiceCategory, number>> = {
  cloud_data_services: 3.5,
  info_cyber_security: 3.0,
  it_telecom_services: 2.5,
  financial_insurance_services: 2.5,
  exchange_clearing_services: 3.0,
  external_portals_platforms: 2.0,
  legal_audit_consulting: 1.5,
  human_resources_services: 1.5,
  facilities_real_estate: 1.2,
  physical_security: 1.3,
  office_support_supplies: 1.0,
  transport_delivery: 1.2,
  marketing_services: 1.3,
  data_research_subscription: 1.5,
  other: 1.5,
};

// Data sensitivity multiplier — increases loss magnitude
const DATA_SENSITIVITY_MULTIPLIER: Record<string, number> = {
  highly_sensitive: 2.0,
  sensitive: 1.5,
  internal: 1.2,
  public: 1.0,
};

// Regulatory penalty estimate ranges (CAD) by tier
const REGULATORY_PENALTY_RANGE: Record<TierLevel, { min: number; max: number }> = {
  tier_5_critical: { min: 500000, max: 5000000 },
  tier_4_high: { min: 100000, max: 1000000 },
  tier_3_moderate: { min: 25000, max: 250000 },
  tier_2_low: { min: 5000, max: 50000 },
  tier_1_informational: { min: 0, max: 10000 },
};

interface CalculateALEInput {
  tier: TierLevel;
  contractValueCAD: number;
  serviceCategory: ServiceCategory;
  handlesSensitiveData: boolean;
  dataSensitivityLevel?: string;
  incidentCount?: number; // historical incidents
  isCritical?: boolean;
  hasSystemAccess?: boolean;
}

export function calculateALE(input: CalculateALEInput): FinancialRiskEstimate {
  const {
    tier,
    contractValueCAD,
    serviceCategory,
    handlesSensitiveData,
    dataSensitivityLevel,
    incidentCount = 0,
    isCritical = false,
    hasSystemAccess = false,
  } = input;

  const baseContractValue = Math.max(contractValueCAD || 10000, 10000);

  // 1. Loss Event Frequency
  const tierFreq = TIER_FREQUENCY[tier] || TIER_FREQUENCY.tier_3_moderate;
  let lef = tierFreq.expected;

  // Adjust for incident history
  if (incidentCount > 0) {
    lef *= 1 + (incidentCount * 0.15);
  }

  // Critical vendors have higher frequency exposure
  if (isCritical) {
    lef *= 1.3;
  }

  // 2. Loss Magnitude
  const categoryMultiplier = CATEGORY_MAGNITUDE[serviceCategory] || 1.5;
  let baseMagnitude = baseContractValue * categoryMultiplier;

  // Data sensitivity adjustment
  if (handlesSensitiveData) {
    const sensMultiplier = dataSensitivityLevel
      ? DATA_SENSITIVITY_MULTIPLIER[dataSensitivityLevel] || 1.5
      : 1.5;
    baseMagnitude *= sensMultiplier;
  }

  // System access increases potential loss
  if (hasSystemAccess) {
    baseMagnitude *= 1.25;
  }

  // Add regulatory penalty estimate
  const regPenalty = REGULATORY_PENALTY_RANGE[tier] || REGULATORY_PENALTY_RANGE.tier_3_moderate;
  const avgRegPenalty = (regPenalty.min + regPenalty.max) / 2;
  const totalMagnitude = baseMagnitude + avgRegPenalty;

  // 3. ALE = Frequency × Magnitude
  const ale = Math.round(lef * totalMagnitude);

  // 4. Loss Range (5th-95th percentile using tier frequency range)
  const lossRangeLow = Math.round(tierFreq.min * baseMagnitude * 0.5);
  const lossRangeHigh = Math.round(tierFreq.max * (baseMagnitude * 1.5 + regPenalty.max));

  // 5. Loss Drivers
  const drivers: LossDriver[] = [];
  const totalContributions = baseMagnitude + avgRegPenalty;

  const directLoss = baseContractValue * categoryMultiplier;
  drivers.push({
    factor: 'Direct Service Loss',
    contribution: Math.round((directLoss / totalContributions) * 100),
    description: `Service disruption or failure costs based on ${serviceCategory.replace(/_/g, ' ')}`,
  });

  if (handlesSensitiveData) {
    const dataLoss = directLoss * ((dataSensitivityLevel ? DATA_SENSITIVITY_MULTIPLIER[dataSensitivityLevel] || 1.5 : 1.5) - 1);
    drivers.push({
      factor: 'Data Breach Impact',
      contribution: Math.round((dataLoss / totalContributions) * 100),
      description: 'Additional costs from potential data breach (notification, remediation, legal)',
    });
  }

  drivers.push({
    factor: 'Regulatory Penalties',
    contribution: Math.round((avgRegPenalty / totalContributions) * 100),
    description: 'Estimated OSFI/regulatory fines and enforcement costs',
  });

  if (hasSystemAccess) {
    const sysLoss = baseMagnitude * 0.2;
    drivers.push({
      factor: 'System Access Risk',
      contribution: Math.round((sysLoss / totalContributions) * 100),
      description: 'Additional exposure from vendor system access privileges',
    });
  }

  return {
    ale,
    lossRangeLow,
    lossRangeHigh,
    lossEventFrequency: Math.round(lef * 100) / 100,
    lossMagnitude: Math.round(totalMagnitude),
    drivers,
  };
}

export function formatCAD(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function calculatePortfolioALE(
  vendors: Array<{
    tier?: TierLevel;
    contract_value_cad?: number;
    service_category: ServiceCategory;
    handles_sensitive_data: boolean;
    is_critical: boolean;
    has_system_access: boolean;
  }>
): number {
  return vendors.reduce((total, vendor) => {
    if (!vendor.tier) return total;
    const estimate = calculateALE({
      tier: vendor.tier,
      contractValueCAD: vendor.contract_value_cad || 0,
      serviceCategory: vendor.service_category,
      handlesSensitiveData: vendor.handles_sensitive_data,
      isCritical: vendor.is_critical,
      hasSystemAccess: vendor.has_system_access,
    });
    return total + estimate.ale;
  }, 0);
}

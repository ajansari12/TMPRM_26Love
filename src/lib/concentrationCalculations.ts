/**
 * Concentration Risk Calculations
 * HHI (Herfindahl-Hirschman Index) and hub detection utilities
 */

export interface HHIResult {
  score: number; // 0-10000 scale
  level: 'low' | 'moderate' | 'high';
  label: string;
  description: string;
  topContributors: Array<{ name: string; share: number; contribution: number }>;
}

/**
 * Calculate HHI for a set of items with market shares
 * HHI = sum of squared market shares (0-10,000 scale)
 * < 1,500 = Low concentration (competitive)
 * 1,500-2,500 = Moderate concentration
 * > 2,500 = High concentration
 */
export function calculateHHI(
  items: Array<{ name: string; value: number }>
): HHIResult {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return {
      score: 0,
      level: 'low',
      label: 'No Data',
      description: 'No concentration data available',
      topContributors: [],
    };
  }

  const shares = items.map((item) => ({
    name: item.name,
    share: (item.value / total) * 100,
    contribution: 0,
  }));

  // HHI = sum of squared percentage shares
  const hhi = shares.reduce((sum, s) => {
    s.contribution = s.share * s.share;
    return sum + s.contribution;
  }, 0);

  const score = Math.round(hhi);

  let level: HHIResult['level'];
  let label: string;
  let description: string;

  if (score < 1500) {
    level = 'low';
    label = 'Low Concentration';
    description = 'Well-diversified portfolio with no dominant concentrations';
  } else if (score < 2500) {
    level = 'moderate';
    label = 'Moderate Concentration';
    description = 'Some concentration exists; monitor for further consolidation';
  } else {
    level = 'high';
    label = 'High Concentration';
    description = 'Significant concentration risk; diversification recommended';
  }

  return {
    score,
    level,
    label,
    description,
    topContributors: shares
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 5)
      .map((s) => ({
        name: s.name,
        share: Math.round(s.share * 10) / 10,
        contribution: Math.round(s.contribution),
      })),
  };
}

/**
 * Detect single-source dependencies (categories with only 1 vendor)
 */
export function detectSingleSourceDependencies(
  vendors: Array<{ name: string; category: string; value: number }>
): Array<{ category: string; vendorName: string; value: number }> {
  const categoryMap = new Map<string, Array<{ name: string; value: number }>>();

  vendors.forEach((v) => {
    const existing = categoryMap.get(v.category) || [];
    existing.push({ name: v.name, value: v.value });
    categoryMap.set(v.category, existing);
  });

  const singleSources: Array<{ category: string; vendorName: string; value: number }> = [];
  categoryMap.forEach((vendorList, category) => {
    if (vendorList.length === 1 && vendorList[0].value > 0) {
      singleSources.push({
        category,
        vendorName: vendorList[0].name,
        value: vendorList[0].value,
      });
    }
  });

  return singleSources.sort((a, b) => b.value - a.value);
}

/**
 * Detect shared subcontractor hubs
 * A "hub" is a 4th party used by multiple direct vendors
 */
export interface SubcontractorHub {
  subcontractorName: string;
  directVendors: string[];
  riskScore: number; // number of connections
}

export function detectSubcontractorHubs(
  vendors: Array<{
    name: string;
    subcontractors: string[];
  }>
): SubcontractorHub[] {
  const subMap = new Map<string, string[]>();

  vendors.forEach((v) => {
    v.subcontractors.forEach((sub) => {
      const existing = subMap.get(sub) || [];
      if (!existing.includes(v.name)) {
        existing.push(v.name);
      }
      subMap.set(sub, existing);
    });
  });

  const hubs: SubcontractorHub[] = [];
  subMap.forEach((directVendors, subName) => {
    if (directVendors.length >= 2) {
      hubs.push({
        subcontractorName: subName,
        directVendors,
        riskScore: directVendors.length,
      });
    }
  });

  return hubs.sort((a, b) => b.riskScore - a.riskScore);
}

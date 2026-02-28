import { useMemo } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { DefenseLine } from '../types/organization';

interface DefenseLineAccess {
  defenseLine: DefenseLine | null;
  isReadOnly: boolean;
  is1A: boolean;
  is1B: boolean;
  is2nd: boolean;
  is3rd: boolean;
  isSeniorManagement: boolean;
  isAdmin: boolean;
  canSeeAllOrgRequests: boolean;
  canSeeAllOrgVendors: boolean;
  canSeeRiskAssessment: boolean;
  canSeeContracts: boolean;
  canSeeMonitoring: boolean;
  canSeeCompliance: boolean;
  canSeeBoardReports: boolean;
  canSeeAssessmentAnalytics: boolean;
  canCreateOnboardingRequests: boolean;
  canReportIncidents: boolean;
}

const RISK_ASSESSMENT_LINES: DefenseLine[] = ['1b', '2nd', '3rd', 'admin', 'senior_management'];
const CONTRACT_LINES: DefenseLine[] = ['1b', '2nd', '3rd', 'admin'];
const MONITORING_LINES: DefenseLine[] = ['1b', '2nd', '3rd', 'admin', 'senior_management'];
const COMPLIANCE_LINES: DefenseLine[] = ['2nd', '3rd', 'admin', 'senior_management'];
const BOARD_REPORT_LINES: DefenseLine[] = ['2nd', '3rd', 'admin', 'senior_management'];
const ANALYTICS_LINES: DefenseLine[] = ['1b', '2nd', '3rd', 'admin', 'senior_management'];

export function useDefenseLineAccess(): DefenseLineAccess {
  const { defenseLine, isAdmin, isPlatformAdmin } = useOrganization();

  return useMemo(() => {
    const effective = defenseLine;
    const adminOrPlatform = isAdmin || isPlatformAdmin;

    const is1A = effective === '1a';
    const is1B = effective === '1b';
    const is2nd = effective === '2nd';
    const is3rd = effective === '3rd';
    const isSeniorManagement = effective === 'senior_management';

    return {
      defenseLine: effective,
      isReadOnly: is3rd && !adminOrPlatform,
      is1A,
      is1B,
      is2nd,
      is3rd,
      isSeniorManagement,
      isAdmin: isAdmin || isPlatformAdmin,
      canSeeAllOrgRequests: !is1A || adminOrPlatform,
      canSeeAllOrgVendors: !is1A || adminOrPlatform,
      canSeeRiskAssessment: adminOrPlatform || (effective !== null && RISK_ASSESSMENT_LINES.includes(effective)),
      canSeeContracts: adminOrPlatform || (effective !== null && CONTRACT_LINES.includes(effective)),
      canSeeMonitoring: adminOrPlatform || (effective !== null && MONITORING_LINES.includes(effective)),
      canSeeCompliance: adminOrPlatform || (effective !== null && COMPLIANCE_LINES.includes(effective)),
      canSeeBoardReports: adminOrPlatform || (effective !== null && BOARD_REPORT_LINES.includes(effective)),
      canSeeAssessmentAnalytics: adminOrPlatform || (effective !== null && ANALYTICS_LINES.includes(effective)),
      canCreateOnboardingRequests: !is3rd || adminOrPlatform,
      canReportIncidents: !is3rd || adminOrPlatform,
    };
  }, [defenseLine, isAdmin, isPlatformAdmin]);
}

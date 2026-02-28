// Valid vendor status transitions aligned with OSFI B-10 lifecycle
export const VENDOR_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_approval: ['active', 'onboarding', 'under_review', 'terminated'],
  onboarding: ['active', 'under_review', 'suspended', 'terminated'],
  active: ['under_review', 'review_due', 'non_compliant', 'suspended', 'offboarding'],
  review_due: ['under_review', 'active', 'non_compliant', 'suspended', 'offboarding'],
  under_review: ['active', 'non_compliant', 'suspended', 'offboarding'],
  non_compliant: ['under_review', 'active', 'suspended', 'offboarding'],
  suspended: ['under_review', 'active', 'offboarding', 'terminated'],
  offboarding: ['terminated'],
  terminated: [], // Terminal state — no transitions allowed
};

export function getAvailableTransitions(currentStatus: string): string[] {
  return VENDOR_STATUS_TRANSITIONS[currentStatus] || [];
}

export function isValidTransition(from: string, to: string): boolean {
  const allowed = VENDOR_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export const STATUS_TRANSITION_DESCRIPTIONS: Record<string, string> = {
  active: 'Vendor is fully operational and monitored',
  under_review: 'Risk reassessment or investigation in progress',
  review_due: 'Periodic review date has been reached or is approaching',
  non_compliant: 'Vendor has failed compliance requirements — remediation needed',
  suspended: 'Vendor operations suspended pending investigation or remediation',
  offboarding: 'Exit process initiated — following exit strategy',
  terminated: 'Relationship fully terminated — record retained for audit',
  onboarding: 'Initial setup and due diligence in progress',
  pending_approval: 'Awaiting initial approval to proceed',
};

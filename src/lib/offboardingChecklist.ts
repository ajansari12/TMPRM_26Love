export interface OffboardingTaskTemplate {
  task_name: string;
  task_category: 'data' | 'contract' | 'access' | 'financial' | 'communication' | 'documentation';
  description: string;
  is_required: boolean;
  sort_order: number;
}

export const DEFAULT_OFFBOARDING_TASKS: OffboardingTaskTemplate[] = [
  {
    task_name: 'Confirm data return/destruction plan',
    task_category: 'data',
    description: 'Review and confirm the plan for returning or securely destroying organizational data held by the vendor',
    is_required: true,
    sort_order: 1,
  },
  {
    task_name: 'Execute data return to organization',
    task_category: 'data',
    description: 'Ensure all organizational data is returned in agreed format and verified for completeness',
    is_required: true,
    sort_order: 2,
  },
  {
    task_name: 'Verify vendor data deletion',
    task_category: 'data',
    description: 'Confirm that vendor has deleted all organizational data from their systems and backups',
    is_required: true,
    sort_order: 3,
  },
  {
    task_name: 'Obtain data destruction certificate',
    task_category: 'data',
    description: 'Receive formal certification from vendor confirming secure destruction of all organizational data',
    is_required: true,
    sort_order: 4,
  },
  {
    task_name: 'Issue formal termination notice',
    task_category: 'contract',
    description: 'Send official termination notice to vendor as per contract requirements',
    is_required: true,
    sort_order: 5,
  },
  {
    task_name: 'Review termination clauses and obligations',
    task_category: 'contract',
    description: 'Ensure all contractual termination clauses, notice periods, and obligations are being met',
    is_required: true,
    sort_order: 6,
  },
  {
    task_name: 'Settle outstanding invoices',
    task_category: 'contract',
    description: 'Process and pay all pending invoices from vendor',
    is_required: true,
    sort_order: 7,
  },
  {
    task_name: 'Confirm contract wind-down period',
    task_category: 'contract',
    description: 'Verify compliance with any required wind-down or transition period stipulated in contract',
    is_required: true,
    sort_order: 8,
  },
  {
    task_name: 'Revoke vendor system access credentials',
    task_category: 'access',
    description: 'Disable all vendor user accounts and revoke access credentials to organizational systems',
    is_required: true,
    sort_order: 9,
  },
  {
    task_name: 'Disable VPN/remote access',
    task_category: 'access',
    description: 'Remove vendor from VPN access lists and disable any remote access capabilities',
    is_required: true,
    sort_order: 10,
  },
  {
    task_name: 'Collect physical access badges/keys',
    task_category: 'access',
    description: 'Retrieve all physical access cards, badges, keys, and other entry devices from vendor personnel',
    is_required: true,
    sort_order: 11,
  },
  {
    task_name: 'Remove vendor from distribution lists',
    task_category: 'access',
    description: 'Remove vendor contacts from all email distribution lists, shared drives, and collaboration tools',
    is_required: true,
    sort_order: 12,
  },
  {
    task_name: 'Complete final payment reconciliation',
    task_category: 'financial',
    description: 'Reconcile all payments, credits, and financial obligations with vendor',
    is_required: true,
    sort_order: 13,
  },
  {
    task_name: 'Resolve any outstanding disputes',
    task_category: 'financial',
    description: 'Address and resolve any pending financial or service disputes before final termination',
    is_required: true,
    sort_order: 14,
  },
  {
    task_name: 'Close purchase orders',
    task_category: 'financial',
    description: 'Close all open purchase orders and confirm no further financial commitments exist',
    is_required: true,
    sort_order: 15,
  },
  {
    task_name: 'Notify internal stakeholders',
    task_category: 'communication',
    description: 'Inform all relevant internal stakeholders about vendor termination and transition plans',
    is_required: true,
    sort_order: 16,
  },
  {
    task_name: 'Notify affected business units',
    task_category: 'communication',
    description: 'Communicate with business units dependent on vendor services about termination timeline',
    is_required: true,
    sort_order: 17,
  },
  {
    task_name: 'Update vendor status in all systems',
    task_category: 'communication',
    description: 'Update vendor status to terminated in procurement, finance, and other relevant systems',
    is_required: true,
    sort_order: 18,
  },
  {
    task_name: 'Archive all vendor documents',
    task_category: 'documentation',
    description: 'Archive all contracts, correspondence, and documentation related to vendor relationship',
    is_required: true,
    sort_order: 19,
  },
  {
    task_name: 'Complete final performance review',
    task_category: 'documentation',
    description: 'Document final assessment of vendor performance throughout relationship lifecycle',
    is_required: true,
    sort_order: 20,
  },
  {
    task_name: 'Document lessons learned',
    task_category: 'documentation',
    description: 'Capture lessons learned from vendor relationship for future vendor selection and management',
    is_required: true,
    sort_order: 21,
  },
  {
    task_name: 'Update vendor inventory reports',
    task_category: 'documentation',
    description: 'Update all vendor inventory and risk reports to reflect terminated status',
    is_required: true,
    sort_order: 22,
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  data: 'Data Management',
  contract: 'Contract & Legal',
  access: 'Access Control',
  financial: 'Financial Settlement',
  communication: 'Communication',
  documentation: 'Documentation',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Pending' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  not_applicable: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Not Applicable' },
};

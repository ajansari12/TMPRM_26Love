import { Vendor } from '../../types';

export interface DashboardStats {
  totalVendors: number;
  criticalVendors: number;
  pendingApprovals: number;
  upcomingReviews: number;
  tierDistribution: Array<{ name: string; value: number; color: string }>;
  statusDistribution: Array<{ name: string; value: number }>;
  riskDistribution: Array<{ range: string; count: number }>;
}

export interface ComplianceStats {
  total: number;
  compliant: number;
  partially_compliant: number;
  non_compliant: number;
  not_applicable: number;
  not_assessed: number;
  score: number;
}

export interface ExceptionStats {
  active: number;
  pending: number;
  expiringSoon: number;
}

export interface ReassessmentDue {
  id: string;
  legal_name: string;
  tier: string | undefined;
  next_review_date: string;
  daysUntilDue: number;
  isOverdue: boolean;
}

export interface PendingDocumentRequest {
  id: string;
  vendor_id: string | null;
  document_type_code: string;
  document_type_name: string;
  status: string;
  is_critical: boolean;
  blocks_activation: boolean;
  due_date: string;
  days_overdue: number;
  urgency: string;
  vendor_name: string | null;
}

export interface MyActiveRequest {
  id: string;
  request_number: string;
  vendor_legal_name: string;
  status: string;
  updated_at: string;
}

export interface ReviewQueueItem {
  id: string;
  request_number: string;
  vendor_legal_name: string;
  status: string;
  submitted_at: string;
  preliminary_risk_tier: string | null;
  daysWaiting: number;
}

export interface ReviewQueueMetrics {
  averageWaitTime: number;
  longestWaiting: number;
  totalInQueue: number;
}

export interface RiskOverviewData {
  pending2ndReviews: number;
  vendorsNeedingReassessment: number;
  riskExceptionsExpiring: number;
  recentHighIncidents: number;
  trends: {
    pending2ndReviews: number;
    reassessments: number;
    exceptions: number;
    incidents: number;
  };
}

export interface AuditFocusData {
  recentAuditEntries: number;
  osfiComplianceScore: number;
  upcomingAttestations: number;
}

export interface SeniorApprovalMetrics {
  totalContractValue: number;
  criticalCount: number;
  averageContractValue: number;
}

export interface SystemHealthData {
  pendingWorkflows: number;
  oldestPendingDays: number;
  bottleneckStage: string | null;
  systemScore: number;
}

export interface DashboardData {
  stats: DashboardStats | null;
  complianceStats: ComplianceStats | null;
  exceptionStats: ExceptionStats | null;
  criticalVendors: Vendor[];
  upcomingReviews: Vendor[];
  reassessmentsDue: ReassessmentDue[];
  pendingDocuments: PendingDocumentRequest[];
  loading: boolean;
  // Role-specific
  myActiveRequests: MyActiveRequest[];
  reviewQueue: ReviewQueueItem[];
  reviewQueueMetrics: ReviewQueueMetrics | null;
  riskOverview: RiskOverviewData | null;
  auditFocus: AuditFocusData | null;
  seniorApprovals: MyActiveRequest[];
  seniorApprovalMetrics: SeniorApprovalMetrics | null;
  systemHealth: SystemHealthData | null;
  roleDataLoading: boolean;
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Vendor } from '../../types';
import type {
  DashboardStats,
  ComplianceStats,
  ExceptionStats,
  ReassessmentDue,
  PendingDocumentRequest,
  MyActiveRequest,
  ReviewQueueItem,
  ReviewQueueMetrics,
  RiskOverviewData,
  AuditFocusData,
  SeniorApprovalMetrics,
  SystemHealthData,
  DashboardData,
} from './types';

// --- Data processing helpers ---

function calculateStats(vendors: Vendor[]): DashboardStats {
  const totalVendors = vendors.length;
  const criticalVendors = vendors.filter(
    (v) => v.tier === 'tier_5_critical' || v.is_critical
  ).length;
  const pendingApprovals = vendors.filter((v) => v.status === 'pending_approval').length;

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const upcomingReviews = vendors.filter((v) => {
    if (!v.next_review_date) return false;
    return new Date(v.next_review_date) <= thirtyDaysFromNow;
  }).length;

  const tierDistribution = [
    { name: 'Tier 5 - Critical', value: vendors.filter((v) => v.tier === 'tier_5_critical').length, color: '#ef4444' },
    { name: 'Tier 4 - High', value: vendors.filter((v) => v.tier === 'tier_4_high').length, color: '#f97316' },
    { name: 'Tier 3 - Moderate', value: vendors.filter((v) => v.tier === 'tier_3_moderate').length, color: '#f59e0b' },
    { name: 'Tier 2 - Low', value: vendors.filter((v) => v.tier === 'tier_2_low').length, color: '#10b981' },
    { name: 'Tier 1 - Informational', value: vendors.filter((v) => v.tier === 'tier_1_informational').length, color: '#64748b' },
    { name: 'Not Assessed', value: vendors.filter((v) => !v.tier).length, color: '#94a3b8' },
  ].filter((item) => item.value > 0);

  const statusDistribution = [
    { name: 'Active', value: vendors.filter((v) => v.status === 'active').length },
    { name: 'Pending', value: vendors.filter((v) => v.status === 'pending_approval').length },
    { name: 'Under Review', value: vendors.filter((v) => v.status === 'under_review').length },
    { name: 'Terminated', value: vendors.filter((v) => v.status === 'terminated').length },
  ].filter((item) => item.value > 0);

  const riskDistribution = [
    { range: 'Critical (15+)', count: vendors.filter((v) => v.risk_rating && v.risk_rating >= 15).length },
    { range: 'High (10-15)', count: vendors.filter((v) => v.risk_rating && v.risk_rating >= 10 && v.risk_rating < 15).length },
    { range: 'Moderate (5-10)', count: vendors.filter((v) => v.risk_rating && v.risk_rating >= 5 && v.risk_rating < 10).length },
    { range: 'Low (2-5)', count: vendors.filter((v) => v.risk_rating && v.risk_rating >= 2 && v.risk_rating < 5).length },
    { range: 'Minimal (<2)', count: vendors.filter((v) => v.risk_rating && v.risk_rating < 2).length },
  ];

  return { totalVendors, criticalVendors, pendingApprovals, upcomingReviews, tierDistribution, statusDistribution, riskDistribution };
}

function getCriticalVendors(vendors: Vendor[]): Vendor[] {
  return vendors.filter((v) => v.tier === 'tier_5_critical' || v.is_critical).slice(0, 5);
}

function getUpcomingReviews(vendors: Vendor[]): Vendor[] {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return vendors
    .filter((v) => v.next_review_date && new Date(v.next_review_date) <= thirtyDaysFromNow)
    .sort((a, b) => new Date(a.next_review_date!).getTime() - new Date(b.next_review_date!).getTime())
    .slice(0, 5);
}

function calculateReassessmentsDue(vendors: Vendor[]): ReassessmentDue[] {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const now = new Date();
  return vendors
    .filter((v) => v.status === 'active' && v.next_review_date && new Date(v.next_review_date) <= thirtyDaysFromNow)
    .map((v) => {
      const daysUntilDue = Math.ceil((new Date(v.next_review_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { id: v.id, legal_name: v.legal_name, tier: v.tier, next_review_date: v.next_review_date!, daysUntilDue, isOverdue: daysUntilDue < 0 };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

// --- Fetch functions ---

interface GeneralDashboardResult {
  stats: DashboardStats;
  complianceStats: ComplianceStats;
  exceptionStats: ExceptionStats;
  criticalVendors: Vendor[];
  upcomingReviews: Vendor[];
  reassessmentsDue: ReassessmentDue[];
  pendingDocuments: PendingDocumentRequest[];
}

async function fetchGeneralDashboardData(orgId: string): Promise<GeneralDashboardResult> {
  const [vendorsRes, requirementsRes, complianceRes, exceptionsRes, ddRequestsRes] = await Promise.all([
    supabase.from('vendors').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
    supabase.from('osfi_b10_requirements').select('id'),
    supabase.from('osfi_b10_compliance_status').select('status').eq('organization_id', orgId).is('vendor_id', null),
    supabase.from('risk_exceptions').select('id, status, expiry_date').eq('organization_id', orgId),
    supabase.from('due_diligence_document_requests')
      .select(`id, vendor_id, document_type_code, status, is_critical, blocks_activation, due_date, document_type:due_diligence_document_types(name), vendor:vendors(legal_name)`)
      .eq('organization_id', orgId).in('status', ['requested', 'received', 'under_review']).order('due_date', { ascending: true }).limit(10),
  ]);

  if (vendorsRes.error) throw vendorsRes.error;
  const vendors = vendorsRes.data || [];

  // Compliance stats
  const totalRequirements = requirementsRes.data?.length || 0;
  const statuses = complianceRes.data || [];
  const complianceStats: ComplianceStats = {
    total: totalRequirements,
    compliant: statuses.filter((s) => s.status === 'compliant').length,
    partially_compliant: statuses.filter((s) => s.status === 'partially_compliant').length,
    non_compliant: statuses.filter((s) => s.status === 'non_compliant').length,
    not_applicable: statuses.filter((s) => s.status === 'not_applicable').length,
    not_assessed: totalRequirements - statuses.length,
    score: 0,
  };
  const assessed = complianceStats.total - complianceStats.not_assessed - complianceStats.not_applicable;
  complianceStats.score = assessed > 0 ? ((complianceStats.compliant + complianceStats.partially_compliant * 0.5) / assessed) * 100 : 0;

  // Exception stats
  const exceptions = exceptionsRes.data || [];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const exceptionStats: ExceptionStats = {
    active: exceptions.filter((e) => e.status === 'approved').length,
    pending: exceptions.filter((e) => e.status === 'pending').length,
    expiringSoon: exceptions.filter((e) => {
      if (e.status !== 'approved' || !e.expiry_date) return false;
      const expiryDate = new Date(e.expiry_date);
      return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
    }).length,
  };

  // Pending documents
  const today = new Date();
  const pendingDocuments: PendingDocumentRequest[] = (ddRequestsRes.data || []).map((req) => {
    const dueDate = new Date(req.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    let urgency = 'on_track';
    if (daysOverdue > 0) urgency = 'overdue';
    else if (daysOverdue >= -3) urgency = 'critical';
    else if (daysOverdue >= -7) urgency = 'soon';

    return {
      id: req.id, vendor_id: req.vendor_id, document_type_code: req.document_type_code,
      document_type_name: (req.document_type as unknown as { name: string } | null)?.name || req.document_type_code,
      status: req.status, is_critical: req.is_critical, blocks_activation: req.blocks_activation,
      due_date: req.due_date, days_overdue: daysOverdue, urgency,
      vendor_name: (req.vendor as unknown as { legal_name: string } | null)?.legal_name || null,
    };
  });

  return {
    stats: calculateStats(vendors),
    complianceStats,
    exceptionStats,
    criticalVendors: getCriticalVendors(vendors),
    upcomingReviews: getUpcomingReviews(vendors),
    reassessmentsDue: calculateReassessmentsDue(vendors),
    pendingDocuments,
  };
}

interface RoleSpecificResult {
  myActiveRequests: MyActiveRequest[];
  reviewQueue: ReviewQueueItem[];
  reviewQueueMetrics: ReviewQueueMetrics | null;
  riskOverview: RiskOverviewData | null;
  auditFocus: AuditFocusData | null;
  seniorApprovals: MyActiveRequest[];
  seniorApprovalMetrics: SeniorApprovalMetrics | null;
  systemHealth: SystemHealthData | null;
}

async function fetchMyActiveRequests(orgId: string, userId: string): Promise<MyActiveRequest[]> {
  const { data, error } = await supabase
    .from('onboarding_requests')
    .select('id, request_number, vendor_legal_name, status, updated_at')
    .eq('requested_by', userId).eq('organization_id', orgId)
    .in('status', ['draft', 'submitted', '1b_review', '2nd_review', '1b_returned', '2nd_returned', 'pending_senior_approval'])
    .order('updated_at', { ascending: false }).limit(10);
  if (error) throw error;
  return data || [];
}

async function fetchReviewQueue(orgId: string): Promise<{ queue: ReviewQueueItem[]; metrics: ReviewQueueMetrics }> {
  const { data, error } = await supabase
    .from('onboarding_requests')
    .select('id, request_number, vendor_legal_name, status, submitted_at, preliminary_risk_tier')
    .eq('status', '1b_review').eq('organization_id', orgId)
    .order('submitted_at', { ascending: true }).limit(10);
  if (error) throw error;

  const now = new Date();
  const queue: ReviewQueueItem[] = (data || []).map((item) => ({
    ...item,
    daysWaiting: Math.floor((now.getTime() - new Date(item.submitted_at || '').getTime()) / (1000 * 60 * 60 * 24)),
  }));

  const metrics: ReviewQueueMetrics = queue.length > 0
    ? { averageWaitTime: Math.round(queue.reduce((sum, i) => sum + i.daysWaiting, 0) / queue.length), longestWaiting: Math.max(...queue.map(i => i.daysWaiting)), totalInQueue: queue.length }
    : { averageWaitTime: 0, longestWaiting: 0, totalInQueue: 0 };

  return { queue, metrics };
}

async function fetch2ndLineRiskOverview(orgId: string): Promise<RiskOverviewData> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orgVendors } = await supabase.from('vendors').select('id').eq('organization_id', orgId);
  const vendorIds = (orgVendors || []).map(v => v.id);

  const [pending2ndRes, pending2ndLastWeekRes, reassessmentsRes, reassessmentsLastWeekRes, exceptionsRes, incidentsRes, incidentsLastWeekRes] = await Promise.all([
    supabase.from('onboarding_requests').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', '2nd_review'),
    supabase.from('onboarding_requests').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', '2nd_review').lte('updated_at', sevenDaysAgo),
    supabase.from('assessment_tasks').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('task_type', ['periodic_reassessment', 'material_change', 'contract_renewal']).in('status', ['pending', 'in_progress']),
    supabase.from('assessment_tasks').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('task_type', ['periodic_reassessment', 'material_change', 'contract_renewal']).in('status', ['pending', 'in_progress']).lte('created_at', sevenDaysAgo),
    supabase.from('risk_exceptions').select('id, expiry_date', { count: 'exact' }).eq('organization_id', orgId).eq('status', 'approved').not('expiry_date', 'is', null),
    vendorIds.length > 0 ? supabase.from('incidents').select('id', { count: 'exact', head: true }).in('vendor_id', vendorIds).in('severity', ['high', 'critical']).gte('created_at', thirtyDaysAgo) : Promise.resolve({ count: 0, data: null, error: null }),
    vendorIds.length > 0 ? supabase.from('incidents').select('id', { count: 'exact', head: true }).in('vendor_id', vendorIds).in('severity', ['high', 'critical']).gte('created_at', sixtyDaysAgo).lte('created_at', thirtyDaysAgo) : Promise.resolve({ count: 0, data: null, error: null }),
  ]);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiringSoon = (exceptionsRes.data || []).filter((e) => {
    if (!e.expiry_date) return false;
    const expiryDate = new Date(e.expiry_date);
    return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
  }).length;

  const currentPending2nd = pending2ndRes.count || 0;
  const currentReassessments = reassessmentsRes.count || 0;
  const currentIncidents = incidentsRes.count || 0;

  return {
    pending2ndReviews: currentPending2nd,
    vendorsNeedingReassessment: currentReassessments,
    riskExceptionsExpiring: expiringSoon,
    recentHighIncidents: currentIncidents,
    trends: {
      pending2ndReviews: currentPending2nd - (pending2ndLastWeekRes.count || 0),
      reassessments: currentReassessments - (reassessmentsLastWeekRes.count || 0),
      exceptions: expiringSoon,
      incidents: currentIncidents - (incidentsLastWeekRes.count || 0),
    },
  };
}

async function fetch3rdLineAuditFocus(orgId: string): Promise<AuditFocusData> {
  const [auditRes, complianceRes, attestationsRes] = await Promise.all([
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('osfi_b10_compliance_status').select('status').eq('organization_id', orgId).is('vendor_id', null),
    supabase.from('attestations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).lte('due_date', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()).gte('due_date', new Date().toISOString()),
  ]);

  const statuses = complianceRes.data || [];
  const compliant = statuses.filter((s) => s.status === 'compliant').length;
  const partiallyCompliant = statuses.filter((s) => s.status === 'partially_compliant').length;
  const total = statuses.length;
  const score = total > 0 ? ((compliant + partiallyCompliant * 0.5) / total) * 100 : 0;

  return { recentAuditEntries: auditRes.count || 0, osfiComplianceScore: Math.round(score), upcomingAttestations: attestationsRes.count || 0 };
}

async function fetchSeniorApprovalsData(orgId: string): Promise<{ approvals: MyActiveRequest[]; metrics: SeniorApprovalMetrics }> {
  const { data, error } = await supabase
    .from('onboarding_requests')
    .select('id, request_number, vendor_legal_name, status, updated_at, vendor_id, preliminary_risk_tier')
    .eq('status', 'pending_senior_approval').eq('organization_id', orgId)
    .order('updated_at', { ascending: true }).limit(10);
  if (error) throw error;

  const approvals = data || [];
  let metrics: SeniorApprovalMetrics = { totalContractValue: 0, criticalCount: 0, averageContractValue: 0 };

  if (approvals.length > 0) {
    const vendorIds = approvals.filter(r => r.vendor_id).map(r => r.vendor_id);
    if (vendorIds.length > 0) {
      const { data: vendorData } = await supabase.from('vendors').select('id, annual_spend').in('id', vendorIds);
      const totalContractValue = (vendorData || []).reduce((sum, v) => sum + (v.annual_spend || 0), 0);
      metrics = {
        totalContractValue,
        criticalCount: approvals.filter(r => r.preliminary_risk_tier === 'critical' || r.preliminary_risk_tier === 'high').length,
        averageContractValue: vendorData && vendorData.length > 0 ? totalContractValue / vendorData.length : 0,
      };
    }
  }

  return { approvals, metrics };
}

async function fetchSystemHealthData(orgId: string): Promise<SystemHealthData> {
  const { data: pendingWorkflows, error } = await supabase
    .from('onboarding_requests')
    .select('id, status, submitted_at, updated_at')
    .eq('organization_id', orgId)
    .in('status', ['submitted', '1b_review', '2nd_review', 'pending_senior_approval', '1b_returned', '2nd_returned']);
  if (error) throw error;

  const workflows = pendingWorkflows || [];
  const now = new Date();

  let oldestDays = 0;
  if (workflows.length > 0) {
    const oldestDate = Math.min(...workflows.map(w => new Date(w.submitted_at || w.updated_at).getTime()));
    oldestDays = Math.floor((now.getTime() - oldestDate) / (1000 * 60 * 60 * 24));
  }

  const statusCounts: Record<string, number> = {};
  workflows.forEach(w => { statusCounts[w.status] = (statusCounts[w.status] || 0) + 1; });

  let bottleneckStage: string | null = null;
  let maxCount = 0;
  Object.entries(statusCounts).forEach(([status, count]) => {
    if (count > maxCount) { maxCount = count; bottleneckStage = status; }
  });

  let systemScore = 100;
  if (oldestDays > 30) systemScore -= 40;
  else if (oldestDays > 14) systemScore -= 20;
  else if (oldestDays > 7) systemScore -= 10;
  if (workflows.length > 50) systemScore -= 30;
  else if (workflows.length > 25) systemScore -= 15;
  else if (workflows.length > 10) systemScore -= 5;

  return { pendingWorkflows: workflows.length, oldestPendingDays: oldestDays, bottleneckStage, systemScore: Math.max(0, systemScore) };
}

async function fetchRoleSpecificData(orgId: string, userId: string, defenseLine: string): Promise<RoleSpecificResult> {
  const result: RoleSpecificResult = {
    myActiveRequests: [], reviewQueue: [], reviewQueueMetrics: null,
    riskOverview: null, auditFocus: null, seniorApprovals: [], seniorApprovalMetrics: null, systemHealth: null,
  };

  switch (defenseLine) {
    case '1a':
      result.myActiveRequests = await fetchMyActiveRequests(orgId, userId);
      break;
    case '1b': {
      const rq = await fetchReviewQueue(orgId);
      result.reviewQueue = rq.queue;
      result.reviewQueueMetrics = rq.metrics;
      break;
    }
    case '2nd':
      result.riskOverview = await fetch2ndLineRiskOverview(orgId);
      break;
    case '3rd':
      result.auditFocus = await fetch3rdLineAuditFocus(orgId);
      break;
    case 'senior_management': {
      const sa = await fetchSeniorApprovalsData(orgId);
      result.seniorApprovals = sa.approvals;
      result.seniorApprovalMetrics = sa.metrics;
      break;
    }
    case 'admin': {
      const [activeReqs, rq, riskOv, audit, sa, health] = await Promise.all([
        fetchMyActiveRequests(orgId, userId),
        fetchReviewQueue(orgId),
        fetch2ndLineRiskOverview(orgId),
        fetch3rdLineAuditFocus(orgId),
        fetchSeniorApprovalsData(orgId),
        fetchSystemHealthData(orgId),
      ]);
      result.myActiveRequests = activeReqs;
      result.reviewQueue = rq.queue;
      result.reviewQueueMetrics = rq.metrics;
      result.riskOverview = riskOv;
      result.auditFocus = audit;
      result.seniorApprovals = sa.approvals;
      result.seniorApprovalMetrics = sa.metrics;
      result.systemHealth = health;
      break;
    }
  }

  return result;
}

// --- Main hook ---

export function useDashboardData(): DashboardData {
  const { currentOrganization, defenseLine } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrganization?.id;

  const generalQuery = useQuery({
    queryKey: ['dashboard', 'general', orgId],
    queryFn: () => fetchGeneralDashboardData(orgId!),
    enabled: !!orgId,
  });

  const roleQuery = useQuery({
    queryKey: ['dashboard', 'role', orgId, user?.id, defenseLine],
    queryFn: () => fetchRoleSpecificData(orgId!, user!.id, defenseLine!),
    enabled: !!orgId && !!user?.id && !!defenseLine,
  });

  if (generalQuery.error) {
    logger.error('Error fetching dashboard data:', generalQuery.error);
  }
  if (roleQuery.error) {
    logger.error('Error fetching role-specific data:', roleQuery.error);
  }

  const general = generalQuery.data;
  const role = roleQuery.data;

  return {
    stats: general?.stats ?? null,
    complianceStats: general?.complianceStats ?? null,
    exceptionStats: general?.exceptionStats ?? null,
    criticalVendors: general?.criticalVendors ?? [],
    upcomingReviews: general?.upcomingReviews ?? [],
    reassessmentsDue: general?.reassessmentsDue ?? [],
    pendingDocuments: general?.pendingDocuments ?? [],
    loading: generalQuery.isLoading,
    myActiveRequests: role?.myActiveRequests ?? [],
    reviewQueue: role?.reviewQueue ?? [],
    reviewQueueMetrics: role?.reviewQueueMetrics ?? null,
    riskOverview: role?.riskOverview ?? null,
    auditFocus: role?.auditFocus ?? null,
    seniorApprovals: role?.seniorApprovals ?? [],
    seniorApprovalMetrics: role?.seniorApprovalMetrics ?? null,
    systemHealth: role?.systemHealth ?? null,
    roleDataLoading: roleQuery.isLoading,
  };
}

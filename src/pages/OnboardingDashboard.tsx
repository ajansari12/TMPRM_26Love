import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  OnboardingRequest,
  OnboardingStatus,
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_COLORS,
  PRIORITY_COLORS,
} from '../types/workflow';
import { DEFENSE_LINE_LABELS, DEFENSE_LINE_COLORS } from '../types/organization';
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
  Users,
  ChevronRight,
  Eye,
  Edit,
  RotateCcw,
  Activity,
  Bell,
  ArrowRightCircle,
  Briefcase,
} from 'lucide-react';
import { OnboardingAuditEntry } from '../types/workflow';
import { useDebounce } from '../hooks/useDebounce';
import { useDefenseLineAccess } from '../hooks/useDefenseLineAccess';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import ErrorState from '../components/ErrorState';
import { logger } from '../lib/logger';

const PIPELINE_STAGE_GROUPS = [
  {
    name: 'In Progress',
    stages: [
      { status: 'draft' as OnboardingStatus, label: 'Draft', color: 'bg-slate-500' },
      { status: 'submitted' as OnboardingStatus, label: 'Submitted', color: 'bg-blue-500' },
      { status: '1b_review' as OnboardingStatus, label: '1B Review', color: 'bg-sky-500' },
      { status: '2nd_review' as OnboardingStatus, label: '2nd Line', color: 'bg-teal-500' },
      { status: 'pending_senior_approval' as OnboardingStatus, label: 'Senior Approval', color: 'bg-rose-500' },
    ],
  },
  {
    name: 'Returned',
    stages: [
      { status: '1b_returned' as OnboardingStatus, label: '1B Returned', color: 'bg-amber-500' },
      { status: '2nd_returned' as OnboardingStatus, label: '2nd Returned', color: 'bg-orange-500' },
    ],
  },
  {
    name: 'Decisions',
    stages: [
      { status: 'conditionally_approved' as OnboardingStatus, label: 'Conditional', color: 'bg-yellow-500' },
      { status: 'approved' as OnboardingStatus, label: 'Approved', color: 'bg-green-500' },
      { status: 'rejected' as OnboardingStatus, label: 'Rejected', color: 'bg-red-500' },
    ],
  },
  {
    name: 'Completed',
    stages: [
      { status: 'vendor_created' as OnboardingStatus, label: 'Vendor Created', color: 'bg-emerald-600' },
      { status: 'withdrawn' as OnboardingStatus, label: 'Withdrawn', color: 'bg-slate-400' },
    ],
  },
];

const ALL_PIPELINE_STAGES = PIPELINE_STAGE_GROUPS.flatMap(g => g.stages);

export default function OnboardingDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    currentOrganization,
    defenseLine,
    canCreateRequests,
    canReview,
    stats
  } = useOrganization();
  const access = useDefenseLineAccess();

  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [myRequestsActivity, setMyRequestsActivity] = useState<OnboardingAuditEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    if (currentOrganization) {
      loadRequests();
      loadMyRequestsActivity();
    }
  }, [currentOrganization, statusFilter]);

  async function loadRequests() {
    if (!currentOrganization) return;

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('onboarding_requests')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (access.is1A && user) {
        query = query.eq('requested_by', user.id);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: requestsData, error: requestsError } = await query;

      if (requestsError) throw requestsError;

      if (!requestsData || requestsData.length === 0) {
        setRequests([]);
        return;
      }

      const userIds = new Set<string>();
      requestsData.forEach(r => {
        if (r.requested_by) userIds.add(r.requested_by);
        if (r.assigned_1b_reviewer) userIds.add(r.assigned_1b_reviewer);
        if (r.assigned_2nd_reviewer) userIds.add(r.assigned_2nd_reviewer);
      });

      let profilesMap: Record<string, { id: string; email: string; full_name: string }> = {};

      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', Array.from(userIds));

        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      const enrichedRequests = requestsData.map(r => ({
        ...r,
        requestor: r.requested_by ? profilesMap[r.requested_by] || null : null,
        reviewer_1b: r.assigned_1b_reviewer ? profilesMap[r.assigned_1b_reviewer] || null : null,
        reviewer_2nd: r.assigned_2nd_reviewer ? profilesMap[r.assigned_2nd_reviewer] || null : null,
      }));

      setRequests(enrichedRequests);
    } catch (err) {
      logger.error('Error loading requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load onboarding requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyRequestsActivity() {
    if (!currentOrganization || !user) return;

    setActivityLoading(true);
    try {
      const { data: myReqs } = await supabase
        .from('onboarding_requests')
        .select('id')
        .eq('organization_id', currentOrganization.id)
        .eq('requested_by', user.id);

      if (!myReqs || myReqs.length === 0) {
        setMyRequestsActivity([]);
        return;
      }

      const requestIds = myReqs.map(r => r.id);

      const { data: activities, error } = await supabase
        .from('onboarding_audit_log')
        .select('*')
        .in('request_id', requestIds)
        .order('performed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setMyRequestsActivity(activities || []);
    } catch (error) {
      logger.error('Error loading activity:', error);
    } finally {
      setActivityLoading(false);
    }
  }

  const getRelevantRequests = () => {
    let filtered = requests;

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.vendor_legal_name.toLowerCase().includes(term) ||
          r.request_number?.toLowerCase().includes(term) ||
          r.service_description?.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const getRequestsByStatus = (status: OnboardingStatus) => {
    return getRelevantRequests().filter(r => r.status === status);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const myRequests = requests.filter(r => r.requested_by === user?.id);
  const pendingMyReview = requests.filter(r => {
    if (defenseLine === '1b' && r.status === '1b_review' && r.assigned_1b_reviewer === user?.id) return true;
    if (defenseLine === '2nd' && r.status === '2nd_review' && r.assigned_2nd_reviewer === user?.id) return true;
    return false;
  });
  const overdueRequests = requests.filter(r => r.sla_breached);
  const pendingSeniorApproval = requests.filter(r => r.status === 'pending_senior_approval');

  const filteredRequests = getRelevantRequests();
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Third-Party Onboarding</h1>
          <p className="text-slate-600">
            Manage vendor onboarding requests with Three Lines of Defense workflow
          </p>
        </div>
        {canCreateRequests && !access.isReadOnly && (
          <Link
            to="/onboarding/new"
            className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Onboarding Request
          </Link>
        )}
      </div>

      {error && (
        <ErrorState
          title="Failed to load requests"
          message={error}
          onRetry={loadRequests}
        />
      )}

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Briefcase className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Three Lines of Defense Workflow
            </h3>
            <p className="text-sm text-blue-800 mb-2">
              All vendor onboarding follows a structured approval process: <strong>1st Line Business Unit</strong> submits and validates, <strong>1B Risk Coordinator</strong> reviews for completeness, <strong>2nd Line Risk Management</strong> provides independent oversight and approval. This ensures proper governance and regulatory compliance.
            </p>
            <div className="flex items-center space-x-4 text-xs text-blue-700">
              <span className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                1A: Submit & Manage
              </span>
              <span className="flex items-center">
                <span className="w-2 h-2 bg-sky-500 rounded-full mr-1"></span>
                1B: Review & Validate
              </span>
              <span className="flex items-center">
                <span className="w-2 h-2 bg-teal-500 rounded-full mr-1"></span>
                2nd: Approve & Oversee
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <CardSkeleton count={5} />
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${access.is1A ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-4`}>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">My Requests</p>
                <p className="text-2xl font-bold text-slate-900">{myRequests.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pending My Review</p>
                <p className="text-2xl font-bold text-slate-900">{pendingMyReview.length}</p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-lg">
                <Users className="w-6 h-6 text-cyan-600" />
              </div>
            </div>
          </div>

          {!access.is1A && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Senior Approval</p>
                  <p className="text-2xl font-bold text-rose-600">{pendingSeniorApproval.length}</p>
                </div>
                <div className="p-3 bg-rose-100 rounded-lg">
                  <Briefcase className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Approved This Month</p>
                <p className="text-2xl font-bold text-slate-900">
                  {requests.filter(r => r.status === 'approved').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Overdue / SLA Breach</p>
                <p className="text-2xl font-bold text-red-600">{overdueRequests.length}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {defenseLine && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-600">Your Role:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${DEFENSE_LINE_COLORS[defenseLine]}`}>
                {DEFENSE_LINE_LABELS[defenseLine]}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              {canCreateRequests && <span className="mr-4">✓ Can create requests</span>}
              {canReview && <span>✓ Can review requests</span>}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by vendor name or request number..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 w-80"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as OnboardingStatus | 'all')}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(ONBOARDING_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'pipeline'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pipeline View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              List View
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'pipeline' && (
        <div className="space-y-6">
          {PIPELINE_STAGE_GROUPS.map(group => (
            <div key={group.name}>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
                {group.name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {group.stages.map(stage => {
                  const stageRequests = getRequestsByStatus(stage.status);
                  return (
                    <div key={stage.status} className="bg-white rounded-xl border border-slate-200">
                      <div className={`px-4 py-3 ${stage.color} rounded-t-xl`}>
                        <div className="flex items-center justify-between text-white">
                          <h3 className="font-medium text-sm">{stage.label}</h3>
                          <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                            {stageRequests.length}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                        {loading ? (
                          <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
                        ) : stageRequests.length === 0 ? (
                          <div className="text-center py-4 text-slate-400 text-sm">No requests</div>
                        ) : (
                          stageRequests.map(request => (
                            <Link
                              key={request.id}
                              to={`/onboarding/${request.id}`}
                              className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-xs text-slate-500">{request.request_number}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[request.priority]}`}>
                                  {request.priority}
                                </span>
                              </div>
                              <h4 className="font-medium text-slate-900 text-sm mb-1 line-clamp-1">
                                {request.vendor_legal_name}
                              </h4>
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span className="truncate">{request.service_category?.replace(/_/g, ' ')}</span>
                                {request.is_critical_service && (
                                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded ml-1 shrink-0">
                                    Critical
                                  </span>
                                )}
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : filteredRequests.length === 0 ? (
            requests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No onboarding requests yet"
                description="Get started by creating your first vendor onboarding request."
                action={
                  canCreateRequests && !access.isReadOnly ? (
                    <Link
                      to="/onboarding/new"
                      className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create your first request
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No onboarding requests found"
                description="Try adjusting your search or filter criteria."
              />
            )
          ) : (
            <>
              <table className="w-full" aria-label="Onboarding requests">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Request
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Current Stage
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Requestor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Risk Tier
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedRequests.map(request => (
                    <tr key={request.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span className="text-sm font-medium text-slate-900">
                            {request.request_number}
                          </span>
                          <div className="text-xs text-slate-500">
                            {new Date(request.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {request.vendor_legal_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {request.service_category?.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ONBOARDING_STATUS_COLORS[request.status]
                          }`}
                        >
                          {ONBOARDING_STATUS_LABELS[request.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            DEFENSE_LINE_COLORS[request.current_defense_line]
                          }`}
                        >
                          {DEFENSE_LINE_LABELS[request.current_defense_line]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {request.requestor?.full_name || request.requestor?.email || 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {request.requesting_business_unit?.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {request.preliminary_risk_tier ? (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              request.preliminary_risk_tier.includes('5') || request.preliminary_risk_tier.includes('critical')
                                ? 'bg-red-100 text-red-800'
                                : request.preliminary_risk_tier.includes('4') || request.preliminary_risk_tier.includes('high')
                                ? 'bg-orange-100 text-orange-800'
                                : request.preliminary_risk_tier.includes('3') || request.preliminary_risk_tier.includes('moderate')
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {request.preliminary_risk_tier.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/onboarding/${request.id}`}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {!access.isReadOnly && (['draft', '1b_returned', '2nd_returned'].includes(request.status)) && request.requested_by === user?.id && (
                            <Link
                              to={`/onboarding/${request.id}/edit`}
                              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                              title={request.status === 'draft' ? 'Edit' : 'Edit & Resubmit'}
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredRequests.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myRequests.length > 0 && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">My Request Activity</h3>
              </div>
              {myRequestsActivity.length > 0 && (
                <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                  {myRequestsActivity.length} updates
                </span>
              )}
            </div>
            {activityLoading ? (
              <div className="text-center py-4 text-blue-600 text-sm">Loading activity...</div>
            ) : myRequestsActivity.length === 0 ? (
              <p className="text-sm text-blue-700">No recent activity on your requests.</p>
            ) : (
              <div className="space-y-3">
                {myRequestsActivity.slice(0, 5).map(activity => {
                  const request = requests.find(r => r.id === activity.request_id);
                  return (
                    <Link
                      key={activity.id}
                      to={`/onboarding/${activity.request_id}`}
                      className="flex items-start space-x-3 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <div className="p-1.5 bg-white rounded shrink-0">
                        {activity.action_type === 'status_changed' ? (
                          <ArrowRightCircle className="w-3 h-3 text-blue-600" />
                        ) : (
                          <Bell className="w-3 h-3 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate">
                          {request?.vendor_legal_name || 'Request'}
                        </p>
                        <p className="text-xs text-slate-600">
                          {activity.new_status
                            ? ONBOARDING_STATUS_LABELS[activity.new_status]
                            : activity.action_description || activity.action_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {activity.performed_by_name && `${activity.performed_by_name} • `}
                          {formatRelativeTime(activity.performed_at)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {myRequests.length > 0 && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="mt-4 text-sm text-blue-700 hover:text-blue-900 font-medium"
              >
                View all {myRequests.length} of my requests →
              </button>
            )}
          </div>
        )}

        {canReview && pendingMyReview.length > 0 && (
          <div className="bg-teal-50 rounded-xl border border-teal-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-teal-600" />
                <h3 className="font-medium text-teal-900">Pending My Review</h3>
              </div>
              <span className="bg-teal-200 text-teal-800 px-2 py-1 rounded-full text-sm font-medium">
                {pendingMyReview.length}
              </span>
            </div>
            <div className="space-y-3">
              {pendingMyReview.slice(0, 3).map(request => (
                <Link
                  key={request.id}
                  to={`/onboarding/${request.id}`}
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-teal-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-slate-900">{request.vendor_legal_name}</p>
                    <p className="text-xs text-slate-500">{request.request_number}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              ))}
            </div>
            {pendingMyReview.length > 3 && (
              <button
                onClick={() => setStatusFilter(defenseLine === '1b' ? '1b_review' : '2nd_review')}
                className="mt-4 text-sm text-teal-700 hover:text-teal-900"
              >
                View all {pendingMyReview.length} pending reviews →
              </button>
            )}
          </div>
        )}

        {(defenseLine === '1a' || defenseLine === '1b') && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <h3 className="font-medium text-amber-900">Returned Requests</h3>
              </div>
              <span className="bg-amber-200 text-amber-800 px-2 py-1 rounded-full text-sm font-medium">
                {requests.filter(r => r.status === '1b_returned' || r.status === '2nd_returned').length}
              </span>
            </div>
            <p className="text-sm text-amber-700 mb-4">
              These requests need additional information before proceeding.
            </p>
            {requests
              .filter(r => r.status === '1b_returned' || r.status === '2nd_returned')
              .slice(0, 3)
              .map(request => (
                <Link
                  key={request.id}
                  to={`/onboarding/${request.id}`}
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-amber-100 transition-colors mb-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{request.vendor_legal_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        request.status === '1b_returned'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {request.status === '1b_returned' ? 'Returned by 1B' : 'Returned by 2nd Line'}
                      </span>
                      {defenseLine === '1b' && request.status === '2nd_returned' && (
                        <span className="text-xs text-teal-700 font-medium">Action needed</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </Link>
              ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-5 h-5 text-slate-500" />
            <h3 className="font-medium text-slate-900">Recent Updates</h3>
          </div>
          <div className="space-y-3">
            {requests.slice(0, 5).map(request => (
              <Link
                key={request.id}
                to={`/onboarding/${request.id}`}
                className="flex items-start space-x-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="p-1.5 bg-slate-100 rounded shrink-0">
                  <Building2 className="w-3 h-3 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 truncate">{request.vendor_legal_name}</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${ONBOARDING_STATUS_COLORS[request.status]}`}
                    >
                      {ONBOARDING_STATUS_LABELS[request.status]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(request.updated_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

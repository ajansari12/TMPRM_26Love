import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/utils';
import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_COLORS,
} from '../../types/workflow';
import {
  AlertTriangle,
  FileText,
  Calendar,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle,
  ShieldAlert,
  RefreshCw,
  FileCheck,
  Briefcase,
  Eye,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
} from 'lucide-react';
import type {
  MyActiveRequest,
  ReviewQueueItem,
  ReviewQueueMetrics,
  RiskOverviewData,
  AuditFocusData,
  SeniorApprovalMetrics,
  SystemHealthData,
} from './types';

interface RoleSectionsProps {
  defenseLine: string;
  roleDataLoading: boolean;
  myActiveRequests: MyActiveRequest[];
  reviewQueue: ReviewQueueItem[];
  reviewQueueMetrics: ReviewQueueMetrics | null;
  riskOverview: RiskOverviewData | null;
  auditFocus: AuditFocusData | null;
  seniorApprovals: MyActiveRequest[];
  seniorApprovalMetrics: SeniorApprovalMetrics | null;
  systemHealth: SystemHealthData | null;
}

export default function RoleSections({
  defenseLine,
  roleDataLoading,
  myActiveRequests,
  reviewQueue,
  reviewQueueMetrics,
  riskOverview,
  auditFocus,
  seniorApprovals,
  seniorApprovalMetrics,
  systemHealth,
}: RoleSectionsProps) {
  return (
    <div className="mb-6">
      {/* 1a - Business Requestor */}
      {(defenseLine === '1a' || defenseLine === 'admin') && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    My Active Requests
                    {myActiveRequests.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        {myActiveRequests.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-600">Track your onboarding submissions</p>
                </div>
              </div>
              <Link
                to="/onboarding"
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center text-sm"
              >
                View All <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
          <div className="p-4">
            {roleDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : myActiveRequests.length > 0 ? (
              <div className="space-y-2">
                {myActiveRequests.map((request) => (
                  <Link
                    key={request.id}
                    to={`/onboarding/${request.id}`}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm text-slate-900">{request.request_number}</span>
                        <span className="text-sm text-slate-600 truncate">{request.vendor_legal_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Last updated: {formatDate(request.updated_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ONBOARDING_STATUS_COLORS[request.status as keyof typeof ONBOARDING_STATUS_COLORS]}`}>
                        {ONBOARDING_STATUS_LABELS[request.status as keyof typeof ONBOARDING_STATUS_LABELS]}
                      </span>
                      {request.status === 'draft' && (
                        <span className="text-xs text-blue-600 font-medium">Continue</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600 mb-3">No active requests</p>
                <Link
                  to="/onboarding/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Create New Request
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1b - Coordinator Review Queue */}
      {(defenseLine === '1b' || defenseLine === 'admin') && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Pending My Review
                    {reviewQueue.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                        {reviewQueue.length}
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                    <span>Requests awaiting your 1st line review</span>
                    {reviewQueueMetrics && reviewQueueMetrics.totalInQueue > 0 && (
                      <>
                        <span className="text-slate-400">&bull;</span>
                        <span className={`flex items-center gap-1 ${reviewQueueMetrics.averageWaitTime > 5 ? 'text-amber-600 font-medium' : ''}`}>
                          <Clock className="w-3.5 h-3.5" />
                          Avg wait: {reviewQueueMetrics.averageWaitTime} days
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Link
                to="/onboarding"
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center text-sm"
              >
                View All <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
          <div className="p-4">
            {roleDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : reviewQueue.length > 0 ? (
              <div className="space-y-2">
                {reviewQueue.map((item) => (
                  <Link
                    key={item.id}
                    to={`/onboarding/${item.id}`}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors ${
                      item.daysWaiting > 5 ? 'border-red-200 bg-red-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm text-slate-900">{item.request_number}</span>
                        <span className="text-sm text-slate-600 truncate">{item.vendor_legal_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {item.preliminary_risk_tier && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            item.preliminary_risk_tier === 'critical' ? 'bg-red-100 text-red-800' :
                            item.preliminary_risk_tier === 'high' ? 'bg-orange-100 text-orange-800' :
                            item.preliminary_risk_tier === 'medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {item.preliminary_risk_tier}
                          </span>
                        )}
                        <span className={`text-xs ${item.daysWaiting > 5 ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                          Waiting {item.daysWaiting} {item.daysWaiting === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                    </div>
                    <span className="ml-4 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 flex-shrink-0">
                      Review Now
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-slate-600 font-medium">All caught up!</p>
                <p className="text-sm text-slate-500 mt-1">No requests pending your review</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2nd - Risk Management Overview */}
      {(defenseLine === '2nd' || defenseLine === 'admin') && riskOverview && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Risk Oversight</h2>
                <p className="text-sm text-slate-600">2nd line risk management focus areas</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            {roleDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                <Link
                  to="/onboarding?status=2nd_review"
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="w-5 h-5 text-cyan-600" />
                    {riskOverview.pending2ndReviews > 0 && (
                      <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">
                        {riskOverview.pending2ndReviews}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{riskOverview.pending2ndReviews}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-600">Pending 2nd Line Review</p>
                    {riskOverview.trends.pending2ndReviews !== 0 && (
                      <span className={`flex items-center text-xs font-medium ${riskOverview.trends.pending2ndReviews > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {riskOverview.trends.pending2ndReviews > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </Link>
                <Link
                  to="/assessments/reassessments"
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <RefreshCw className="w-5 h-5 text-amber-600" />
                    {riskOverview.vendorsNeedingReassessment > 0 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                        {riskOverview.vendorsNeedingReassessment}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{riskOverview.vendorsNeedingReassessment}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-600">Reassessments Needed</p>
                    {riskOverview.trends.reassessments !== 0 && (
                      <span className={`flex items-center text-xs font-medium ${riskOverview.trends.reassessments > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {riskOverview.trends.reassessments > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </Link>
                <Link
                  to="/risk-exceptions"
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <ShieldAlert className="w-5 h-5 text-orange-600" />
                    {riskOverview.riskExceptionsExpiring > 0 && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                        {riskOverview.riskExceptionsExpiring}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{riskOverview.riskExceptionsExpiring}</p>
                  <p className="text-xs text-slate-600 mt-1">Exceptions Expiring Soon</p>
                </Link>
                <Link
                  to="/incidents"
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    {riskOverview.recentHighIncidents > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        {riskOverview.recentHighIncidents}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{riskOverview.recentHighIncidents}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-600">High/Critical Incidents</p>
                    {riskOverview.trends.incidents !== 0 && (
                      <span className={`flex items-center text-xs font-medium ${riskOverview.trends.incidents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {riskOverview.trends.incidents > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3rd - Audit Focus */}
      {(defenseLine === '3rd' || defenseLine === 'admin') && auditFocus && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Eye className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Audit Focus</h2>
                <p className="text-sm text-slate-600">3rd line audit and compliance monitoring</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            {roleDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <Link
                  to="/audit-log"
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <FileCheck className="w-5 h-5 text-slate-600 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">{auditFocus.recentAuditEntries}</p>
                  <p className="text-xs text-slate-600 mt-1">Audit Entries (7 days)</p>
                </Link>
                <Link
                  to="/compliance/osfi-b10"
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Shield className="w-5 h-5 text-slate-600 mb-2" />
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-slate-900">{auditFocus.osfiComplianceScore}%</p>
                    <span className={`text-xs font-medium ${
                      auditFocus.osfiComplianceScore >= 80 ? 'text-green-600' :
                      auditFocus.osfiComplianceScore >= 60 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {auditFocus.osfiComplianceScore >= 80 ? 'Good' :
                       auditFocus.osfiComplianceScore >= 60 ? 'Fair' : 'Poor'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">OSFI B-10 Compliance</p>
                </Link>
                <Link
                  to="/attestations"
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Calendar className="w-5 h-5 text-slate-600 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">{auditFocus.upcomingAttestations}</p>
                  <p className="text-xs text-slate-600 mt-1">Attestations Due (60 days)</p>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Senior Management - Approvals Required */}
      {(defenseLine === 'senior_management' || defenseLine === 'admin') && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <Users className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Pending Your Approval
                    {seniorApprovals.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-rose-100 text-rose-700 rounded-full">
                        {seniorApprovals.length}
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                    <span>High-value or critical vendor approvals</span>
                    {seniorApprovalMetrics && seniorApprovalMetrics.totalContractValue > 0 && (
                      <>
                        <span className="text-slate-400">&bull;</span>
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <DollarSign className="w-3.5 h-3.5" />
                          {(seniorApprovalMetrics.totalContractValue / 1000000).toFixed(1)}M total value
                        </span>
                        {seniorApprovalMetrics.criticalCount > 0 && (
                          <>
                            <span className="text-slate-400">&bull;</span>
                            <span className="flex items-center gap-1 text-red-600 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {seniorApprovalMetrics.criticalCount} critical
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Link
                to="/onboarding?status=pending_senior_approval"
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center text-sm"
              >
                View All <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
          <div className="p-4">
            {roleDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
              </div>
            ) : seniorApprovals.length > 0 ? (
              <div className="space-y-2">
                {seniorApprovals.map((request) => (
                  <Link
                    key={request.id}
                    to={`/onboarding/${request.id}`}
                    className="flex items-center justify-between p-3 border border-rose-200 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm text-slate-900">{request.request_number}</span>
                        <span className="text-sm text-slate-600 truncate">{request.vendor_legal_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Awaiting decision</p>
                    </div>
                    <span className="ml-4 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded hover:bg-rose-700 flex-shrink-0">
                      Review & Approve
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-slate-600 font-medium">No approvals pending</p>
                <p className="text-sm text-slate-500 mt-1">All requests have been processed</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin - System Health */}
      {defenseLine === 'admin' && systemHealth && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  systemHealth.systemScore >= 80 ? 'bg-green-100' :
                  systemHealth.systemScore >= 60 ? 'bg-amber-100' :
                  'bg-red-100'
                }`}>
                  <Activity className={`w-5 h-5 ${
                    systemHealth.systemScore >= 80 ? 'text-green-600' :
                    systemHealth.systemScore >= 60 ? 'text-amber-600' :
                    'text-red-600'
                  }`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    System Health
                    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                      systemHealth.systemScore >= 80 ? 'bg-green-100 text-green-700' :
                      systemHealth.systemScore >= 60 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {systemHealth.systemScore}%
                    </span>
                  </h2>
                  <p className="text-sm text-slate-600">Workflow performance and system bottlenecks</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4">
            {roleDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-5 h-5 text-slate-600" />
                    {systemHealth.pendingWorkflows > 10 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                        {systemHealth.pendingWorkflows}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{systemHealth.pendingWorkflows}</p>
                  <p className="text-xs text-slate-600 mt-1">Pending Workflows</p>
                </div>
                <div className={`p-4 border rounded-lg ${
                  systemHealth.oldestPendingDays > 14 ? 'border-red-200 bg-red-50' :
                  systemHealth.oldestPendingDays > 7 ? 'border-amber-200 bg-amber-50' :
                  'border-slate-200'
                }`}>
                  <AlertTriangle className={`w-5 h-5 mb-2 ${
                    systemHealth.oldestPendingDays > 14 ? 'text-red-600' :
                    systemHealth.oldestPendingDays > 7 ? 'text-amber-600' :
                    'text-slate-600'
                  }`} />
                  <p className={`text-2xl font-bold ${
                    systemHealth.oldestPendingDays > 14 ? 'text-red-600' :
                    systemHealth.oldestPendingDays > 7 ? 'text-amber-600' :
                    'text-slate-900'
                  }`}>{systemHealth.oldestPendingDays}</p>
                  <p className="text-xs text-slate-600 mt-1">Days (Oldest Pending)</p>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg">
                  <Shield className="w-5 h-5 text-slate-600 mb-2" />
                  {systemHealth.bottleneckStage ? (
                    <>
                      <p className="text-sm font-bold text-slate-900">
                        {ONBOARDING_STATUS_LABELS[systemHealth.bottleneckStage as keyof typeof ONBOARDING_STATUS_LABELS] || systemHealth.bottleneckStage}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Current Bottleneck</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-green-600">None</p>
                      <p className="text-xs text-slate-600 mt-1">No Bottleneck Detected</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

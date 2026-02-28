import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  FileText,
  Users,
  Download,
  RefreshCw,
  ChevronRight,
  XCircle,
  Calendar,
  Activity,
} from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { format, subDays, startOfMonth } from 'date-fns';
import { logger } from '../lib/logger';

interface ComplianceMetrics {
  total_vendors: number;
  vendors_with_onboarding: number;
  vendors_with_assessment: number;
  vendors_pending_assessment: number;
  active_vendors: number;
  recent_creations_30d: number;
  vendors_missing_documents: number;
  overdue_reassessments: number;
}

interface VendorCreationAudit {
  id: string;
  created_at: string;
  created_by_name: string;
  vendor_name: string;
  source: string;
  success: boolean;
  reason?: string;
}

interface NonCompliantVendor {
  id: string;
  legal_name: string;
  status: string;
  created_at: string;
  issue_type: string;
  issue_description: string;
}

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<ComplianceMetrics>({
    total_vendors: 0,
    vendors_with_onboarding: 0,
    vendors_with_assessment: 0,
    vendors_pending_assessment: 0,
    active_vendors: 0,
    recent_creations_30d: 0,
    vendors_missing_documents: 0,
    overdue_reassessments: 0,
  });
  const [recentAudits, setRecentAudits] = useState<VendorCreationAudit[]>([]);
  const [nonCompliantVendors, setNonCompliantVendors] = useState<NonCompliantVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      loadComplianceData();
    }
  }, [currentOrganization]);

  const loadComplianceData = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);

      const thirtyDaysAgo = subDays(new Date(), 30);
      const today = new Date();

      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, legal_name, status, created_at, onboarding_request_id, next_review_date')
        .eq('organization_id', currentOrganization.id);

      const { data: assessments } = await supabase
        .from('tiering_assessments')
        .select('vendor_id')
        .eq('organization_id', currentOrganization.id);

      const { data: audits } = await supabase
        .from('vendor_creation_audit')
        .select('id, created_at, attempted_by, vendor_legal_name, creation_source, attempt_result, block_reason')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const uniqueAttemptedByIds = Array.from(
        new Set(audits?.map((a) => a.attempted_by).filter(Boolean) || [])
      );

      const { data: profiles } = uniqueAttemptedByIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', uniqueAttemptedByIds)
        : { data: [] };

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);

      const assessmentVendorIds = new Set(assessments?.map((a) => a.vendor_id) || []);

      const totalVendors = vendors?.length || 0;
      const vendorsWithOnboarding = vendors?.filter((v) => v.onboarding_request_id).length || 0;
      const vendorsWithAssessment = vendors?.filter((v) => assessmentVendorIds.has(v.id)).length || 0;
      const vendorsPendingAssessment = vendors?.filter(
        (v) => v.status === 'pending_assessment'
      ).length || 0;
      const activeVendors = vendors?.filter((v) => v.status === 'active').length || 0;
      const recentCreations = vendors?.filter(
        (v) => new Date(v.created_at) >= thirtyDaysAgo
      ).length || 0;
      const overdueReassessments = vendors?.filter(
        (v) => v.next_review_date && new Date(v.next_review_date) < today
      ).length || 0;

      setMetrics({
        total_vendors: totalVendors,
        vendors_with_onboarding: vendorsWithOnboarding,
        vendors_with_assessment: vendorsWithAssessment,
        vendors_pending_assessment: vendorsPendingAssessment,
        active_vendors: activeVendors,
        recent_creations_30d: recentCreations,
        vendors_missing_documents: 0,
        overdue_reassessments: overdueReassessments,
      });

      const nonCompliant: NonCompliantVendor[] = [];
      vendors?.forEach((vendor) => {
        if (!vendor.onboarding_request_id) {
          nonCompliant.push({
            id: vendor.id,
            legal_name: vendor.legal_name,
            status: vendor.status,
            created_at: vendor.created_at,
            issue_type: 'missing_onboarding',
            issue_description: 'No onboarding request linked',
          });
        } else if (!assessmentVendorIds.has(vendor.id) && vendor.status === 'active') {
          nonCompliant.push({
            id: vendor.id,
            legal_name: vendor.legal_name,
            status: vendor.status,
            created_at: vendor.created_at,
            issue_type: 'missing_assessment',
            issue_description: 'Active without risk assessment',
          });
        } else if (vendor.next_review_date && new Date(vendor.next_review_date) < today) {
          nonCompliant.push({
            id: vendor.id,
            legal_name: vendor.legal_name,
            status: vendor.status,
            created_at: vendor.created_at,
            issue_type: 'overdue_reassessment',
            issue_description: `Reassessment overdue since ${format(new Date(vendor.next_review_date), 'MMM d, yyyy')}`,
          });
        }
      });
      setNonCompliantVendors(nonCompliant);

      const mappedAudits: VendorCreationAudit[] =
        audits?.map((audit) => ({
          id: audit.id,
          created_at: audit.created_at,
          created_by_name: profileMap.get(audit.attempted_by) || 'Unknown',
          vendor_name: audit.vendor_legal_name || 'Unknown',
          source: audit.creation_source || 'unknown',
          success: audit.attempt_result === 'allowed',
          reason: audit.block_reason,
        })) || [];
      setRecentAudits(mappedAudits);
    } catch (error) {
      logger.error('Error loading compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadComplianceData();
    setRefreshing(false);
    toast.success('Compliance data refreshed');
  };

  const complianceScore = metrics.total_vendors > 0
    ? Math.round(
        ((metrics.vendors_with_onboarding / metrics.total_vendors) * 40 +
          (metrics.vendors_with_assessment / metrics.total_vendors) * 40 +
          ((metrics.total_vendors - nonCompliantVendors.length) / metrics.total_vendors) * 20) *
          100
      ) / 100
    : 100;

  const getIssueIcon = (issueType: string) => {
    switch (issueType) {
      case 'missing_onboarding':
        return <FileText className="w-4 h-4 text-red-600" />;
      case 'missing_assessment':
        return <Shield className="w-4 h-4 text-amber-600" />;
      case 'overdue_reassessment':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-600" />;
    }
  };

  const getIssueColor = (issueType: string) => {
    switch (issueType) {
      case 'missing_onboarding':
        return 'bg-red-50 border-red-200';
      case 'missing_assessment':
        return 'bg-amber-50 border-amber-200';
      case 'overdue_reassessment':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Activity className="w-8 h-8 text-blue-600 mr-3" />
            Vendor Governance Compliance
          </h1>
          <p className="text-slate-600 mt-1">
            Monitor vendor creation compliance and onboarding workflow adherence
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Overall Compliance Score</h2>
          <span className="text-3xl font-bold text-blue-600">{complianceScore}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              complianceScore >= 90
                ? 'bg-green-600'
                : complianceScore >= 70
                ? 'bg-amber-500'
                : 'bg-red-600'
            }`}
            style={{ width: `${complianceScore}%` }}
          />
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Based on onboarding completion, assessment coverage, and compliance adherence
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-900">{metrics.total_vendors}</span>
          </div>
          <p className="text-sm font-medium text-slate-700">Total Vendors</p>
          <p className="text-xs text-slate-500 mt-1">{metrics.active_vendors} active</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-slate-900">
              {metrics.vendors_with_onboarding}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700">With Onboarding</p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.total_vendors > 0
              ? Math.round((metrics.vendors_with_onboarding / metrics.total_vendors) * 100)
              : 0}
            % coverage
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-slate-900">
              {metrics.vendors_with_assessment}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700">With Assessment</p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.total_vendors > 0
              ? Math.round((metrics.vendors_with_assessment / metrics.total_vendors) * 100)
              : 0}
            % coverage
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-900">{metrics.recent_creations_30d}</span>
          </div>
          <p className="text-sm font-medium text-slate-700">New (Last 30 Days)</p>
          <p className="text-xs text-slate-500 mt-1">Vendor additions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="bg-white rounded-xl border border-red-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/vendors')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-red-600">
                {metrics.total_vendors - metrics.vendors_with_onboarding}
              </p>
              <p className="text-sm text-slate-700 mt-1">Missing Onboarding</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-amber-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/assessments')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {metrics.vendors_pending_assessment}
              </p>
              <p className="text-sm text-slate-700 mt-1">Pending Assessment</p>
            </div>
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-orange-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/pending-reassessments')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-600">{metrics.overdue_reassessments}</p>
              <p className="text-sm text-slate-700 mt-1">Overdue Reassessments</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div
          className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/audit-log')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-700">{recentAudits.length}</p>
              <p className="text-sm text-slate-700 mt-1">Recent Actions</p>
            </div>
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
        </div>
      </div>

      {nonCompliantVendors.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-red-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-red-800 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Non-Compliant Vendors ({nonCompliantVendors.length})
              </h3>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {nonCompliantVendors.slice(0, 10).map((vendor) => (
              <div
                key={vendor.id}
                className={`p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer ${getIssueColor(
                  vendor.issue_type
                )}`}
                onClick={() => navigate(`/vendors/${vendor.id}`)}
              >
                <div className="flex items-center space-x-4">
                  {getIssueIcon(vendor.issue_type)}
                  <div>
                    <p className="font-medium text-slate-900">{vendor.legal_name}</p>
                    <p className="text-sm text-slate-600">{vendor.issue_description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-slate-500">
                    {format(new Date(vendor.created_at), 'MMM d, yyyy')}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
          {nonCompliantVendors.length > 10 && (
            <div className="px-6 py-3 bg-slate-50 text-center">
              <button
                onClick={() => navigate('/vendors')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all {nonCompliantVendors.length} non-compliant vendors
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-medium text-slate-900 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Recent Vendor Creation Audit Log
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentAudits.slice(0, 15).map((audit) => (
                <tr key={audit.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {format(new Date(audit.created_at), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-slate-900">{audit.vendor_name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {audit.created_by_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {audit.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {audit.success ? (
                      <span className="inline-flex items-center text-sm text-green-600">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-sm text-red-600">
                        <XCircle className="w-4 h-4 mr-1" />
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {recentAudits.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No vendor creation activity recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {recentAudits.length > 15 && (
          <div className="px-6 py-3 bg-slate-50 text-center border-t border-slate-200">
            <button
              onClick={() => navigate('/audit-log')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View complete audit log
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

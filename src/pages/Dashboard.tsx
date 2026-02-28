import { Link } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { useDefenseLineAccess } from '../hooks/useDefenseLineAccess';
import { Building2 } from 'lucide-react';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { useDashboardData } from './dashboard/useDashboardData';
import QuickActions from './dashboard/QuickActions';
import StatsCards from './dashboard/StatsCards';
import RoleSections from './dashboard/RoleSections';
import Charts from './dashboard/Charts';
import VendorWidgets from './dashboard/VendorWidgets';

export default function Dashboard() {
  const { currentOrganization, defenseLine } = useOrganization();
  const access = useDefenseLineAccess();
  const data = useDashboardData();

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          No Organization Selected
        </h2>
        <p className="text-slate-600">
          Please select or register an organization to view your dashboard
        </p>
      </div>
    );
  }

  if (data.loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
        </div>
        <CardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="h-[300px] bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="h-[300px] bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <TableSkeleton rows={5} cols={4} />
        </div>
      </div>
    );
  }

  if (!data.stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Unable to load dashboard data</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            {currentOrganization.name} - {access.is1A ? 'My Vendor Requests' : 'Third-Party Risk Management Overview'}
          </p>
        </div>
      </div>

      <QuickActions stats={data.stats} access={access} />

      {defenseLine && (
        <RoleSections
          defenseLine={defenseLine}
          roleDataLoading={data.roleDataLoading}
          myActiveRequests={data.myActiveRequests}
          reviewQueue={data.reviewQueue}
          reviewQueueMetrics={data.reviewQueueMetrics}
          riskOverview={data.riskOverview}
          auditFocus={data.auditFocus}
          seniorApprovals={data.seniorApprovals}
          seniorApprovalMetrics={data.seniorApprovalMetrics}
          systemHealth={data.systemHealth}
        />
      )}

      {!access.is1A && <StatsCards stats={data.stats} />}

      {!access.is1A && <Charts stats={data.stats} />}

      {!access.is1A && (
        <VendorWidgets
          complianceStats={data.complianceStats}
          exceptionStats={data.exceptionStats}
          criticalVendors={data.criticalVendors}
          upcomingReviews={data.upcomingReviews}
          reassessmentsDue={data.reassessmentsDue}
          pendingDocuments={data.pendingDocuments}
        />
      )}

      {data.stats.totalVendors === 0 && !access.is1A && (
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Get Started</h3>
          <p className="text-slate-600 mb-4">
            Start managing your third-party relationships by adding your first vendor
          </p>
          <Link
            to="/vendors/new"
            className="inline-block px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Add Your First Third Party
          </Link>
        </div>
      )}
    </div>
  );
}

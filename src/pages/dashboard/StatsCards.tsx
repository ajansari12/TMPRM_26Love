import { Link } from 'react-router-dom';
import { Building2, AlertTriangle, FileText, Calendar, ArrowRight } from 'lucide-react';
import type { DashboardStats } from './types';

interface StatsCardsProps {
  stats: DashboardStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 text-sm">Total Third Parties</span>
          <Building2 className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-3xl font-bold text-slate-900">{stats.totalVendors}</p>
        <Link to="/vendors" className="text-sm text-slate-600 hover:text-slate-900 flex items-center mt-2">
          View all <ArrowRight className="w-3 h-3 ml-1" />
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 text-sm">Critical Vendors</span>
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-3xl font-bold text-red-600">{stats.criticalVendors}</p>
        <p className="text-sm text-slate-600 mt-2">
          {stats.totalVendors > 0
            ? `${Math.round((stats.criticalVendors / stats.totalVendors) * 100)}% of total`
            : 'No vendors'}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 text-sm">Pending Approvals</span>
          <FileText className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-3xl font-bold text-amber-600">{stats.pendingApprovals}</p>
        <Link to="/vendors?status=pending_approval" className="text-sm text-slate-600 hover:text-slate-900 flex items-center mt-2">
          Review <ArrowRight className="w-3 h-3 ml-1" />
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 text-sm">Upcoming Reviews</span>
          <Calendar className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-3xl font-bold text-slate-900">{stats.upcomingReviews}</p>
        <p className="text-sm text-slate-600 mt-2">Next 30 days</p>
      </div>
    </div>
  );
}

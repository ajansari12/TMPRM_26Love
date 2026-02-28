import { Link } from 'react-router-dom';
import { Upload, Clock, Shield, FileText } from 'lucide-react';
import type { DashboardStats } from './types';

interface QuickActionsProps {
  stats: DashboardStats;
  access: {
    isReadOnly: boolean;
    canSeeRiskAssessment: boolean;
    canSeeBoardReports: boolean;
  };
}

export default function QuickActions({ stats, access }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {!access.isReadOnly && (
        <Link
          to="/onboarding/new"
          className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm font-medium">New Onboarding</span>
        </Link>
      )}
      {stats.pendingApprovals > 0 && (
        <Link
          to="/onboarding"
          className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl hover:bg-amber-100 transition-colors"
        >
          <Clock className="w-5 h-5" />
          <span className="text-sm font-medium">{stats.pendingApprovals} Pending Reviews</span>
        </Link>
      )}
      {access.canSeeRiskAssessment && (
        <Link
          to="/assessments"
          className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Shield className="w-5 h-5" />
          <span className="text-sm font-medium">Assessments</span>
        </Link>
      )}
      {access.canSeeBoardReports && (
        <Link
          to="/reports/board"
          className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span className="text-sm font-medium">Board Reports</span>
        </Link>
      )}
    </div>
  );
}

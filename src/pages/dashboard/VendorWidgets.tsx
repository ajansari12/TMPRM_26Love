import { Link } from 'react-router-dom';
import { Vendor } from '../../types';
import { tierConfig } from '../../lib/riskCalculations';
import { formatDate } from '../../lib/utils';
import {
  AlertTriangle,
  FileText,
  Calendar,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle,
  XCircle,
  ShieldAlert,
  RefreshCw,
  FileCheck,
  Lock,
} from 'lucide-react';
import type {
  ComplianceStats,
  ExceptionStats,
  ReassessmentDue,
  PendingDocumentRequest,
} from './types';

interface VendorWidgetsProps {
  complianceStats: ComplianceStats | null;
  exceptionStats: ExceptionStats | null;
  criticalVendors: Vendor[];
  upcomingReviews: Vendor[];
  reassessmentsDue: ReassessmentDue[];
  pendingDocuments: PendingDocumentRequest[];
}

export default function VendorWidgets({
  complianceStats,
  exceptionStats,
  criticalVendors,
  upcomingReviews,
  reassessmentsDue,
  pendingDocuments,
}: VendorWidgetsProps) {
  return (
    <>
      {/* Risk Exceptions Banner */}
      {exceptionStats && (exceptionStats.active > 0 || exceptionStats.pending > 0) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900">Risk Exceptions</h3>
                <div className="flex items-center gap-4 text-sm mt-1">
                  <span className="text-emerald-600">
                    {exceptionStats.active} active
                  </span>
                  {exceptionStats.pending > 0 && (
                    <span className="text-amber-600">
                      {exceptionStats.pending} pending approval
                    </span>
                  )}
                  {exceptionStats.expiringSoon > 0 && (
                    <span className="text-orange-600">
                      {exceptionStats.expiringSoon} expiring soon
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link
              to="/risk-exceptions"
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center"
            >
              Manage Exceptions <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      )}

      {/* Pending Due Diligence Documents */}
      {pendingDocuments.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Pending Due Diligence Documents</h3>
                  <div className="flex items-center gap-4 text-sm mt-1">
                    <span className="text-blue-600">{pendingDocuments.length} pending</span>
                    {pendingDocuments.filter((d) => d.urgency === 'overdue').length > 0 && (
                      <span className="text-red-600">
                        {pendingDocuments.filter((d) => d.urgency === 'overdue').length} overdue
                      </span>
                    )}
                    {pendingDocuments.filter((d) => d.blocks_activation).length > 0 && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {pendingDocuments.filter((d) => d.blocks_activation).length} blocking
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                to="/due-diligence"
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center text-sm"
              >
                View All <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {pendingDocuments.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    doc.urgency === 'overdue'
                      ? 'bg-red-50 border-red-200'
                      : doc.blocks_activation
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {doc.urgency === 'overdue' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : doc.blocks_activation ? (
                      <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">{doc.document_type_name}</p>
                      {doc.vendor_name && (
                        <p className="text-xs text-slate-500 truncate">{doc.vendor_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {doc.blocks_activation && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                        Blocking
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium ${
                        doc.urgency === 'overdue'
                          ? 'text-red-600'
                          : doc.urgency === 'critical'
                            ? 'text-red-500'
                            : doc.urgency === 'soon'
                              ? 'text-amber-500'
                              : 'text-slate-500'
                      }`}
                    >
                      {doc.urgency === 'overdue'
                        ? `${doc.days_overdue} days overdue`
                        : `Due ${formatDate(doc.due_date)}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {pendingDocuments.length > 5 && (
              <Link
                to="/due-diligence"
                className="mt-3 block text-center text-sm text-blue-600 hover:text-blue-800"
              >
                View all {pendingDocuments.length} pending documents
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Critical Vendors + Sidebar Widgets */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg shadow">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-red-500" />
                Critical Third Parties
              </h2>
              <Link to="/vendors?tier=tier_5_critical" className="text-sm text-slate-600 hover:text-slate-900">
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {criticalVendors.length > 0 ? (
              <div className="space-y-3">
                {criticalVendors.map((vendor) => (
                  <Link
                    key={vendor.id}
                    to={`/vendors/${vendor.id}`}
                    className="block p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{vendor.legal_name}</h3>
                        <p className="text-sm text-slate-600 mt-1">{vendor.service_category}</p>
                      </div>
                      {vendor.risk_rating && (
                        <span className="ml-4 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                          Risk: {vendor.risk_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Shield className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>No critical vendors</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Reassessments Due */}
          {reassessmentsDue.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center">
                    <RefreshCw className="w-4 h-4 mr-2 text-amber-600" />
                    Reassessments Due
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                      {reassessmentsDue.length}
                    </span>
                  </h2>
                  <Link to="/assessments/reassessments" className="text-xs text-slate-600 hover:text-slate-900">
                    View all
                  </Link>
                </div>
              </div>
              <div className="p-4">
                {(() => {
                  const overdue = reassessmentsDue.filter((r) => r.isOverdue);
                  const upcoming = reassessmentsDue.filter((r) => !r.isOverdue);
                  return (
                    <div className="space-y-3">
                      {overdue.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-600 mb-2 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Overdue ({overdue.length})
                          </p>
                          <div className="space-y-2">
                            {overdue.slice(0, 2).map((vendor) => (
                              <Link
                                key={vendor.id}
                                to={`/vendors/${vendor.id}/assess?type=periodic_review`}
                                className="block p-2 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <h3 className="font-medium text-sm text-slate-900 truncate pr-2">{vendor.legal_name}</h3>
                                  <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                                    {Math.abs(vendor.daysUntilDue)} days overdue
                                  </span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {upcoming.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-amber-600 mb-2 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            Upcoming ({upcoming.length})
                          </p>
                          <div className="space-y-2">
                            {upcoming.slice(0, 2).map((vendor) => (
                              <Link
                                key={vendor.id}
                                to={`/vendors/${vendor.id}/assess?type=periodic_review`}
                                className="block p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <h3 className="font-medium text-sm text-slate-900 truncate pr-2">{vendor.legal_name}</h3>
                                  <span className="text-xs text-slate-600 whitespace-nowrap">
                                    Due in {vendor.daysUntilDue} days
                                  </span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {reassessmentsDue.length > 4 && (
                  <Link
                    to="/assessments/reassessments"
                    className="mt-3 block text-center text-xs text-amber-600 hover:text-amber-800"
                  >
                    View all {reassessmentsDue.length} reassessments
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Reviews */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-slate-600" />
                  Upcoming Reviews
                </h2>
                <Link to="/vendors" className="text-xs text-slate-600 hover:text-slate-900">
                  View all
                </Link>
              </div>
            </div>
            <div className="p-4">
              {upcomingReviews.length > 0 ? (
                <div className="space-y-2">
                  {upcomingReviews.slice(0, 3).map((vendor) => (
                    <Link
                      key={vendor.id}
                      to={`/vendors/${vendor.id}`}
                      className="block p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm text-slate-900">{vendor.legal_name}</h3>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            {vendor.tier && tierConfig[vendor.tier]?.label}
                          </span>
                          {vendor.next_review_date && (
                            <span className="text-slate-600">
                              {formatDate(vendor.next_review_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No upcoming reviews</p>
                </div>
              )}
            </div>
          </div>

          {/* OSFI B-10 Compliance */}
          {complianceStats && complianceStats.total > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-slate-600" />
                    OSFI B-10
                  </h2>
                  <Link to="/compliance/osfi-b10" className="text-xs text-slate-600 hover:text-slate-900">
                    Details
                  </Link>
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-col items-center mb-4">
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="#e2e8f0"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke={complianceStats.score >= 80 ? '#10b981' : complianceStats.score >= 60 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(complianceStats.score / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-slate-900">{complianceStats.score.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-emerald-50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                    </div>
                    <p className="text-lg font-bold text-emerald-600">{complianceStats.compliant}</p>
                    <p className="text-xs text-slate-600">Compliant</p>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    </div>
                    <p className="text-lg font-bold text-amber-600">{complianceStats.partially_compliant}</p>
                    <p className="text-xs text-slate-600">Partial</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <XCircle className="w-3 h-3 text-red-500" />
                    </div>
                    <p className="text-lg font-bold text-red-600">{complianceStats.non_compliant}</p>
                    <p className="text-xs text-slate-600">Non-Compliant</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-lg font-bold text-slate-400 mt-4">{complianceStats.not_assessed}</p>
                    <p className="text-xs text-slate-600">Not Assessed</p>
                  </div>
                </div>
                {complianceStats.non_compliant > 0 && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-xs text-red-700">
                      <span className="font-medium">{complianceStats.non_compliant}</span> require remediation
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

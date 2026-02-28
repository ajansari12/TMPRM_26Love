import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { TieringAssessment, Vendor } from '../types';
import { tierConfig } from '../lib/riskCalculations';
import { formatDate } from '../lib/utils';
import { FileText, Filter, Download, Eye, Search, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '../lib/exportUtils';
import { logger } from '../lib/logger';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

interface AssessmentWithVendor extends TieringAssessment {
  vendor?: Vendor;
}

export default function Assessments() {
  const { currentOrganization } = useOrganization();
  const [assessments, setAssessments] = useState<AssessmentWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTier, setFilterTier] = useState('all');

  useEffect(() => {
    if (currentOrganization) {
      fetchAssessments();
    }
  }, [currentOrganization]);

  const fetchAssessments = async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('tiering_assessments')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('assessment_date', { ascending: false });

      if (assessmentsError) throw assessmentsError;

      const vendorIds = [...new Set(assessmentsData?.map(a => a.vendor_id))];
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .in('id', vendorIds.length > 0 ? vendorIds : ['']);

      if (vendorsError) throw vendorsError;

      const vendorMap = new Map(vendorsData?.map(v => [v.id, v]));
      const enrichedAssessments = assessmentsData?.map(assessment => ({
        ...assessment,
        vendor: vendorMap.get(assessment.vendor_id),
      }));

      setAssessments(enrichedAssessments || []);
    } catch (error) {
      logger.error('Error fetching assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssessments = assessments.filter((assessment) => {
    const matchesSearch = !searchTerm ||
      assessment.vendor?.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.assessment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.assessor_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || assessment.status === filterStatus;
    const matchesTier = filterTier === 'all' || assessment.calculated_tier === filterTier;

    return matchesSearch && matchesStatus && matchesTier;
  });

  const handleExport = () => {
    if (filteredAssessments.length === 0) {
      toast.error('No data to export. Try adjusting your filters.');
      return;
    }

    const exportData = filteredAssessments.map(assessment => ({
      assessment_id: assessment.assessment_id || 'N/A',
      vendor_name: assessment.vendor?.legal_name || 'N/A',
      assessment_date: formatDate(assessment.assessment_date),
      assessment_type: assessment.assessment_type || 'N/A',
      status: assessment.status || 'N/A',
      calculated_tier: assessment.calculated_tier || 'N/A',
      inherent_risk_score: assessment.inherent_risk_score ?? 'N/A',
      residual_risk_score: assessment.residual_risk_score ?? 'N/A',
      risk_rating: assessment.risk_rating || 'N/A',
      assessor_name: assessment.assessor_name || 'N/A',
    }));

    const result = exportToCSV(
      exportData,
      'assessments',
      [
        { key: 'assessment_id', label: 'Assessment ID' },
        { key: 'vendor_name', label: 'Vendor Name' },
        { key: 'assessment_date', label: 'Assessment Date' },
        { key: 'assessment_type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'calculated_tier', label: 'Tier' },
        { key: 'inherent_risk_score', label: 'Inherent Risk Score' },
        { key: 'residual_risk_score', label: 'Residual Risk Score' },
        { key: 'risk_rating', label: 'Risk Rating' },
        { key: 'assessor_name', label: 'Assessor' },
      ]
    );

    if (result.success) {
      toast.success(`Exported ${filteredAssessments.length} assessments to CSV`);
    } else {
      toast.error(result.error || 'Failed to export data');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-800',
      completed: 'bg-emerald-100 text-emerald-800',
      under_review: 'bg-amber-100 text-amber-800',
      approved: 'bg-blue-100 text-blue-800',
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view assessments</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-56 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-80 bg-slate-200 rounded animate-pulse" />
        </div>
        <CardSkeleton count={3} />
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <TableSkeleton rows={6} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Risk Assessments</h1>
        <p className="text-slate-600 mt-1">View and manage all tiering assessments</p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by vendor, assessment ID, or assessor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="completed">Completed</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                </select>
              </div>

              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="all">All Tiers</option>
                <option value="tier_5_critical">Tier 5 - Critical</option>
                <option value="tier_4_high">Tier 4 - High</option>
                <option value="tier_3_moderate">Tier 3 - Moderate</option>
                <option value="tier_2_low">Tier 2 - Low</option>
                <option value="tier_1_informational">Tier 1 - Informational</option>
              </select>

              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Total Assessments</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{assessments.length}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Completed</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {assessments.filter(a => a.status === 'completed').length}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Under Review</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {assessments.filter(a => a.status === 'under_review').length}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Approved</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {assessments.filter(a => a.status === 'approved').length}
              </p>
            </div>
          </div>

          {filteredAssessments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No assessments found</p>
              <Link
                to="/vendors"
                className="inline-block px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                View Vendors
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Assessment ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Vendor</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Tier</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Risk Rating</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Assessor</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.map((assessment) => {
                    const tierInfo = assessment.calculated_tier && tierConfig[assessment.calculated_tier];

                    return (
                      <tr key={assessment.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-slate-900">
                            {assessment.assessment_id}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            to={`/vendors/${assessment.vendor_id}`}
                            className="text-sm text-slate-900 hover:text-slate-600"
                          >
                            {assessment.vendor?.legal_name || 'Unknown'}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          {tierInfo && (
                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${tierInfo.bgClass}`}>
                              {tierInfo.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-slate-900">
                            {assessment.risk_rating?.toFixed(2) || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusBadge(assessment.status || 'draft')}`}>
                            {assessment.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {assessment.assessment_date ? formatDate(assessment.assessment_date) : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {assessment.assessor_name || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link
                              to={`/vendors/${assessment.vendor_id}`}
                              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Assessment Type Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Initial Assessment', count: assessments.filter(a => a.assessment_type === 'initial').length },
              { label: 'Annual Review', count: assessments.filter(a => a.assessment_type === 'annual_review').length },
              { label: 'Periodic Review', count: assessments.filter(a => a.assessment_type === 'periodic_review').length },
              { label: 'Change Assessment', count: assessments.filter(a => a.assessment_type === 'change_assessment').length },
              { label: 'Incident-Driven', count: assessments.filter(a => a.assessment_type === 'incident_driven').length },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{item.label}</span>
                <span className="text-sm font-semibold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Tier Distribution</h2>
          <div className="space-y-3">
            {[
              { label: 'Tier 5 - Critical', tier: 'tier_5_critical', color: 'text-red-600' },
              { label: 'Tier 4 - High', tier: 'tier_4_high', color: 'text-orange-600' },
              { label: 'Tier 3 - Moderate', tier: 'tier_3_moderate', color: 'text-amber-600' },
              { label: 'Tier 2 - Low', tier: 'tier_2_low', color: 'text-emerald-600' },
              { label: 'Tier 1 - Informational', tier: 'tier_1_informational', color: 'text-slate-600' },
            ].map((item) => {
              const count = assessments.filter(a => a.calculated_tier === item.tier).length;
              return (
                <div key={item.tier} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <span className={`text-sm font-semibold ${item.color}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

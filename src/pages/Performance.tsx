import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { logger } from '../lib/logger';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Building2,
  Gauge,
  ArrowRight,
  XCircle,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PerformanceReview {
  id: string;
  vendor_id: string;
  review_period_start: string;
  review_period_end: string;
  review_type: string | null;
  status: string;
  sla_compliance_percentage: number | null;
  sla_compliance_rate: number | null;
  sla_summary: string | null;
  availability_percentage: number | null;
  incident_count: number | null;
  overall_rating: string | null;
  meeting_expectations: boolean | null;
  action_required: boolean;
  vendors: {
    legal_name: string;
    tier: string;
  };
}

interface SLADashboardData {
  total_slas: number;
  vendors_with_slas: number;
  overall_compliance: number;
  recent_misses: Array<{
    vendor_name: string;
    vendor_id: string;
    sla_name: string;
    actual_value: number;
    target_value: number;
    target_unit: string;
    period_end: string;
  }>;
  by_category: Array<{
    category: string;
    count: number;
    compliance: number;
  }>;
}

interface Vendor {
  id: string;
  name: string;
  legal_name: string;
}

interface CreateReviewForm {
  vendor_id: string;
  review_period_start: string;
  review_period_end: string;
  review_type: string;
}

interface VendorSLAData {
  totalSLAs: number;
  meetingTarget: number;
  complianceRate: number;
  slas: Array<{
    name: string;
    target: number;
    targetUnit: string;
    latest: number | null;
    met: boolean | null;
  }>;
}

export default function Performance() {
  const { currentOrganization } = useOrganization();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [slaDashboard, setSlaDashboard] = useState<SLADashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [saving, setSaving] = useState(false);
  const [vendorSLAData, setVendorSLAData] = useState<VendorSLAData | null>(null);
  const [loadingSLAData, setLoadingSLAData] = useState(false);
  const [formData, setFormData] = useState<CreateReviewForm>({
    vendor_id: '',
    review_period_start: '',
    review_period_end: '',
    review_type: 'quarterly',
  });

  const fetchVendors = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, legal_name')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active')
        .order('legal_name');

      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      logger.error('Error fetching vendors:', err);
    }
  }, [currentOrganization]);

  const fetchVendorSLAData = useCallback(async (vendorId: string) => {
    if (!currentOrganization || !vendorId) return null;

    setLoadingSLAData(true);
    try {
      const { data: slas, error } = await supabase
        .from('vendor_slas')
        .select('*, sla_measurements(*)')
        .eq('vendor_id', vendorId)
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true);

      if (error) throw error;

      if (!slas || slas.length === 0) {
        setVendorSLAData(null);
        return null;
      }

      const totalSLAs = slas.length;
      const meetingTarget = slas.filter((sla) => {
        const measurements = sla.sla_measurements || [];
        if (measurements.length === 0) return false;
        const latest = measurements[measurements.length - 1];
        return latest.target_met;
      }).length;

      const complianceRate = totalSLAs > 0 ? Math.round((meetingTarget / totalSLAs) * 100) : 0;

      const slaData: VendorSLAData = {
        totalSLAs,
        meetingTarget,
        complianceRate,
        slas: slas.map((s) => {
          const measurements = s.sla_measurements || [];
          const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
          return {
            name: s.sla_name,
            target: s.target_value,
            targetUnit: s.target_unit,
            latest: latest?.actual_value || null,
            met: latest?.target_met || null,
          };
        }),
      };

      setVendorSLAData(slaData);
      return slaData;
    } catch (err) {
      logger.error('Error fetching vendor SLA data:', err);
      setVendorSLAData(null);
      return null;
    } finally {
      setLoadingSLAData(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    if (currentOrganization) {
      fetchReviews();
      fetchSlaDashboard();
      fetchVendors();
    }
  }, [currentOrganization, fetchVendors]);

  useEffect(() => {
    if (formData.vendor_id && showCreateModal) {
      fetchVendorSLAData(formData.vendor_id);
    } else {
      setVendorSLAData(null);
    }
  }, [formData.vendor_id, showCreateModal, fetchVendorSLAData]);

  async function fetchReviews() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('performance_reviews')
        .select(`
          *,
          vendors (
            legal_name,
            tier
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('review_period_end', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      logger.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlaDashboard() {
    if (!currentOrganization) return;
    try {
      const { data: slas, error: slasError } = await supabase
        .from('vendor_slas')
        .select('id, vendor_id, sla_name, sla_category, target_value, target_unit')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true);

      if (slasError) throw slasError;
      if (!slas || slas.length === 0) return;

      const vendorIds = [...new Set(slas.map((s) => s.vendor_id))];

      const [measurementsRes, vendorsRes] = await Promise.all([
        supabase
          .from('sla_measurements')
          .select('*')
          .in('sla_id', slas.map((s) => s.id))
          .order('measurement_period_end', { ascending: false }),
        supabase
          .from('vendors')
          .select('id, legal_name')
          .in('id', vendorIds),
      ]);

      const measurements = measurementsRes.data || [];
      const vendors = vendorsRes.data || [];

      const totalMeasurements = measurements.length;
      const metCount = measurements.filter((m) => m.target_met).length;
      const overallCompliance = totalMeasurements > 0 ? (metCount / totalMeasurements) * 100 : 100;

      const recentMissedMeasurements = measurements
        .filter((m) => !m.target_met)
        .slice(0, 5)
        .map((m) => {
          const sla = slas.find((s) => s.id === m.sla_id);
          const vendor = vendors.find((v) => v.id === sla?.vendor_id);
          return {
            vendor_name: vendor?.legal_name || 'Unknown',
            vendor_id: sla?.vendor_id || '',
            sla_name: sla?.sla_name || '',
            actual_value: m.actual_value,
            target_value: sla?.target_value || 0,
            target_unit: sla?.target_unit || '',
            period_end: m.measurement_period_end,
          };
        });

      const categoryGroups: Record<string, { count: number; met: number; total: number }> = {};
      slas.forEach((sla) => {
        const cat = sla.sla_category || 'other';
        if (!categoryGroups[cat]) categoryGroups[cat] = { count: 0, met: 0, total: 0 };
        categoryGroups[cat].count++;
        const slaMeasurements = measurements.filter((m) => m.sla_id === sla.id);
        categoryGroups[cat].total += slaMeasurements.length;
        categoryGroups[cat].met += slaMeasurements.filter((m) => m.target_met).length;
      });

      const byCategory = Object.entries(categoryGroups).map(([category, data]) => ({
        category: category.replace('_', ' '),
        count: data.count,
        compliance: data.total > 0 ? (data.met / data.total) * 100 : 100,
      }));

      setSlaDashboard({
        total_slas: slas.length,
        vendors_with_slas: vendorIds.length,
        overall_compliance: overallCompliance,
        recent_misses: recentMissedMeasurements,
        by_category: byCategory,
      });
    } catch (error) {
      logger.error('Error fetching SLA dashboard:', error);
    }
  }

  const handleCreateReview = async () => {
    if (!currentOrganization || !formData.vendor_id || !formData.review_period_start || !formData.review_period_end) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('performance_reviews').insert({
        organization_id: currentOrganization.id,
        vendor_id: formData.vendor_id,
        review_period_start: formData.review_period_start,
        review_period_end: formData.review_period_end,
        review_type: formData.review_type,
        status: 'scheduled',
        action_required: false,
        sla_compliance_rate: vendorSLAData?.complianceRate || null,
        sla_summary: vendorSLAData ? JSON.stringify(vendorSLAData.slas) : null,
      });

      if (error) throw error;

      toast.success('Performance review created successfully');
      setShowCreateModal(false);
      setFormData({
        vendor_id: '',
        review_period_start: '',
        review_period_end: '',
        review_type: 'quarterly',
      });
      setVendorSLAData(null);
      fetchReviews();
    } catch (err) {
      logger.error('Error creating review:', err);
      toast.error('Failed to create performance review');
    } finally {
      setSaving(false);
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.vendors.legal_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || review.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getRatingBadge = (rating: string | null) => {
    if (!rating) return 'bg-gray-100 text-gray-800';
    const styles = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      satisfactory: 'bg-yellow-100 text-yellow-800',
      needs_improvement: 'bg-orange-100 text-orange-800',
      unsatisfactory: 'bg-red-100 text-red-800',
    };
    return styles[rating as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const avgSLA = reviews.filter(r => r.sla_compliance_percentage).reduce((sum, r) => sum + (r.sla_compliance_percentage || 0), 0) / reviews.filter(r => r.sla_compliance_percentage).length || 0;
  const avgAvailability = reviews.filter(r => r.availability_percentage).reduce((sum, r) => sum + (r.availability_percentage || 0), 0) / reviews.filter(r => r.availability_percentage).length || 0;
  const actionRequired = reviews.filter(r => r.action_required).length;

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view performance reviews</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading performance reviews...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track vendor performance and service level agreements
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Review
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reviews</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{reviews.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg SLA Compliance</p>
              <p className="text-2xl font-semibold text-green-600 mt-1">{avgSLA.toFixed(1)}%</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Availability</p>
              <p className="text-2xl font-semibold text-blue-600 mt-1">{avgAvailability.toFixed(2)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Action Required</p>
              <p className="text-2xl font-semibold text-red-600 mt-1">{actionRequired}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {slaDashboard && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-gray-900">SLA Performance Overview</h2>
            </div>
            <span className="text-sm text-gray-500">
              {slaDashboard.total_slas} SLAs across {slaDashboard.vendors_with_slas} vendors
            </span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-gray-600">Total SLAs</p>
                <p className="text-2xl font-bold text-slate-900">{slaDashboard.total_slas}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-gray-600">Vendors with SLAs</p>
                <p className="text-2xl font-bold text-slate-900">{slaDashboard.vendors_with_slas}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-gray-600">Overall Compliance</p>
                <p className={`text-2xl font-bold ${
                  slaDashboard.overall_compliance >= 95 ? 'text-emerald-600' :
                  slaDashboard.overall_compliance >= 90 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {slaDashboard.overall_compliance.toFixed(1)}%
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-gray-600">Recent Misses</p>
                <p className={`text-2xl font-bold ${slaDashboard.recent_misses.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {slaDashboard.recent_misses.length}
                </p>
              </div>
            </div>

            {slaDashboard.by_category.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Compliance by Category</h3>
                <div className="space-y-2">
                  {slaDashboard.by_category.map((cat) => (
                    <div key={cat.category} className="flex items-center gap-3">
                      <span className="w-32 text-sm text-gray-600 capitalize">{cat.category}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cat.compliance >= 95 ? 'bg-emerald-500' :
                            cat.compliance >= 90 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${cat.compliance}%` }}
                        />
                      </div>
                      <span className="w-16 text-sm font-medium text-right">{cat.compliance.toFixed(0)}%</span>
                      <span className="w-16 text-xs text-gray-500 text-right">{cat.count} SLAs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {slaDashboard.recent_misses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recent SLA Misses</h3>
                <div className="space-y-2">
                  {slaDashboard.recent_misses.map((miss, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{miss.sla_name}</p>
                          <p className="text-xs text-gray-600">{miss.vendor_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900">
                          {miss.actual_value}{miss.target_unit === 'percent' ? '%' : ` ${miss.target_unit}`}
                          <span className="text-gray-500"> / </span>
                          {miss.target_value}{miss.target_unit === 'percent' ? '%' : ` ${miss.target_unit}`}
                        </p>
                        <p className="text-xs text-gray-500">{format(new Date(miss.period_end), 'MMM d, yyyy')}</p>
                      </div>
                      <Link
                        to={`/vendors/${miss.vendor_id}/sla`}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SLA Compliance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Availability
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Incidents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500 mb-1">No performance reviews found</p>
                    <p className="text-sm text-gray-400">Performance reviews are generated for active vendors based on their review schedule.</p>
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{review.vendors.legal_name}</div>
                          <div className="text-xs text-gray-500">{review.vendors.tier?.replace('tier_', 'Tier ').replace('_', ' - ') || 'Not Assessed'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(review.review_period_start), 'MMM yyyy')} -<br />
                      {format(new Date(review.review_period_end), 'MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {review.sla_compliance_rate !== null ? (
                          <>
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                review.sla_compliance_rate >= 90
                                  ? 'bg-green-100 text-green-800'
                                  : review.sla_compliance_rate >= 70
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {review.sla_compliance_rate.toFixed(0)}%
                            </span>
                            {review.sla_compliance_rate >= 90 && (
                              <TrendingUp className="w-4 h-4 text-green-600" />
                            )}
                            {review.sla_compliance_rate < 70 && (
                              <TrendingDown className="w-4 h-4 text-red-600" />
                            )}
                          </>
                        ) : review.sla_compliance_percentage !== null ? (
                          <>
                            <span className="text-sm font-medium text-gray-900">
                              {review.sla_compliance_percentage.toFixed(1)}%
                            </span>
                            {review.sla_compliance_percentage >= 95 && (
                              <TrendingUp className="w-4 h-4 text-green-600" />
                            )}
                            {review.sla_compliance_percentage < 90 && (
                              <TrendingDown className="w-4 h-4 text-red-600" />
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {review.availability_percentage?.toFixed(2) || '-'}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {review.incident_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {review.overall_rating ? (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRatingBadge(review.overall_rating)}`}>
                          {review.overall_rating.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 capitalize">{review.status.replace('_', ' ')}</span>
                        {review.action_required && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Create Performance Review</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              {loadingSLAData && formData.vendor_id && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Gauge className="w-4 h-4 animate-spin" />
                    Loading SLA data...
                  </div>
                </div>
              )}

              {!loadingSLAData && vendorSLAData && formData.vendor_id && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-slate-600" />
                      SLA Compliance Summary
                    </h3>
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        vendorSLAData.complianceRate >= 90
                          ? 'bg-green-100 text-green-800'
                          : vendorSLAData.complianceRate >= 70
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {vendorSLAData.complianceRate}% Compliance
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {vendorSLAData.meetingTarget} of {vendorSLAData.totalSLAs} SLAs meeting target
                  </div>
                  {vendorSLAData.slas.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {vendorSLAData.slas.map((sla, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-white rounded border border-slate-200"
                        >
                          <div className="flex-1">
                            <div className="text-xs font-medium text-gray-900">{sla.name}</div>
                            <div className="text-xs text-gray-500">
                              Target: {sla.target}
                              {sla.targetUnit === 'percent' ? '%' : ` ${sla.targetUnit}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {sla.latest !== null ? (
                              <>
                                <span className="text-xs font-medium text-gray-900">
                                  {sla.latest}
                                  {sla.targetUnit === 'percent' ? '%' : ` ${sla.targetUnit}`}
                                </span>
                                {sla.met ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">No data</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 italic">
                    This SLA data will be saved with the performance review as a point-in-time snapshot.
                  </p>
                </div>
              )}

              {!loadingSLAData && !vendorSLAData && formData.vendor_id && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <AlertCircle className="w-4 h-4" />
                    No SLA data available for this vendor
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Type
                </label>
                <select
                  value={formData.review_type}
                  onChange={(e) => setFormData({ ...formData, review_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annual">Semi-Annual</option>
                  <option value="annual">Annual</option>
                  <option value="ad_hoc">Ad-Hoc</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.review_period_start}
                    onChange={(e) => setFormData({ ...formData, review_period_start: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period End <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.review_period_end}
                    onChange={(e) => setFormData({ ...formData, review_period_end: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReview}
                disabled={saving || !formData.vendor_id || !formData.review_period_start || !formData.review_period_end}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

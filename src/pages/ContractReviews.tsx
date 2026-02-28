import { useState, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { logger } from '../lib/logger';
import { format } from 'date-fns';
import {
  FileSearch,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  Filter,
  ChevronRight,
  FileText,
  Loader2,
  Play,
  Shield,
  Building2,
} from 'lucide-react';

type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'approved_with_conditions' | 'rejected';

interface ContractReview {
  id: string;
  contract_id: string;
  review_type: string;
  status: ReviewStatus;
  priority: string;
  assigned_to: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  legal_notes: string | null;
  conditions: string | null;
  recommendations: string | null;
  annex2_compliance_score: number | null;
  provisions_missing: string[] | null;
  risk_flags: string[] | null;
  decision: string | null;
  decision_notes: string | null;
  created_at: string;
  contract?: {
    id: string;
    title: string;
    contract_number: string;
    vendor_id: string;
    expiry_date: string;
    annual_value_cad: number;
    vendor?: {
      legal_name: string;
      tier: string;
    };
  };
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; icon: LucideIcon }> = {
  pending: { label: 'Pending', color: 'gray', icon: Clock },
  in_review: { label: 'In Review', color: 'blue', icon: FileSearch },
  approved: { label: 'Approved', color: 'emerald', icon: CheckCircle },
  approved_with_conditions: { label: 'Approved with Conditions', color: 'amber', icon: AlertTriangle },
  rejected: { label: 'Rejected', color: 'red', icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'gray' },
  normal: { label: 'Normal', color: 'blue' },
  high: { label: 'High', color: 'orange' },
  urgent: { label: 'Urgent', color: 'red' },
};

const ANNEX2_PROVISIONS = [
  { key: 'has_scope_definition', label: 'Scope Definition' },
  { key: 'has_roles_responsibilities', label: 'Roles & Responsibilities' },
  { key: 'has_subcontractor_provisions', label: 'Subcontractor Provisions' },
  { key: 'has_pricing_terms', label: 'Pricing Terms' },
  { key: 'has_performance_measures', label: 'Performance Measures' },
  { key: 'has_ownership_access', label: 'Ownership & Access' },
  { key: 'has_data_security', label: 'Data Security' },
  { key: 'has_notification_requirements', label: 'Notification Requirements' },
  { key: 'has_dispute_resolution', label: 'Dispute Resolution' },
  { key: 'has_regulatory_compliance', label: 'Regulatory Compliance' },
  { key: 'has_bcp_requirements', label: 'BCP Requirements' },
  { key: 'has_termination_provisions', label: 'Termination Provisions' },
  { key: 'has_insurance_requirements', label: 'Insurance Requirements' },
  { key: 'has_audit_rights', label: 'Audit Rights' },
  { key: 'has_osfi_access_clause', label: 'OSFI Access Clause' },
];

export default function ContractReviews() {
  const { user, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const [reviews, setReviews] = useState<ContractReview[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<ContractReview | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    status: 'pending' as ReviewStatus,
    legal_notes: '',
    conditions: '',
    recommendations: '',
    risk_flags: [] as string[],
    provisions_missing: [] as string[],
    decision: '',
    decision_notes: '',
  });

  useEffect(() => {
    if (currentOrganization) {
      fetchData();
    }
  }, [currentOrganization]);

  async function fetchData() {
    if (!currentOrganization) return;
    try {
      const vendorsRes = await supabase.from('vendors').select('id, legal_name, tier').eq('organization_id', currentOrganization.id);
      const vendorIds = (vendorsRes.data || []).map(v => v.id);

      const [reviewsRes, contractsRes, profilesRes] = await Promise.all([
        supabase.from('contract_reviews').select('*').eq('organization_id', currentOrganization.id).order('created_at', { ascending: false }),
        vendorIds.length > 0
          ? supabase.from('contracts').select('*').in('vendor_id', vendorIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('profiles').select('id, full_name, role'),
      ]);

      setReviews(reviewsRes.data || []);
      setContracts(contractsRes.data || []);
      setVendors(vendorsRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getReviewWithDetails(review: ContractReview): ContractReview {
    const contract = contracts.find((c) => c.id === review.contract_id);
    const vendor = contract ? vendors.find((v) => v.id === contract.vendor_id) : null;
    return {
      ...review,
      contract: contract ? { ...contract, vendor } : undefined,
    };
  }

  const filteredReviews = reviews
    .map(getReviewWithDetails)
    .filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
      return true;
    });

  const stats = {
    pending: reviews.filter((r) => r.status === 'pending').length,
    inReview: reviews.filter((r) => r.status === 'in_review').length,
    approved: reviews.filter((r) => r.status === 'approved' || r.status === 'approved_with_conditions').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
  };

  async function handleStartReview(review: ContractReview) {
    try {
      const { error } = await supabase
        .from('contract_reviews')
        .update({
          status: 'in_review',
          assigned_to: user?.id,
          assigned_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
        })
        .eq('id', review.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      logger.error('Error starting review:', error);
    }
  }

  function openReviewModal(review: ContractReview) {
    const detailed = getReviewWithDetails(review);
    setSelectedReview(detailed);
    setFormData({
      status: review.status,
      legal_notes: review.legal_notes || '',
      conditions: review.conditions || '',
      recommendations: review.recommendations || '',
      risk_flags: review.risk_flags || [],
      provisions_missing: review.provisions_missing || [],
      decision: review.decision || '',
      decision_notes: review.decision_notes || '',
    });
    setShowModal(true);
  }

  async function handleSaveReview() {
    if (!selectedReview) return;
    setSaving(true);

    try {
      const updates: Record<string, unknown> = {
        status: formData.status,
        legal_notes: formData.legal_notes,
        conditions: formData.conditions,
        recommendations: formData.recommendations,
        risk_flags: formData.risk_flags,
        provisions_missing: formData.provisions_missing,
        updated_at: new Date().toISOString(),
      };

      if (['approved', 'approved_with_conditions', 'rejected'].includes(formData.status)) {
        updates.decision = formData.decision;
        updates.decision_notes = formData.decision_notes;
        updates.decision_by = user?.id;
        updates.decision_date = new Date().toISOString();
        updates.completed_at = new Date().toISOString();
      }

      const contract = contracts.find((c) => c.id === selectedReview.contract_id);
      if (contract) {
        const completedProvisions = ANNEX2_PROVISIONS.filter((p) => contract[p.key]).length;
        updates.annex2_compliance_score = Math.round((completedProvisions / ANNEX2_PROVISIONS.length) * 100);
        updates.provisions_missing = ANNEX2_PROVISIONS.filter((p) => !contract[p.key]).map((p) => p.label);
      }

      const { error } = await supabase
        .from('contract_reviews')
        .update(updates)
        .eq('id', selectedReview.id);

      if (error) throw error;

      if (contract) {
        await supabase
          .from('contracts')
          .update({
            legal_review_status: formData.status,
            legal_reviewer: profile?.full_name,
            legal_review_date: new Date().toISOString().split('T')[0],
            legal_review_notes: formData.legal_notes,
          })
          .eq('id', contract.id);
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      logger.error('Error saving review:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateReview(contractId: string) {
    if (!currentOrganization) return;
    try {
      const { error } = await supabase.from('contract_reviews').insert({
        contract_id: contractId,
        review_type: 'initial',
        status: 'pending',
        priority: 'normal',
        organization_id: currentOrganization.id,
      });

      if (error) throw error;
      fetchData();
    } catch (error) {
      logger.error('Error creating review:', error);
    }
  }

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view contract reviews</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contract Reviews</h1>
          <p className="mt-1 text-sm text-gray-500">
            Legal review workflow for contract compliance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Review</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.inReview}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileSearch className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.approved}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
          >
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <div className="ml-auto text-sm text-gray-500">
            {filteredReviews.length} reviews
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredReviews.length === 0 ? (
            <div className="p-8 text-center">
              <FileSearch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">No contract reviews found</p>
              <p className="text-sm text-gray-400">Contract reviews will appear here when contracts are scheduled for renewal or review.</p>
            </div>
          ) : (
            filteredReviews.map((review) => {
              const StatusIcon = STATUS_CONFIG[review.status].icon;
              return (
                <div key={review.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-gray-900">
                          {review.contract?.title || 'Unknown Contract'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          STATUS_CONFIG[review.status].color === 'gray' ? 'bg-gray-100 text-gray-700' :
                          STATUS_CONFIG[review.status].color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          STATUS_CONFIG[review.status].color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                          STATUS_CONFIG[review.status].color === 'amber' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {STATUS_CONFIG[review.status].label}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          PRIORITY_CONFIG[review.priority]?.color === 'red' ? 'bg-red-100 text-red-700' :
                          PRIORITY_CONFIG[review.priority]?.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          PRIORITY_CONFIG[review.priority]?.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {PRIORITY_CONFIG[review.priority]?.label || review.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {review.contract?.vendor && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {review.contract.vendor.legal_name}
                          </span>
                        )}
                        {review.contract?.contract_number && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {review.contract.contract_number}
                          </span>
                        )}
                        {review.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Due: {format(new Date(review.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                        {review.assigned_to && (
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {profiles.find((p) => p.id === review.assigned_to)?.full_name || 'Assigned'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {review.status === 'pending' && (
                        <button
                          onClick={() => handleStartReview(review)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Start Review
                        </button>
                      )}
                      <button
                        onClick={() => openReviewModal(review)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && selectedReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Contract Review</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedReview.contract?.title || 'Unknown Contract'}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 uppercase">Vendor</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {selectedReview.contract?.vendor?.legal_name || 'Unknown'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 uppercase">Contract Value</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {selectedReview.contract?.annual_value_cad
                      ? `$${selectedReview.contract.annual_value_cad.toLocaleString()} CAD`
                      : 'Not specified'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 uppercase">Expiry Date</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {selectedReview.contract?.expiry_date
                      ? format(new Date(selectedReview.contract.expiry_date), 'MMM d, yyyy')
                      : 'Not specified'}
                  </p>
                </div>
              </div>

              {selectedReview.contract && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    OSFI B-10 Annex 2 Compliance
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ANNEX2_PROVISIONS.map((provision) => {
                      const hasProvision = selectedReview.contract?.[provision.key];
                      return (
                        <div
                          key={provision.key}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            hasProvision ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {hasProvision ? (
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span className="truncate">{provision.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ReviewStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal Notes</label>
                <textarea
                  value={formData.legal_notes}
                  onChange={(e) => setFormData({ ...formData, legal_notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter review notes, observations, and findings..."
                />
              </div>

              {(formData.status === 'approved_with_conditions' || formData.status === 'rejected') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.status === 'approved_with_conditions' ? 'Conditions' : 'Rejection Reason'}
                  </label>
                  <textarea
                    value={formData.conditions}
                    onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={formData.status === 'approved_with_conditions'
                      ? 'Enter conditions that must be met...'
                      : 'Enter reason for rejection...'}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
                <textarea
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter recommendations for contract improvements..."
                />
              </div>

              {['approved', 'approved_with_conditions', 'rejected'].includes(formData.status) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Decision Notes</label>
                  <textarea
                    value={formData.decision_notes}
                    onChange={(e) => setFormData({ ...formData, decision_notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Final decision summary..."
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReview}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

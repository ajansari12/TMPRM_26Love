import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { formatDate } from '../lib/utils';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Building2,
  X,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '../lib/exportUtils';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

interface RiskException {
  id: string;
  organization_id: string;
  vendor_id: string | null;
  exception_type: 'policy' | 'control' | 'regulatory' | 'contractual';
  title: string;
  description: string;
  risk_description: string;
  inherent_risk_level: 'critical' | 'high' | 'medium' | 'low';
  residual_risk_level: 'critical' | 'high' | 'medium' | 'low';
  mitigating_controls: string[];
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'remediated';
  requested_by: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  review_frequency_days: number;
  next_review_date: string | null;
  remediation_plan: string | null;
  remediation_due_date: string | null;
  remediation_status: 'not_started' | 'in_progress' | 'completed' | 'deferred' | null;
  created_at: string;
  vendor?: { legal_name: string } | null;
  requester?: { full_name: string; email: string } | null;
  approver?: { full_name: string; email: string } | null;
}

const TYPE_CONFIG = {
  policy: { label: 'Policy Exception', color: 'bg-blue-100 text-blue-800' },
  control: { label: 'Control Exception', color: 'bg-emerald-100 text-emerald-800' },
  regulatory: { label: 'Regulatory Exception', color: 'bg-amber-100 text-amber-800' },
  contractual: { label: 'Contractual Exception', color: 'bg-purple-100 text-purple-800' },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-slate-100 text-slate-800', icon: AlertTriangle },
  remediated: { label: 'Remediated', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
};

const RISK_LEVEL_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  low: { label: 'Low', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

export default function RiskExceptions() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [exceptions, setExceptions] = useState<RiskException[]>([]);
  const [vendors, setVendors] = useState<{ id: string; legal_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedException, setSelectedException] = useState<RiskException | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vendor_id: '',
    exception_type: 'policy' as RiskException['exception_type'],
    title: '',
    description: '',
    risk_description: '',
    inherent_risk_level: 'medium' as RiskException['inherent_risk_level'],
    residual_risk_level: 'low' as RiskException['residual_risk_level'],
    mitigating_controls: [''],
    effective_date: '',
    expiry_date: '',
    review_frequency_days: 90,
    remediation_plan: '',
    remediation_due_date: '',
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchData = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const [exceptionsRes, vendorsRes] = await Promise.all([
        supabase
          .from('risk_exceptions')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('vendors')
          .select('id, legal_name')
          .eq('organization_id', currentOrganization.id)
          .order('legal_name'),
      ]);

      if (exceptionsRes.error) throw exceptionsRes.error;
      if (vendorsRes.error) throw vendorsRes.error;

      let enrichedExceptions = exceptionsRes.data || [];

      if (enrichedExceptions.length > 0) {
        const vendorIds = [...new Set(enrichedExceptions.filter(e => e.vendor_id).map(e => e.vendor_id))];
        const userIds = [...new Set([
          ...enrichedExceptions.map(e => e.requested_by),
          ...enrichedExceptions.filter(e => e.approved_by).map(e => e.approved_by),
        ].filter(Boolean))];

        const [vendorData, userData] = await Promise.all([
          vendorIds.length > 0
            ? supabase.from('vendors').select('id, legal_name').in('id', vendorIds)
            : { data: [] },
          userIds.length > 0
            ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
            : { data: [] },
        ]);

        const vendorMap = new Map((vendorData.data || []).map(v => [v.id, v]));
        const userMap = new Map((userData.data || []).map(u => [u.id, u]));

        enrichedExceptions = enrichedExceptions.map(e => ({
          ...e,
          vendor: e.vendor_id ? vendorMap.get(e.vendor_id) : null,
          requester: userMap.get(e.requested_by),
          approver: e.approved_by ? userMap.get(e.approved_by) : null,
        }));
      }

      setExceptions(enrichedExceptions);
      setVendors(vendorsRes.data || []);
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateException = async () => {
    if (!currentOrganization?.id || !user) return;
    if (!formData.title || !formData.description || !formData.risk_description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from('risk_exceptions').insert({
        organization_id: currentOrganization.id,
        vendor_id: formData.vendor_id || null,
        exception_type: formData.exception_type,
        title: formData.title,
        description: formData.description,
        risk_description: formData.risk_description,
        inherent_risk_level: formData.inherent_risk_level,
        residual_risk_level: formData.residual_risk_level,
        mitigating_controls: formData.mitigating_controls.filter(c => c.trim()),
        effective_date: formData.effective_date || null,
        expiry_date: formData.expiry_date || null,
        review_frequency_days: formData.review_frequency_days,
        remediation_plan: formData.remediation_plan || null,
        remediation_due_date: formData.remediation_due_date || null,
        requested_by: user.id,
        status: 'pending',
      });

      if (error) throw error;
      toast.success('Risk exception request submitted');
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      logger.error('Error creating exception:', error);
      toast.error('Failed to create exception');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (exception: RiskException) => {
    if (!user) return;

    try {
      setSaving(true);
      const nextReview = exception.review_frequency_days
        ? new Date(Date.now() + exception.review_frequency_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

      const { error } = await supabase
        .from('risk_exceptions')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          next_review_date: nextReview,
        })
        .eq('id', exception.id);

      if (error) throw error;
      toast.success('Exception approved');
      setShowDetailModal(false);
      setSelectedException(null);
      fetchData();
    } catch (error) {
      logger.error('Error approving exception:', error);
      toast.error('Failed to approve exception');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (exception: RiskException, reason: string) => {
    if (!user || !reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('risk_exceptions')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', exception.id);

      if (error) throw error;
      toast.success('Exception rejected');
      setShowDetailModal(false);
      setSelectedException(null);
      fetchData();
    } catch (error) {
      logger.error('Error rejecting exception:', error);
      toast.error('Failed to reject exception');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRemediated = async (exception: RiskException) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('risk_exceptions')
        .update({
          status: 'remediated',
          remediation_status: 'completed',
        })
        .eq('id', exception.id);

      if (error) throw error;
      toast.success('Exception marked as remediated');
      fetchData();
    } catch (error) {
      logger.error('Error updating exception:', error);
      toast.error('Failed to update exception');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vendor_id: '',
      exception_type: 'policy',
      title: '',
      description: '',
      risk_description: '',
      inherent_risk_level: 'medium',
      residual_risk_level: 'low',
      mitigating_controls: [''],
      effective_date: '',
      expiry_date: '',
      review_frequency_days: 90,
      remediation_plan: '',
      remediation_due_date: '',
    });
  };

  const addMitigatingControl = () => {
    setFormData(prev => ({
      ...prev,
      mitigating_controls: [...prev.mitigating_controls, ''],
    }));
  };

  const updateMitigatingControl = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      mitigating_controls: prev.mitigating_controls.map((c, i) => (i === index ? value : c)),
    }));
  };

  const removeMitigatingControl = (index: number) => {
    setFormData(prev => ({
      ...prev,
      mitigating_controls: prev.mitigating_controls.filter((_, i) => i !== index),
    }));
  };

  const filteredExceptions = exceptions.filter(e => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.vendor?.legal_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchesType = typeFilter === 'all' || e.exception_type === typeFilter;
    const matchesVendor = vendorFilter === 'all' || e.vendor_id === vendorFilter;
    return matchesSearch && matchesStatus && matchesType && matchesVendor;
  });

  const handleExport = () => {
    if (filteredExceptions.length === 0) {
      toast.error('No data to export. Try adjusting your filters.');
      return;
    }

    const exportData = filteredExceptions.map(exception => ({
      vendor_name: exception.vendor?.legal_name || 'N/A',
      title: exception.title || 'N/A',
      exception_type: TYPE_CONFIG[exception.exception_type]?.label || exception.exception_type || 'N/A',
      inherent_risk_level: RISK_LEVEL_CONFIG[exception.inherent_risk_level]?.label || exception.inherent_risk_level || 'N/A',
      residual_risk_level: RISK_LEVEL_CONFIG[exception.residual_risk_level]?.label || exception.residual_risk_level || 'N/A',
      status: STATUS_CONFIG[exception.status]?.label || exception.status || 'N/A',
      requested_by: exception.requested_by || 'N/A',
      requested_at: formatDate(exception.requested_at),
      approved_by: exception.approved_by || 'N/A',
      approved_at: exception.approved_at ? formatDate(exception.approved_at) : 'N/A',
      effective_date: exception.effective_date ? formatDate(exception.effective_date) : 'N/A',
      expiry_date: exception.expiry_date ? formatDate(exception.expiry_date) : 'N/A',
      remediation_plan: exception.remediation_plan || 'N/A',
      remediation_due_date: exception.remediation_due_date ? formatDate(exception.remediation_due_date) : 'N/A',
    }));

    const result = exportToCSV(
      exportData,
      'risk_exceptions',
      [
        { key: 'vendor_name', label: 'Vendor Name' },
        { key: 'title', label: 'Title' },
        { key: 'exception_type', label: 'Exception Type' },
        { key: 'inherent_risk_level', label: 'Inherent Risk Level' },
        { key: 'residual_risk_level', label: 'Residual Risk Level' },
        { key: 'status', label: 'Status' },
        { key: 'requested_by', label: 'Requested By' },
        { key: 'requested_at', label: 'Requested At' },
        { key: 'approved_by', label: 'Approved By' },
        { key: 'approved_at', label: 'Approved At' },
        { key: 'effective_date', label: 'Effective Date' },
        { key: 'expiry_date', label: 'Expiry Date' },
        { key: 'remediation_plan', label: 'Remediation Plan' },
        { key: 'remediation_due_date', label: 'Remediation Due Date' },
      ]
    );

    if (result.success) {
      toast.success(`Exported ${filteredExceptions.length} risk exceptions to CSV`);
    } else {
      toast.error(result.error || 'Failed to export data');
    }
  };

  const stats = {
    active: exceptions.filter(e => e.status === 'approved').length,
    pending: exceptions.filter(e => e.status === 'pending').length,
    expiringSoon: exceptions.filter(e => {
      if (e.status !== 'approved' || !e.expiry_date) return false;
      const daysUntilExpiry = Math.ceil((new Date(e.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    }).length,
    expired: exceptions.filter(e => e.status === 'expired').length,
  };

  const isExpiringSoon = (exception: RiskException) => {
    if (exception.status !== 'approved' || !exception.expiry_date) return false;
    const daysUntilExpiry = Math.ceil((new Date(exception.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No Organization Selected</h2>
        <p className="text-slate-600">Please select or register an organization</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center">
            <ShieldAlert className="w-8 h-8 mr-3" />
            Risk Exceptions
          </h1>
          <p className="text-slate-600 mt-1">Manage risk acceptance and exception requests</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Request Exception
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Active Exceptions</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Pending Approval</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Expiring Soon (30d)</p>
          <p className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Expired</p>
          <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search exceptions..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="all">All Types</option>
              {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="all">All Vendors</option>
              <option value="">No Vendor</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.legal_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredExceptions.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Exceptions Found</h3>
              <p className="text-slate-600">
                {exceptions.length === 0
                  ? 'No risk exceptions have been requested yet'
                  : 'No exceptions match your current filters'}
              </p>
            </div>
          ) : (
            filteredExceptions.map(exception => {
              const StatusIcon = STATUS_CONFIG[exception.status].icon;
              const isExpanded = expandedId === exception.id;
              const expiringSoon = isExpiringSoon(exception);

              return (
                <div key={exception.id} className={`${expiringSoon ? 'bg-amber-50' : ''}`}>
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedId(isExpanded ? null : exception.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${STATUS_CONFIG[exception.status].color}`}>
                          <StatusIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">{exception.title}</h3>
                            {expiringSoon && (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                                Expiring Soon
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_CONFIG[exception.exception_type].color}`}>
                              {TYPE_CONFIG[exception.exception_type].label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_CONFIG[exception.status].color}`}>
                              {STATUS_CONFIG[exception.status].label}
                            </span>
                            {exception.vendor && (
                              <Link
                                to={`/vendors/${exception.vendor_id}`}
                                onClick={e => e.stopPropagation()}
                                className="text-slate-600 hover:text-slate-900 flex items-center"
                              >
                                <Building2 className="w-3 h-3 mr-1" />
                                {exception.vendor.legal_name}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-slate-600">
                            Requested {formatDate(exception.requested_at)}
                          </p>
                          {exception.expiry_date && (
                            <p className={`${expiringSoon ? 'text-orange-600 font-medium' : 'text-slate-500'}`}>
                              Expires {formatDate(exception.expiry_date)}
                            </p>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50">
                      <div className="pt-4 grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-2">Description</h4>
                          <p className="text-sm text-slate-600">{exception.description}</p>

                          <h4 className="text-sm font-medium text-slate-700 mt-4 mb-2">Risk Description</h4>
                          <p className="text-sm text-slate-600">{exception.risk_description}</p>

                          {exception.mitigating_controls && exception.mitigating_controls.length > 0 && (
                            <>
                              <h4 className="text-sm font-medium text-slate-700 mt-4 mb-2">Mitigating Controls</h4>
                              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                                {exception.mitigating_controls.map((control, i) => (
                                  <li key={i}>{control}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>

                        <div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className={`p-3 rounded-lg border ${RISK_LEVEL_CONFIG[exception.inherent_risk_level].color}`}>
                              <p className="text-xs text-slate-600 mb-1">Inherent Risk</p>
                              <p className="font-semibold">{RISK_LEVEL_CONFIG[exception.inherent_risk_level].label}</p>
                            </div>
                            <div className={`p-3 rounded-lg border ${RISK_LEVEL_CONFIG[exception.residual_risk_level].color}`}>
                              <p className="text-xs text-slate-600 mb-1">Residual Risk</p>
                              <p className="font-semibold">{RISK_LEVEL_CONFIG[exception.residual_risk_level].label}</p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <p>
                              <span className="text-slate-500">Requested by:</span>{' '}
                              <span className="text-slate-900">{exception.requester?.full_name || 'Unknown'}</span>
                            </p>
                            {exception.approved_by && (
                              <p>
                                <span className="text-slate-500">
                                  {exception.status === 'approved' ? 'Approved' : 'Reviewed'} by:
                                </span>{' '}
                                <span className="text-slate-900">{exception.approver?.full_name || 'Unknown'}</span>
                              </p>
                            )}
                            {exception.rejection_reason && (
                              <p className="p-2 bg-red-50 border border-red-200 rounded text-red-700">
                                <span className="font-medium">Rejection reason:</span> {exception.rejection_reason}
                              </p>
                            )}
                            {exception.remediation_plan && (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-600 mb-1">Remediation Plan</p>
                                <p className="text-blue-900">{exception.remediation_plan}</p>
                                {exception.remediation_due_date && (
                                  <p className="text-xs text-blue-600 mt-2">
                                    Due: {formatDate(exception.remediation_due_date)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 mt-4">
                            {exception.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedException(exception);
                                    setShowDetailModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                                >
                                  Review & Approve
                                </button>
                              </>
                            )}
                            {exception.status === 'approved' && (
                              <button
                                onClick={() => handleMarkRemediated(exception)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                              >
                                Mark as Remediated
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-semibold text-slate-900">Request Risk Exception</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Exception Type</label>
                  <select
                    value={formData.exception_type}
                    onChange={e => setFormData(prev => ({ ...prev, exception_type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Related Vendor (Optional)</label>
                  <select
                    value={formData.vendor_id}
                    onChange={e => setFormData(prev => ({ ...prev, vendor_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    <option value="">No specific vendor</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.legal_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief title for the exception"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of the exception request"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Risk Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.risk_description}
                  onChange={e => setFormData(prev => ({ ...prev, risk_description: e.target.value }))}
                  placeholder="Describe the risk being accepted"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Inherent Risk Level</label>
                  <select
                    value={formData.inherent_risk_level}
                    onChange={e => setFormData(prev => ({ ...prev, inherent_risk_level: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {Object.entries(RISK_LEVEL_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Residual Risk Level</label>
                  <select
                    value={formData.residual_risk_level}
                    onChange={e => setFormData(prev => ({ ...prev, residual_risk_level: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {Object.entries(RISK_LEVEL_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mitigating Controls</label>
                <div className="space-y-2">
                  {formData.mitigating_controls.map((control, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={control}
                        onChange={e => updateMitigatingControl(index, e.target.value)}
                        placeholder="Describe a mitigating control"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      />
                      {formData.mitigating_controls.length > 1 && (
                        <button
                          onClick={() => removeMitigatingControl(index)}
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMitigatingControl}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    + Add another control
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={formData.effective_date}
                    onChange={e => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={e => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Review Frequency (days)</label>
                  <input
                    type="number"
                    value={formData.review_frequency_days}
                    onChange={e => setFormData(prev => ({ ...prev, review_frequency_days: parseInt(e.target.value) || 90 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remediation Plan (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.remediation_plan}
                  onChange={e => setFormData(prev => ({ ...prev, remediation_plan: e.target.value }))}
                  placeholder="Plan to address the underlying risk"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>

              {formData.remediation_plan && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Remediation Due Date</label>
                  <input
                    type="date"
                    value={formData.remediation_due_date}
                    onChange={e => setFormData(prev => ({ ...prev, remediation_due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateException}
                disabled={saving}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedException && (
        <ApprovalModal
          exception={selectedException}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedException(null);
          }}
          onApprove={handleApprove}
          onReject={handleReject}
          saving={saving}
        />
      )}
    </div>
  );
}

function ApprovalModal({
  exception,
  onClose,
  onApprove,
  onReject,
  saving,
}: {
  exception: RiskException;
  onClose: () => void;
  onApprove: (exception: RiskException) => void;
  onReject: (exception: RiskException, reason: string) => void;
  saving: boolean;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Review Exception Request</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <h4 className="font-medium text-slate-900 mb-2">{exception.title}</h4>
            <div className="flex gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_CONFIG[exception.exception_type].color}`}>
                {TYPE_CONFIG[exception.exception_type].label}
              </span>
              {exception.vendor && (
                <span className="text-sm text-slate-600 flex items-center">
                  <Building2 className="w-3 h-3 mr-1" />
                  {exception.vendor.legal_name}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Description</p>
              <p className="text-sm text-slate-600">{exception.description}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Risk Description</p>
              <p className="text-sm text-slate-600">{exception.risk_description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 rounded-lg border ${RISK_LEVEL_CONFIG[exception.inherent_risk_level].color}`}>
                <p className="text-xs mb-1">Inherent Risk</p>
                <p className="font-semibold">{RISK_LEVEL_CONFIG[exception.inherent_risk_level].label}</p>
              </div>
              <div className={`p-3 rounded-lg border ${RISK_LEVEL_CONFIG[exception.residual_risk_level].color}`}>
                <p className="text-xs mb-1">Residual Risk</p>
                <p className="font-semibold">{RISK_LEVEL_CONFIG[exception.residual_risk_level].label}</p>
              </div>
            </div>
            {exception.mitigating_controls && exception.mitigating_controls.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Mitigating Controls</p>
                <ul className="list-disc list-inside text-sm text-slate-600">
                  {exception.mitigating_controls.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {showRejectForm ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain why this exception is being rejected..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onReject(exception, rejectionReason)}
                  disabled={saving || !rejectionReason.trim()}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Approval Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    By approving this exception, you acknowledge acceptance of the described risk with the documented mitigating controls in place.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        {!showRejectForm && (
          <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={() => setShowRejectForm(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(exception)}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Exception
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../lib/logger';
import {
  Building2,
  Plus,
  Search,
  Users,
  Shield,
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  X,
  TrendingUp,
  GitPullRequest,
  Settings,
  Crown,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { TenantOverview } from '../types/platform';
import { InstitutionType, INSTITUTION_TYPE_LABELS } from '../types/organization';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateTenantFormData) => void;
}

interface CreateTenantFormData {
  name: string;
  legal_name: string;
  institution_type: InstitutionType;
  admin_email: string;
  admin_name: string;
}

function CreateTenantModal({ isOpen, onClose, onCreate }: CreateTenantModalProps) {
  const [formData, setFormData] = useState<CreateTenantFormData>({
    name: '',
    legal_name: '',
    institution_type: 'bank',
    admin_email: '',
    admin_name: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
    onClose();
    setFormData({ name: '', legal_name: '', institution_type: 'bank', admin_email: '', admin_name: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Create New Tenant</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Royal Bank of Canada"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Legal Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.legal_name}
              onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full legal entity name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Institution Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.institution_type}
              onChange={(e) => setFormData({ ...formData, institution_type: e.target.value as InstitutionType })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(INSTITUTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Initial Administrator</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Admin Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Admin Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.admin_name}
                  onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Smith"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TenantManagement() {
  const navigate = useNavigate();
  const { isPlatformAdmin, impersonateOrganization } = useOrganization();
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          institution_type,
          created_at,
          is_active
        `)
        .order('name');

      if (orgsError) throw orgsError;

      const tenantsWithStats: TenantOverview[] = await Promise.all(
        (orgs || []).map(async (org) => {
          const [usersResult, vendorsResult, requestsResult] = await Promise.all([
            supabase
              .from('organization_users')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .eq('is_active', true),
            supabase
              .from('vendors')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', org.id),
            supabase
              .from('onboarding_requests')
              .select('id, status', { count: 'exact' })
              .eq('organization_id', org.id)
              .in('status', ['draft', 'submitted', '1b_review', '2nd_review']),
          ]);

          const pendingReviews = (requestsResult.data || []).filter(
            (r) => r.status === '1b_review' || r.status === '2nd_review'
          ).length;

          return {
            id: org.id,
            name: org.name,
            institution_type: org.institution_type,
            user_count: usersResult.count || 0,
            vendor_count: vendorsResult.count || 0,
            created_at: org.created_at,
            is_active: org.is_active,
            active_requests: requestsResult.count || 0,
            pending_reviews: pendingReviews,
          };
        })
      );

      setTenants(tenantsWithStats);
    } catch (err) {
      logger.error('Error fetching tenants:', err);
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchTenants();
    } else {
      setLoading(false);
    }
  }, [isPlatformAdmin, fetchTenants]);

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-600">You do not have platform admin privileges.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Tenants</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchTenants}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || tenant.institution_type === filterType;
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? tenant.is_active : !tenant.is_active);
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCreate = async (data: CreateTenantFormData) => {
    setSaving(true);
    try {
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          legal_name: data.legal_name,
          institution_type: data.institution_type,
          is_active: true,
        })
        .select()
        .single();

      if (createError) throw createError;

      const newTenant: TenantOverview = {
        id: newOrg.id,
        name: newOrg.name,
        institution_type: newOrg.institution_type,
        user_count: 0,
        vendor_count: 0,
        created_at: newOrg.created_at,
        is_active: true,
        active_requests: 0,
        pending_reviews: 0,
      };

      setTenants([newTenant, ...tenants]);
      toast.success('Tenant created successfully');
    } catch (err) {
      logger.error('Error creating tenant:', err);
      toast.error('Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return;

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ is_active: !tenant.is_active })
        .eq('id', tenantId);

      if (updateError) throw updateError;

      setTenants(
        tenants.map((t) =>
          t.id === tenantId ? { ...t, is_active: !t.is_active } : t
        )
      );
      toast.success(`Tenant ${!tenant.is_active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      logger.error('Error updating tenant status:', err);
      toast.error('Failed to update tenant status');
    }
    setActiveMenu(null);
  };

  // Calculate summary stats
  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.is_active).length,
    totalUsers: tenants.reduce((sum, t) => sum + t.user_count, 0),
    totalVendors: tenants.reduce((sum, t) => sum + t.vendor_count, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Building2 className="w-8 h-8 text-blue-600 mr-3" />
            Tenant Management
          </h1>
          <p className="text-slate-600 mt-1">
            Manage financial institution tenants on the platform
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchTenants}
            className="flex items-center px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tenant
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <Building2 className="w-8 h-8 text-blue-600" />
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
          <p className="text-sm text-slate-600">Tenants</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <span className="text-xs text-slate-500">Active</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.active}</p>
          <p className="text-sm text-slate-600">Active Tenants</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <Users className="w-8 h-8 text-teal-600" />
            <span className="text-xs text-slate-500">Users</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalUsers}</p>
          <p className="text-sm text-slate-600">Total Users</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-8 h-8 text-amber-600" />
            <span className="text-xs text-slate-500">Vendors</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalVendors}</p>
          <p className="text-sm text-slate-600">Total Vendors</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {Object.entries(INSTITUTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Users
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Vendors
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Requests
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredTenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-slate-900">{tenant.name}</p>
                      <p className="text-xs text-slate-500">
                        Since {new Date(tenant.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-600 capitalize">
                    {INSTITUTION_TYPE_LABELS[tenant.institution_type as InstitutionType] || tenant.institution_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-slate-600">
                    <Users className="w-4 h-4 mr-1 text-slate-400" />
                    {tenant.user_count}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-600">{tenant.vendor_count}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <GitPullRequest className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-900">{tenant.active_requests || 0}</span>
                    {tenant.pending_reviews && tenant.pending_reviews > 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                        {tenant.pending_reviews} pending
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {tenant.is_active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      <XCircle className="w-3 h-3 mr-1" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === tenant.id ? null : tenant.id)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-500" />
                    </button>

                    {activeMenu === tenant.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                        <button
                          onClick={() => setActiveMenu(null)}
                          className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </button>
                        <button
                          onClick={async () => {
                            setActiveMenu(null);
                            await impersonateOrganization(tenant.id);
                            navigate('/');
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          View as Admin
                        </button>
                        <button
                          onClick={() => setActiveMenu(null)}
                          className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Edit Settings
                        </button>
                        <div className="border-t border-slate-200 my-1" />
                        <button
                          onClick={() => handleToggleStatus(tenant.id)}
                          className={`flex items-center w-full px-4 py-2 text-sm ${
                            tenant.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {tenant.is_active ? (
                            <>
                              <XCircle className="w-4 h-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Activate
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredTenants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No tenants found matching your criteria</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Tenant Modal */}
      <CreateTenantModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

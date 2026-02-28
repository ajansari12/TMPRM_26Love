import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Globe,
  Shield,
  TrendingUp,
  AlertTriangle,
  Search,
  Plus,
  ChevronRight,
  Activity,
  Eye,
  BarChart3,
  Network,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { logger } from '../lib/logger';
import {
  TenantOverview,
  ThirdPartyConcentration,
  PlatformAuditEntry,
} from '../types/platform';
import { supabase } from '../lib/supabase';

export default function PlatformAdminDashboard() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useOrganization();

  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'concentration' | 'audit'>('overview');
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [concentration, setConcentration] = useState<ThirdPartyConcentration[]>([]);
  const [auditLog, setAuditLog] = useState<PlatformAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTenants = useCallback(async () => {
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
          const [usersResult, vendorsResult, requestsResult, contractsResult] = await Promise.all([
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
            supabase
              .from('contracts')
              .select('contract_value')
              .eq('status', 'active')
              .in('vendor_id', supabase.from('vendors').select('id').eq('organization_id', org.id)),
          ]);

          const pendingReviews = (requestsResult.data || []).filter(
            (r) => r.status === '1b_review' || r.status === '2nd_review'
          ).length;

          const totalContractValue = (contractsResult.data || []).reduce(
            (sum, c) => sum + (c.contract_value || 0),
            0
          );

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
            total_contract_value: totalContractValue,
          };
        })
      );

      setTenants(tenantsWithStats);
    } catch (err) {
      logger.error('Error fetching tenants:', err);
      throw err;
    }
  }, []);

  const fetchConcentration = useCallback(async () => {
    try {
      const { data: globalParties, error: gpError } = await supabase
        .from('global_third_parties')
        .select(`
          id,
          legal_name,
          headquarters_country,
          vendor_global_links (
            organization_id,
            organizations:organization_id (
              institution_type
            )
          )
        `);

      if (gpError) throw gpError;

      const concentrationData: ThirdPartyConcentration[] = (globalParties || [])
        .map((gp) => {
          const links = gp.vendor_global_links || [];
          const uniqueOrgs = new Set(links.map((l: { organization_id: string }) => l.organization_id));
          const institutionTypes = [
            ...new Set(
              links
                .map((l: { organizations: { institution_type: string } | null }) => l.organizations?.institution_type)
                .filter(Boolean)
            ),
          ] as string[];

          return {
            global_third_party_id: gp.id,
            legal_name: gp.legal_name,
            headquarters_country: gp.headquarters_country,
            fi_count: uniqueOrgs.size,
            total_relationships: links.length,
            institution_types: institutionTypes,
          };
        })
        .filter((c) => c.fi_count > 0)
        .sort((a, b) => b.fi_count - a.fi_count);

      setConcentration(concentrationData);
    } catch (err) {
      logger.error('Error fetching concentration:', err);
      throw err;
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    try {
      const { data, error: auditError } = await supabase
        .from('platform_audit_log')
        .select(`
          id,
          admin_id,
          action,
          resource_type,
          resource_id,
          organization_id,
          details,
          ip_address,
          user_agent,
          created_at,
          platform_admins:admin_id (
            profiles:user_id (
              full_name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (auditError) throw auditError;

      const auditEntries: PlatformAuditEntry[] = (data || []).map((entry) => ({
        id: entry.id,
        admin_id: entry.admin_id,
        action: entry.action,
        resource_type: entry.resource_type as PlatformAuditEntry['resource_type'],
        resource_id: entry.resource_id,
        organization_id: entry.organization_id,
        details: entry.details,
        ip_address: entry.ip_address,
        created_at: entry.created_at,
        admin_name:
          (entry.platform_admins as { profiles: { full_name: string } | null } | null)?.profiles
            ?.full_name || 'System',
      }));

      setAuditLog(auditEntries);
    } catch (err) {
      logger.error('Error fetching audit log:', err);
      throw err;
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([fetchTenants(), fetchConcentration(), fetchAuditLog()]);
    } catch (err) {
      logger.error('Error fetching platform data:', err);
      setError('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  }, [fetchTenants, fetchConcentration, fetchAuditLog]);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchAllData();
    } else {
      setLoading(false);
    }
  }, [isPlatformAdmin, fetchAllData]);

  if (!isPlatformAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have permission to access the Platform Admin Dashboard.
          </p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const totalUsers = tenants.reduce((sum, t) => sum + t.user_count, 0);
  const totalVendors = tenants.reduce((sum, t) => sum + t.vendor_count, 0);
  const totalContractValue = tenants.reduce((sum, t) => sum + (t.total_contract_value || 0), 0);
  const activeTenants = tenants.filter(t => t.is_active).length;

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.institution_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConcentration = concentration.filter(c =>
    c.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.headquarters_country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Platform Data</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchAllData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-blue-600" />
              Platform Administration
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage all tenants, monitor third-party concentration, and configure platform settings.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchAllData}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </button>
            <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Tenant
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Tenants</p>
              <p className="text-3xl font-bold text-gray-900">{activeTenants}</p>
              <p className="text-xs text-gray-500 mt-1">of {tenants.length} total</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
              <p className="text-xs text-gray-500 mt-1">across all tenants</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Vendors</p>
              <p className="text-3xl font-bold text-gray-900">{totalVendors}</p>
              <p className="text-xs text-gray-500 mt-1">{concentration.length} unique global</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Globe className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Contract Value</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalContractValue)}</p>
              <p className="text-xs text-gray-500 mt-1">active contracts</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'tenants', label: 'Tenants', icon: Building2 },
              { id: 'concentration', label: 'Third Party Concentration', icon: Network },
              { id: 'audit', label: 'Audit Log', icon: Activity },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center px-6 py-4 text-sm font-medium border-b-2
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Search */}
          {activeTab !== 'overview' && activeTab !== 'audit' && (
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={activeTab === 'tenants' ? 'Search tenants...' : 'Search third parties...'}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tenant Distribution */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">Tenant Distribution by Type</h3>
                <div className="space-y-3">
                  {['bank', 'credit_union', 'insurance', 'trust'].map((type) => {
                    const count = tenants.filter(t => t.institution_type === type).length;
                    const percentage = (count / tenants.length) * 100;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                          <span className="text-gray-500">{count} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Concentrated Third Parties */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                  Concentration Risk - Top Third Parties
                </h3>
                <div className="space-y-3">
                  {concentration.slice(0, 5).map((tp, index) => (
                    <div key={tp.global_third_party_id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`
                          w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3
                          ${index === 0 ? 'bg-red-100 text-red-700' :
                            index === 1 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'}
                        `}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tp.legal_name}</p>
                          <p className="text-xs text-gray-500">{tp.headquarters_country}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{tp.fi_count} FIs</p>
                        <p className="text-xs text-gray-500">{tp.total_relationships} relationships</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="border border-gray-200 rounded-lg p-4 lg:col-span-2">
                <h3 className="font-medium text-gray-900 mb-4">Recent Platform Activity</h3>
                <div className="space-y-3">
                  {auditLog.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center">
                        <div className="p-2 bg-gray-100 rounded-lg mr-3">
                          <Activity className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{entry.admin_name}</span>
                            {' '}{entry.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {entry.details?.tenant_name || entry.details?.template_name || entry.details?.vendor_name}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tenants Tab */}
          {activeTab === 'tenants' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendors
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Requests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contract Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg mr-3">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-500">Since {formatDate(tenant.created_at)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded capitalize">
                          {tenant.institution_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tenant.user_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tenant.vendor_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{tenant.active_requests}</span>
                        {tenant.pending_reviews && tenant.pending_reviews > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                            {tenant.pending_reviews} pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(tenant.total_contract_value || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tenant.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => navigate('/tenant-management')}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="View in Tenant Management"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Concentration Tab */}
          {activeTab === 'concentration' && (
            <div>
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">Concentration Risk Monitoring</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This view shows third parties that are used by multiple financial institutions 
                      on the platform. High concentration may indicate systemic risk exposure across 
                      the financial sector.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Third Party
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Headquarters
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        FI Count
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Relationships
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Institution Types
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Level
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredConcentration.map((tp) => {
                      const riskLevel = tp.fi_count >= 4 ? 'high' : tp.fi_count >= 2 ? 'medium' : 'low';
                      return (
                        <tr key={tp.global_third_party_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                                <Globe className="w-5 h-5 text-blue-600" />
                              </div>
                              <p className="text-sm font-medium text-gray-900">{tp.legal_name}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {tp.headquarters_country}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`
                              px-2 py-1 rounded text-sm font-medium
                              ${tp.fi_count >= 4 ? 'bg-red-100 text-red-700' :
                                tp.fi_count >= 2 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'}
                            `}>
                              {tp.fi_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {tp.total_relationships}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {tp.institution_types.map((type) => (
                                <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                                  {type.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`
                              inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                              ${riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                                riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'}
                            `}>
                              {riskLevel === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {riskLevel.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => navigate('/global-third-parties')}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Details
                              <ChevronRight className="w-4 h-4 inline ml-1" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                    <Filter className="w-4 h-4 mr-1" />
                    Filter
                  </button>
                  <button
                    onClick={fetchAuditLog}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </button>
                </div>
                <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </button>
              </div>

              <div className="space-y-3">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-start p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="p-2 bg-gray-100 rounded-lg mr-4">
                      <Activity className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <span className="text-xs text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Performed by <span className="font-medium">{entry.admin_name}</span>
                      </p>
                      {entry.details && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 font-mono">
                          {JSON.stringify(entry.details)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

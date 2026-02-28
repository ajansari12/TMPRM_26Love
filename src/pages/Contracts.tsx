import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';
import ErrorState from '../components/ErrorState';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  XCircle,
  Download
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { exportToCSV, formatCurrency } from '../lib/exportUtils';
import { logger } from '../lib/logger';

interface Contract {
  id: string;
  vendor_id: string;
  contract_number: string | null;
  title: string;
  contract_type: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  annual_value_cad: number | null;
  status: string;
  contract_owner: string | null;
  legal_review_status: string | null;
  created_at: string;
  vendors: {
    legal_name: string;
    tier: string;
  };
}

export default function Contracts() {
  const { currentOrganization } = useOrganization();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [expiryAlerts, setExpiryAlerts] = useState<Array<{ contract: Contract; daysUntil: number; alertLevel: string }>>([]);
  const expiryCheckDone = useRef(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (currentOrganization) {
      fetchContracts();
    }
  }, [currentOrganization]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  async function fetchContracts() {
    if (!currentOrganization) return;
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('contracts')
        .select(`
          *,
          vendors (
            legal_name,
            tier
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setContracts(data || []);
    } catch (err) {
      logger.error('Error fetching contracts:', err);
      setError('Failed to load contracts. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function checkContractExpiry() {
    if (!currentOrganization || contracts.length === 0) return;

    const now = new Date();
    const alerts: Array<{ contract: Contract; daysUntil: number; alertLevel: string }> = [];

    for (const contract of contracts) {
      if (contract.status !== 'active' || !contract.expiry_date) continue;
      const expiryDate = new Date(contract.expiry_date);
      const daysUntil = differenceInDays(expiryDate, now);

      if (daysUntil <= 0) {
        alerts.push({ contract, daysUntil, alertLevel: 'expired' });
      } else if (daysUntil <= 30) {
        alerts.push({ contract, daysUntil, alertLevel: 'critical' });
      } else if (daysUntil <= 60) {
        alerts.push({ contract, daysUntil, alertLevel: 'warning' });
      } else if (daysUntil <= 90) {
        alerts.push({ contract, daysUntil, alertLevel: 'info' });
      }
    }

    setExpiryAlerts(alerts);

    for (const alert of alerts.filter(a => a.alertLevel === 'critical' || a.alertLevel === 'expired')) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('organization_id', currentOrganization.id)
        .eq('type', 'contract_expiry_warning')
        .eq('related_entity_id', alert.contract.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (!existing) {
        const vendorName = alert.contract.vendors?.legal_name || 'Unknown';
        await supabase.from('notifications').insert({
          organization_id: currentOrganization.id,
          type: 'contract_expiry_warning',
          title: alert.alertLevel === 'expired'
            ? `Contract EXPIRED: ${vendorName}`
            : `Contract expiring in ${alert.daysUntil} days: ${vendorName}`,
          message: `Contract ${alert.contract.contract_number || '#'} with ${vendorName} ${alert.alertLevel === 'expired' ? 'has expired' : `expires on ${format(new Date(alert.contract.expiry_date), 'MMM d, yyyy')}`}. Review and take action.`,
          action_url: `/contracts/${alert.contract.id}`,
          priority: alert.alertLevel === 'expired' ? 'critical' : 'high',
          related_entity_type: 'contract',
          related_entity_id: alert.contract.id,
          target_role: '1b',
        });
      }
    }
  }

  useEffect(() => {
    if (contracts.length > 0 && currentOrganization && !expiryCheckDone.current) {
      expiryCheckDone.current = true;
      checkContractExpiry();
    }
  }, [contracts, currentOrganization]);

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch =
      contract.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      contract.vendors.legal_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (contract.contract_number || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / pageSize));
  const paginatedContracts = filteredContracts.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleExport = () => {
    if (filteredContracts.length === 0) {
      toast.error('No data to export. Try adjusting your filters.');
      return;
    }

    const exportData = filteredContracts.map(contract => ({
      vendor_name: contract.vendors?.legal_name || 'N/A',
      contract_number: contract.contract_number || 'N/A',
      title: contract.title || 'N/A',
      contract_type: contract.contract_type || 'N/A',
      status: contract.status || 'N/A',
      annual_value_cad: contract.annual_value_cad ? formatCurrency(contract.annual_value_cad) : 'N/A',
      effective_date: contract.effective_date ? format(new Date(contract.effective_date), 'MMM dd, yyyy') : 'N/A',
      expiry_date: contract.expiry_date ? format(new Date(contract.expiry_date), 'MMM dd, yyyy') : 'N/A',
      contract_owner: contract.contract_owner || 'N/A',
      legal_review_status: contract.legal_review_status || 'N/A',
    }));

    const result = exportToCSV(
      exportData,
      'contracts',
      [
        { key: 'vendor_name', label: 'Vendor Name' },
        { key: 'contract_number', label: 'Contract Number' },
        { key: 'title', label: 'Title' },
        { key: 'contract_type', label: 'Contract Type' },
        { key: 'status', label: 'Status' },
        { key: 'annual_value_cad', label: 'Annual Value (CAD)' },
        { key: 'effective_date', label: 'Effective Date' },
        { key: 'expiry_date', label: 'Expiry Date' },
        { key: 'contract_owner', label: 'Contract Owner' },
        { key: 'legal_review_status', label: 'Legal Review Status' },
      ]
    );

    if (result.success) {
      toast.success(`Exported ${filteredContracts.length} contracts to CSV`);
    } else {
      toast.error(result.error || 'Failed to export data');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      expiring_soon: 'bg-orange-100 text-orange-800',
      expired: 'bg-red-100 text-red-800',
      terminated: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date());
    if (daysUntilExpiry < 0) return { text: 'Expired', color: 'text-red-600' };
    if (daysUntilExpiry <= 90) return { text: `${daysUntilExpiry} days`, color: 'text-orange-600' };
    return { text: `${daysUntilExpiry} days`, color: 'text-gray-600' };
  };

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    expiringSoon: contracts.filter(c => {
      if (!c.expiry_date) return false;
      const days = differenceInDays(new Date(c.expiry_date), new Date());
      return days >= 0 && days <= 90;
    }).length,
    totalValue: contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.annual_value_cad || 0), 0),
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view contracts</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contract Register</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage vendor contracts and OSFI B-10 Annex 2 compliance
            </p>
          </div>
        </div>
        <CardSkeleton count={4} />
        <div className="bg-white rounded-lg shadow p-6">
          <TableSkeleton rows={5} cols={7} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          fetchContracts();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contract Register</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage vendor contracts and OSFI B-10 Annex 2 compliance
          </p>
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
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Contract
          </button>
        </div>
      </div>

      {expiryAlerts.filter(a => a.alertLevel === 'expired').length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-800 font-semibold text-lg mb-2">Expired Contracts</h3>
              <div className="space-y-2">
                {expiryAlerts.filter(a => a.alertLevel === 'expired').map(alert => (
                  <Link
                    key={alert.contract.id}
                    to={`/contracts/${alert.contract.id}`}
                    className="block bg-white p-3 rounded border border-red-200 hover:border-red-400 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{alert.contract.vendors.legal_name}</p>
                        <p className="text-sm text-gray-600">{alert.contract.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Contract {alert.contract.contract_number || '#'} • Expired {format(new Date(alert.contract.expiry_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <span className="text-red-700 font-semibold text-sm whitespace-nowrap">EXPIRED</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {expiryAlerts.filter(a => a.alertLevel === 'critical').length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-orange-800 font-semibold text-lg mb-2">Expiring Within 30 Days</h3>
              <div className="space-y-2">
                {expiryAlerts.filter(a => a.alertLevel === 'critical').map(alert => (
                  <Link
                    key={alert.contract.id}
                    to={`/contracts/${alert.contract.id}`}
                    className="block bg-white p-3 rounded border border-orange-200 hover:border-orange-400 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{alert.contract.vendors.legal_name}</p>
                        <p className="text-sm text-gray-600">{alert.contract.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Contract {alert.contract.contract_number || '#'} • Expires {format(new Date(alert.contract.expiry_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <span className="text-orange-700 font-semibold text-sm whitespace-nowrap">{alert.daysUntil} days</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {expiryAlerts.filter(a => a.alertLevel === 'warning').length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-yellow-800 font-semibold text-lg mb-2">Expiring Within 60 Days</h3>
              <div className="space-y-2">
                {expiryAlerts.filter(a => a.alertLevel === 'warning').map(alert => (
                  <Link
                    key={alert.contract.id}
                    to={`/contracts/${alert.contract.id}`}
                    className="block bg-white p-3 rounded border border-yellow-200 hover:border-yellow-400 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{alert.contract.vendors.legal_name}</p>
                        <p className="text-sm text-gray-600">{alert.contract.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Contract {alert.contract.contract_number || '#'} • Expires {format(new Date(alert.contract.expiry_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <span className="text-yellow-700 font-semibold text-sm whitespace-nowrap">{alert.daysUntil} days</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Contracts</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-semibold text-green-600 mt-1">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-semibold text-orange-600 mt-1">{stats.expiringSoon}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value (CAD)</p>
              <p className="text-2xl font-semibold text-blue-600 mt-1">
                ${(stats.totalValue / 1000000).toFixed(1)}M
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="under_review">Under Review</option>
                <option value="active">Active</option>
                <option value="expiring_soon">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {contracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No contracts yet"
            description="Get started by creating your first contract."
            action={
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Contract
              </button>
            }
          />
        ) : filteredContracts.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No contracts found"
            description="Try adjusting your search or filter criteria."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Contracts list">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contract
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value (CAD)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expiry
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedContracts.map((contract) => {
                    const expiryStatus = getExpiryStatus(contract.expiry_date);
                    return (
                      <tr key={contract.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{contract.title}</div>
                            {contract.contract_number && (
                              <div className="text-xs text-gray-500">{contract.contract_number}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900">{contract.vendors.legal_name}</div>
                              <div className="text-xs text-gray-500">{contract.vendors.tier?.replace('tier_', 'Tier ').replace('_', ' - ') || 'Not Assessed'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contract.contract_type || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(contract.status)}`}>
                            {contract.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contract.annual_value_cad
                            ? `$${contract.annual_value_cad.toLocaleString()}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {contract.expiry_date ? (
                            <div>
                              <div className="text-sm text-gray-900 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(contract.expiry_date), 'MMM d, yyyy')}
                              </div>
                              {expiryStatus && (
                                <div className={`text-xs ${expiryStatus.color}`}>
                                  {expiryStatus.text}
                                </div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            to={`/contracts/${contract.id}`}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredContracts.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {showNewModal && (
        <NewContractModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            setShowNewModal(false);
            fetchContracts();
          }}
        />
      )}
    </div>
  );
}

function NewContractModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { currentOrganization } = useOrganization();
  const [vendors, setVendors] = useState<Array<{ id: string; legal_name: string }>>([]);
  const [formData, setFormData] = useState({
    vendor_id: '',
    title: '',
    contract_type: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      fetchVendors();
    }
  }, [currentOrganization]);

  async function fetchVendors() {
    if (!currentOrganization) return;
    const { data } = await supabase
      .from('vendors')
      .select('id, legal_name')
      .eq('organization_id', currentOrganization.id)
      .order('legal_name');
    setVendors(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.vendor_id || !formData.title || !currentOrganization) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .insert({
          vendor_id: formData.vendor_id,
          title: formData.title,
          contract_type: formData.contract_type || null,
          status: 'draft',
          organization_id: currentOrganization.id,
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      logger.error('Error creating contract:', error);
      toast.error('Failed to create contract');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">New Contract</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor *
            </label>
            <select
              value={formData.vendor_id}
              onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select a vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.legal_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Type
            </label>
            <select
              value={formData.contract_type}
              onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select type</option>
              <option value="MSA">Master Service Agreement</option>
              <option value="SOW">Statement of Work</option>
              <option value="SaaS">SaaS Agreement</option>
              <option value="License">License Agreement</option>
              <option value="Professional Services">Professional Services</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

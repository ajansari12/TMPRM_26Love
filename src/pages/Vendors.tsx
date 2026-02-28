import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { Vendor } from '../types';
import {
  formatDate,
  getTierColor,
  getTierNumber,
  getStatusColor,
} from '../lib/utils';
import { Plus, Download, Search, Filter, X, Building2, Upload, GitCompare, Users, ShieldAlert, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import {
  SERVICE_CATEGORIES,
  BUSINESS_UNITS,
  VENDOR_STATUSES,
} from '../lib/constants';
import { tierConfig } from '../lib/riskCalculations';
import VendorImportModal from '../components/VendorImportModal';
import { toast } from 'sonner';
import { exportToCSV, formatCurrency } from '../lib/exportUtils';
import { useDebounce } from '../hooks/useDebounce';
import { useDefenseLineAccess } from '../hooks/useDefenseLineAccess';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';
import SavedViewsDropdown from '../components/SavedViewsDropdown';
import BulkActionBar from '../components/BulkActionBar';
import { useSavedViews } from '../hooks/useSavedViews';
import { useBulkSelection } from '../hooks/useBulkSelection';

export default function Vendors() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const access = useDefenseLineAccess();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [showFilters, setShowFilters] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [fourthPartyCounts, setFourthPartyCounts] = useState<Record<string, number>>({});
  const [exceptionCounts, setExceptionCounts] = useState<Record<string, number>>({});
  const [reassessmentsDue, setReassessmentsDue] = useState<string[]>([]);
  const [showReassessmentDueOnly, setShowReassessmentDueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const savedViews = useSavedViews({ pageKey: 'vendors' });

  const handleSaveView = (name: string) => {
    const filters: Record<string, string> = {};
    if (statusFilter.length > 0) filters.status = statusFilter.join(',');
    if (tierFilter.length > 0) filters.tier = tierFilter.join(',');
    if (categoryFilter.length > 0) filters.category = categoryFilter.join(',');
    if (businessUnitFilter.length > 0) filters.businessUnit = businessUnitFilter.join(',');
    if (searchTerm) filters.search = searchTerm;
    if (showReassessmentDueOnly) filters.reassessmentDue = 'true';
    savedViews.saveView(name, filters);
  };

  const handleApplyView = (viewId: string) => {
    const view = savedViews.applyView(viewId);
    if (!view) return;
    setStatusFilter(view.filters.status ? view.filters.status.split(',') : []);
    setTierFilter(view.filters.tier ? view.filters.tier.split(',') : []);
    setCategoryFilter(view.filters.category ? view.filters.category.split(',') : []);
    setBusinessUnitFilter(view.filters.businessUnit ? view.filters.businessUnit.split(',') : []);
    setSearchTerm(view.filters.search || '');
    setShowReassessmentDueOnly(view.filters.reassessmentDue === 'true');
    setPage(1);
  };

  const handleClearView = () => {
    savedViews.clearActiveView();
  };

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchVendors();
    } else {
      setVendors([]);
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (vendors.length > 0 && currentOrganization?.id) {
      fetchFourthPartyCounts();
      fetchExceptionCounts();
      calculateReassessmentsDue();
    }
  }, [vendors, currentOrganization?.id]);

  const calculateReassessmentsDue = () => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const dueVendorIds = vendors
      .filter((v) => {
        if (v.status !== 'active' || !v.next_review_date) return false;
        const reviewDate = new Date(v.next_review_date);
        return reviewDate <= thirtyDaysFromNow;
      })
      .map((v) => v.id);

    setReassessmentsDue(dueVendorIds);
  };

  useEffect(() => {
    applyFilters();
    setPage(1);
  }, [vendors, debouncedSearch, statusFilter, tierFilter, categoryFilter, businessUnitFilter, showReassessmentDueOnly, reassessmentsDue]);

  const fetchVendors = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setVendors(data || []);
    } catch (err) {
      logger.error('Error fetching vendors:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const fetchFourthPartyCounts = async () => {
    if (!currentOrganization?.id) return;

    try {
      const vendorIds = vendors.filter((v) => v.uses_subcontractors).map((v) => v.id);
      if (vendorIds.length === 0) return;

      const { data, error } = await supabase
        .from('fourth_parties')
        .select('vendor_id')
        .eq('organization_id', currentOrganization.id)
        .in('vendor_id', vendorIds);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        counts[row.vendor_id] = (counts[row.vendor_id] || 0) + 1;
      });
      setFourthPartyCounts(counts);
    } catch (error) {
      logger.error('Error fetching fourth party counts:', error);
    }
  };

  const fetchExceptionCounts = async () => {
    if (!currentOrganization?.id) return;

    try {
      const vendorIds = vendors.map((v) => v.id);
      if (vendorIds.length === 0) return;

      const { data, error } = await supabase
        .from('risk_exceptions')
        .select('vendor_id')
        .eq('organization_id', currentOrganization.id)
        .in('vendor_id', vendorIds)
        .in('status', ['approved', 'pending']);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        if (row.vendor_id) {
          counts[row.vendor_id] = (counts[row.vendor_id] || 0) + 1;
        }
      });
      setExceptionCounts(counts);
    } catch (error) {
      logger.error('Error fetching exception counts:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...vendors];

    if (showReassessmentDueOnly) {
      filtered = filtered.filter((v) => reassessmentsDue.includes(v.id));
    }

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.legal_name?.toLowerCase().includes(term) ||
          v.vendor_id?.toLowerCase().includes(term) ||
          v.responsible_officer?.toLowerCase().includes(term)
      );
    }

    if (statusFilter.length > 0) {
      filtered = filtered.filter((v) => statusFilter.includes(v.status));
    }

    if (tierFilter.length > 0) {
      filtered = filtered.filter((v) => v.tier && tierFilter.includes(v.tier));
    }

    if (categoryFilter.length > 0) {
      filtered = filtered.filter((v) => categoryFilter.includes(v.service_category));
    }

    if (businessUnitFilter.length > 0) {
      filtered = filtered.filter((v) => v.business_unit && businessUnitFilter.includes(v.business_unit));
    }

    setFilteredVendors(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setTierFilter([]);
    setCategoryFilter([]);
    setBusinessUnitFilter([]);
    setShowReassessmentDueOnly(false);
  };

  const toggleArrayFilter = (array: string[], setArray: (arr: string[]) => void, value: string) => {
    if (array.includes(value)) {
      setArray(array.filter((v) => v !== value));
    } else {
      setArray([...array, value]);
    }
  };

  const toggleCompareSelection = (vendorId: string) => {
    const newSelected = new Set(selectedForCompare);
    if (newSelected.has(vendorId)) {
      newSelected.delete(vendorId);
    } else if (newSelected.size < 4) {
      newSelected.add(vendorId);
    } else {
      toast.error('Maximum 4 vendors can be compared at once');
      return;
    }
    setSelectedForCompare(newSelected);
  };

  const handleCompare = () => {
    if (selectedForCompare.size >= 2) {
      navigate(`/vendors/compare?ids=${Array.from(selectedForCompare).join(',')}`);
    }
  };

  const clearCompareSelection = () => {
    setSelectedForCompare(new Set());
  };

  const handleExport = () => {
    if (filteredVendors.length === 0) {
      toast.error('No data to export. Try adjusting your filters.');
      return;
    }

    const exportData = filteredVendors.map(vendor => ({
      legal_name: vendor.legal_name || 'N/A',
      tier: vendor.tier || 'N/A',
      status: vendor.status || 'N/A',
      service_category: vendor.service_category || 'N/A',
      business_unit: vendor.business_unit || 'N/A',
      contract_value_cad: vendor.contract_value_cad ? formatCurrency(vendor.contract_value_cad) : 'N/A',
      country: vendor.country || 'N/A',
      next_review_date: formatDate(vendor.next_review_date),
      responsible_officer: vendor.responsible_officer || 'N/A',
      is_critical: vendor.is_critical ? 'Yes' : 'No',
    }));

    const result = exportToCSV(
      exportData,
      'vendors',
      [
        { key: 'legal_name', label: 'Vendor Name' },
        { key: 'tier', label: 'Tier' },
        { key: 'status', label: 'Status' },
        { key: 'service_category', label: 'Service Category' },
        { key: 'business_unit', label: 'Business Unit' },
        { key: 'contract_value_cad', label: 'Contract Value (CAD)' },
        { key: 'country', label: 'Country' },
        { key: 'next_review_date', label: 'Next Review Date' },
        { key: 'responsible_officer', label: 'Responsible Officer' },
        { key: 'is_critical', label: 'Critical' },
      ]
    );

    if (result.success) {
      toast.success(`Exported ${filteredVendors.length} vendors to CSV`);
    } else {
      toast.error(result.error || 'Failed to export data');
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / pageSize));
  const paginatedVendors = filteredVendors.slice((page - 1) * pageSize, page * pageSize);

  const bulk = useBulkSelection(paginatedVendors);

  const handleBulkExport = () => {
    const items = bulk.selectedItems;
    if (items.length === 0) return;
    exportToCSV(items, `vendors-export-${Date.now()}`);
    toast.success(`Exported ${items.length} vendor(s)`);
    bulk.clearSelection();
  };

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          No Organization Selected
        </h2>
        <p className="text-slate-600">
          Please select or register an organization to view your vendors
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Third-Party Inventory</h1>
            <p className="text-slate-600 mt-1">
              {currentOrganization.name} - All third-party arrangements
            </p>
          </div>
        </div>
        <div className="mb-6">
          <CardSkeleton count={5} />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <TableSkeleton rows={10} cols={9} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Third-Party Inventory</h1>
            <p className="text-slate-600 mt-1">
              {currentOrganization.name} - All third-party arrangements
            </p>
          </div>
        </div>
        <ErrorState message={error} onRetry={fetchVendors} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {access.is1A ? 'My Vendors' : 'Third-Party Inventory'}
          </h1>
          <p className="text-slate-600 mt-1">
            {currentOrganization.name} - {access.is1A ? 'Vendors you own or requested' : 'All third-party arrangements'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {!access.isReadOnly && (
            <>
              <button
                onClick={handleExport}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              {!access.is1A && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import CSV</span>
                </button>
              )}
              <Link
                to="/onboarding/new"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Start Onboarding Request</span>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Vendor Creation Governance
            </h3>
            <p className="text-sm text-blue-800">
              All vendors must be added through the{' '}
              <Link to="/onboarding/new" className="underline font-medium hover:text-blue-900">
                Onboarding Request workflow
              </Link>
              . This ensures proper risk assessment, approval, and compliance with regulatory requirements. Direct vendor creation is restricted to maintain data integrity and governance standards.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Total Vendors</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{vendors.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Active</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">
            {vendors.filter((v) => v.status === 'active').length}
          </p>
        </div>
        <button
          onClick={() => setShowReassessmentDueOnly(!showReassessmentDueOnly)}
          className={`bg-white rounded-lg shadow p-4 text-left transition-all ${showReassessmentDueOnly ? 'ring-2 ring-amber-500' : 'hover:bg-slate-50'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Reassessments Due</p>
            {showReassessmentDueOnly && <RefreshCw className="w-4 h-4 text-amber-600" />}
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-1">
            {reassessmentsDue.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Click to filter</p>
        </button>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Critical & High Risk</p>
          <p className="text-3xl font-bold text-red-600 mt-1">
            {vendors.filter((v) => v.tier && (v.tier.includes('5') || v.tier.includes('4'))).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Under Review</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">
            {vendors.filter((v) => v.status === 'under_review').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, vendor ID, or responsible officer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {(statusFilter.length + tierFilter.length + categoryFilter.length + businessUnitFilter.length > 0) && (
              <span className="bg-slate-900 text-white text-xs px-2 py-0.5 rounded-full">
                {statusFilter.length + tierFilter.length + categoryFilter.length + businessUnitFilter.length}
              </span>
            )}
          </button>
          {(searchTerm || statusFilter.length + tierFilter.length + categoryFilter.length + businessUnitFilter.length > 0) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
          <SavedViewsDropdown
            views={savedViews.views}
            activeViewId={savedViews.activeViewId}
            onApply={handleApplyView}
            onSave={handleSaveView}
            onDelete={savedViews.deleteView}
            onClear={handleClearView}
          />
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <div className="space-y-1">
                {VENDOR_STATUSES.map((status) => (
                  <label key={status.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(status.value)}
                      onChange={() => toggleArrayFilter(statusFilter, setStatusFilter, status.value)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">{status.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tier</label>
              <div className="space-y-1">
                {Object.entries(tierConfig).map(([value, config]) => (
                  <label key={value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={tierFilter.includes(value)}
                      onChange={() => toggleArrayFilter(tierFilter, setTierFilter, value)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">{config.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Service Category</label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {SERVICE_CATEGORIES.map((cat) => (
                  <label key={cat.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={categoryFilter.includes(cat.value)}
                      onChange={() => toggleArrayFilter(categoryFilter, setCategoryFilter, cat.value)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Business Unit</label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {BUSINESS_UNITS.map((unit) => (
                  <label key={unit.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={businessUnitFilter.includes(unit.value)}
                      onChange={() => toggleArrayFilter(businessUnitFilter, setBusinessUnitFilter, unit.value)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">{unit.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {filteredVendors.length === 0 ? (
        vendors.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Add your first third-party arrangement"
            description="Get started by onboarding your first vendor through the guided workflow."
            action={
              <Link
                to="/onboarding/new"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start Onboarding Request
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No vendors found"
            description="Try adjusting your filters"
            action={
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </button>
            }
          />
        )
      ) : (
        <>
        <BulkActionBar selectedCount={bulk.selectedCount} onClear={bulk.clearSelection}>
          <button
            onClick={handleBulkExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Selected
          </button>
        </BulkActionBar>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Vendors list">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-3 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={bulk.isAllSelected}
                      onChange={bulk.toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      aria-label="Select all vendors"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider w-12">
                    <span className="sr-only">Compare</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Vendor ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Legal Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Service Category
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Tier
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Risk Rating
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Next Review
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedVendors.map((vendor) => (
                  <tr key={vendor.id} className={`hover:bg-slate-50 ${bulk.isSelected(vendor.id) ? 'bg-slate-50' : ''}`}>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={bulk.isSelected(vendor.id)}
                        onChange={() => bulk.toggleItem(vendor.id)}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        aria-label={`Select ${vendor.legal_name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedForCompare.has(vendor.id)}
                        onChange={() => toggleCompareSelection(vendor.id)}
                        disabled={!selectedForCompare.has(vendor.id) && selectedForCompare.size >= 4}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                        title={selectedForCompare.size >= 4 && !selectedForCompare.has(vendor.id) ? 'Maximum 4 vendors can be compared' : 'Select for comparison'}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      <Link to={`/vendors/${vendor.id}`} className="hover:text-slate-600">
                        {vendor.vendor_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      <div className="flex items-center space-x-2">
                        <Link to={`/vendors/${vendor.id}`} className="hover:text-slate-600">
                          {vendor.legal_name}
                        </Link>
                        {reassessmentsDue.includes(vendor.id) && (() => {
                          const reviewDate = new Date(vendor.next_review_date!);
                          const now = new Date();
                          const isOverdue = reviewDate < now;
                          const daysUntil = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <Link
                              to={`/vendors/${vendor.id}/assess?type=periodic_review`}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs transition-colors ${
                                isOverdue
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : daysUntil <= 7
                                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              }`}
                              title={isOverdue ? `Reassessment ${Math.abs(daysUntil)} days overdue` : `Reassessment due in ${daysUntil} days`}
                            >
                              <Clock className="w-3 h-3 mr-0.5" />
                              {isOverdue ? 'Overdue' : 'Due Soon'}
                            </Link>
                          );
                        })()}
                        {vendor.status === 'pending_assessment' && (
                          <Link
                            to={`/vendors/${vendor.id}/assess`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            title="Initial assessment required (bulk import)"
                          >
                            <AlertCircle className="w-3 h-3 mr-0.5" />
                            Needs Assessment
                          </Link>
                        )}
                        {vendor.uses_subcontractors && (
                          <Link
                            to={`/vendors/${vendor.id}/fourth-parties`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            title={`${fourthPartyCounts[vendor.id] || 0} fourth parties`}
                          >
                            <Users className="w-3 h-3 mr-0.5" />
                            {fourthPartyCounts[vendor.id] || 0}
                          </Link>
                        )}
                        {(exceptionCounts[vendor.id] || 0) > 0 && (
                          <Link
                            to={`/risk-exceptions?vendor=${vendor.id}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                            title={`${exceptionCounts[vendor.id]} active risk exception(s)`}
                          >
                            <ShieldAlert className="w-3 h-3 mr-0.5" />
                            {exceptionCounts[vendor.id]}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {SERVICE_CATEGORIES.find((c) => c.value === vendor.service_category)?.label || vendor.service_category}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {vendor.tier ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tierConfig[vendor.tier]?.bgClass || 'bg-slate-100 text-slate-800'}`}>
                          T{getTierNumber(vendor.tier)} {tierConfig[vendor.tier]?.label || 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Not assessed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {vendor.risk_rating ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getTierColor(vendor.tier)}-100 text-${getTierColor(vendor.tier)}-800`}>
                          {vendor.risk_rating.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(vendor.status)}-100 text-${getStatusColor(vendor.status)}-800`}>
                        {VENDOR_STATUSES.find((s) => s.value === vendor.status)?.label || vendor.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {vendor.next_review_date ? formatDate(vendor.next_review_date) : 'Not scheduled'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to={`/vendors/${vendor.id}`}
                        className="text-slate-900 hover:text-slate-600 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={filteredVendors.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {currentOrganization && (
        <VendorImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          organizationId={currentOrganization.id}
          onImportComplete={fetchVendors}
        />
      )}

      {selectedForCompare.size >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
          <div className="bg-blue-600 shadow-lg border-t border-blue-700">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <GitCompare className="w-5 h-5 text-white" />
                  <span className="text-white font-medium">
                    {selectedForCompare.size} vendor{selectedForCompare.size > 1 ? 's' : ''} selected for comparison
                  </span>
                  <span className="text-blue-200 text-sm">
                    (Select up to 4 vendors)
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={clearCompareSelection}
                    className="px-4 py-2 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={handleCompare}
                    className="px-6 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center space-x-2 font-medium shadow-sm"
                  >
                    <GitCompare className="w-4 h-4" />
                    <span>Compare Selected</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

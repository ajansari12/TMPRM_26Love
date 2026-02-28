import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { Vendor } from '../types';
import {
  Search,
  Filter,
  Building2,
  Globe,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Eye,
} from 'lucide-react';
import { SERVICE_CATEGORIES, VENDOR_STATUSES, BUSINESS_UNITS } from '../lib/constants';
import { tierConfig } from '../lib/riskCalculations';
import { formatDate, formatCurrency, getTierColor } from '../lib/utils';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';
import { exportToCSV } from '../lib/exportUtils';
import { TierLevel } from '../types';

type SortField =
  | 'legal_name'
  | 'tier'
  | 'status'
  | 'service_category'
  | 'contract_value_cad'
  | 'next_review_date'
  | 'created_at';
type SortDir = 'asc' | 'desc';

interface Filters {
  status: string;
  tier: string;
  category: string;
  businessUnit: string;
  critical: string;
  dataAccess: string;
}

const INITIAL_FILTERS: Filters = {
  status: '',
  tier: '',
  category: '',
  businessUnit: '',
  critical: '',
  dataAccess: '',
};

const TIER_OPTIONS: { value: string; label: string }[] = Object.entries(tierConfig).map(
  ([key, cfg]) => ({ value: key, label: cfg.label }),
);

export default function VendorInventory() {
  const { currentOrganization } = useOrganization();
  const [searchParams] = useSearchParams();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const debouncedSearch = useDebounce(searchTerm, 250);

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const [sortField, setSortField] = useState<SortField>('legal_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchVendors = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setVendors(data || []);
    } catch {
      setError('Failed to load vendor inventory');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const filtered = useMemo(() => {
    let result = [...vendors];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (v) =>
          v.legal_name.toLowerCase().includes(q) ||
          v.trading_name?.toLowerCase().includes(q) ||
          v.vendor_id?.toLowerCase().includes(q) ||
          v.service_description?.toLowerCase().includes(q),
      );
    }

    if (filters.status) result = result.filter((v) => v.status === filters.status);
    if (filters.tier) result = result.filter((v) => v.tier === filters.tier);
    if (filters.category) result = result.filter((v) => v.service_category === filters.category);
    if (filters.businessUnit) result = result.filter((v) => v.business_unit === filters.businessUnit);
    if (filters.critical === 'yes') result = result.filter((v) => v.is_critical);
    if (filters.critical === 'no') result = result.filter((v) => !v.is_critical);
    if (filters.dataAccess) result = result.filter((v) => v.data_access_level === filters.dataAccess);

    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });

    return result;
  }, [vendors, debouncedSearch, filters, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSearchTerm('');
  };

  const handleExport = () => {
    const rows = filtered.map((v) => ({
      'Vendor ID': v.vendor_id,
      'Legal Name': v.legal_name,
      'Trading Name': v.trading_name || '',
      Status: v.status,
      Tier: v.tier ? tierConfig[v.tier as TierLevel]?.label || v.tier : 'Untiered',
      Critical: v.is_critical ? 'Yes' : 'No',
      Category: SERVICE_CATEGORIES.find((c) => c.value === v.service_category)?.label || v.service_category,
      'Business Unit': BUSINESS_UNITS.find((b) => b.value === v.business_unit)?.label || v.business_unit || '',
      'Contract Value (CAD)': v.contract_value_cad?.toString() || '',
      Country: v.country,
      'Next Review': v.next_review_date || '',
      'Onboarding Date': v.onboarding_date || '',
    }));
    exportToCSV(rows, `vendor-inventory-${new Date().toISOString().slice(0, 10)}`);
  };

  const stats = useMemo(() => {
    const total = vendors.length;
    const critical = vendors.filter((v) => v.is_critical).length;
    const active = vendors.filter((v) => v.status === 'active').length;
    const overdue = vendors.filter((v) => {
      if (!v.next_review_date) return false;
      return new Date(v.next_review_date) < new Date();
    }).length;
    return { total, critical, active, overdue };
  }, [vendors]);

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-500">Select an organization to view vendor inventory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete registry of all third-party relationships
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <CardSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Vendors"
            value={stats.total}
            icon={<Building2 className="h-5 w-5 text-slate-500" />}
          />
          <SummaryCard
            label="Active"
            value={stats.active}
            icon={<Globe className="h-5 w-5 text-emerald-500" />}
            accent="emerald"
          />
          <SummaryCard
            label="Critical"
            value={stats.critical}
            icon={<Shield className="h-5 w-5 text-red-500" />}
            accent="red"
          />
          <SummaryCard
            label="Review Overdue"
            value={stats.overdue}
            icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
            accent={stats.overdue > 0 ? 'amber' : undefined}
          />
        </div>
      )}

      {/* Search + Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-white text-slate-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <FilterSelect
              label="Status"
              value={filters.status}
              options={VENDOR_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            />
            <FilterSelect
              label="Risk Tier"
              value={filters.tier}
              options={TIER_OPTIONS}
              onChange={(v) => setFilters((f) => ({ ...f, tier: v }))}
            />
            <FilterSelect
              label="Category"
              value={filters.category}
              options={SERVICE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
            />
            <FilterSelect
              label="Business Unit"
              value={filters.businessUnit}
              options={BUSINESS_UNITS.map((b) => ({ value: b.value, label: b.label }))}
              onChange={(v) => setFilters((f) => ({ ...f, businessUnit: v }))}
            />
            <FilterSelect
              label="Critical"
              value={filters.critical}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, critical: v }))}
            />
            <FilterSelect
              label="Data Access"
              value={filters.dataAccess}
              options={[
                { value: 'none', label: 'None' },
                { value: 'aggregated', label: 'Aggregated' },
                { value: 'identifiable', label: 'Identifiable' },
                { value: 'sensitive', label: 'Sensitive' },
                { value: 'highly_sensitive', label: 'Highly Sensitive' },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, dataAccess: v }))}
            />
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchVendors} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No vendors found"
            description={
              activeFilterCount > 0 || debouncedSearch
                ? 'Try adjusting your search or filters.'
                : 'No vendors have been added to this organization yet.'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Vendor inventory">
                <thead>
                  <tr className="border-t border-b border-slate-200 bg-slate-50/50">
                    <SortableHeader field="legal_name" label="Vendor" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader field="tier" label="Tier" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader field="status" label="Status" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader field="service_category" label="Category" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader field="contract_value_cad" label="Contract Value" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader field="next_review_date" label="Next Review" current={sortField} dir={sortDir} onSort={handleSort} />
                    <th scope="col" className="px-4 py-3 text-right font-medium text-slate-500" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((vendor) => (
                    <VendorRow key={vendor.id} vendor={vendor} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 border-t border-slate-100">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}) {
  const accentBorder = accent ? `border-l-2 border-l-${accent}-400` : '';
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${accentBorder}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}

function SortableHeader({
  field,
  label,
  current,
  dir,
  onSort,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const isActive = current === field;
  return (
    <th scope="col" className="px-4 py-3 text-left font-medium text-slate-500">
      <button
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
      >
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

function VendorRow({ vendor }: { vendor: Vendor }) {
  const tierLabel = vendor.tier
    ? tierConfig[vendor.tier as TierLevel]?.label || 'Unknown'
    : 'Untiered';
  const tierColor = getTierColor(vendor.tier);
  const statusObj = VENDOR_STATUSES.find((s) => s.value === vendor.status);
  const categoryLabel = SERVICE_CATEGORIES.find((c) => c.value === vendor.service_category)?.label || vendor.service_category;

  const isOverdue =
    vendor.next_review_date && new Date(vendor.next_review_date) < new Date();

  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
            {vendor.legal_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              to={`/vendors/${vendor.id}`}
              className="font-medium text-slate-900 hover:text-blue-600 transition-colors truncate block"
            >
              {vendor.legal_name}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">{vendor.vendor_id}</span>
              {vendor.is_critical && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                  <Shield className="h-3 w-3" /> Critical
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-${tierColor}-50 text-${tierColor}-700 border border-${tierColor}-200`}
        >
          <span className={`w-1.5 h-1.5 rounded-full bg-${tierColor}-500`} />
          {tierLabel}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-${statusObj?.color || 'slate'}-50 text-${statusObj?.color || 'slate'}-700`}
        >
          {statusObj?.label || vendor.status}
        </span>
      </td>
      <td className="px-4 py-3.5 text-slate-600 max-w-[180px] truncate">
        {categoryLabel}
      </td>
      <td className="px-4 py-3.5 text-slate-600 tabular-nums">
        {formatCurrency(vendor.contract_value_cad)}
      </td>
      <td className="px-4 py-3.5">
        {vendor.next_review_date ? (
          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}>
            {isOverdue && <AlertTriangle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
            {formatDate(vendor.next_review_date)}
          </span>
        ) : (
          <span className="text-slate-400">--</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        <Link
          to={`/vendors/${vendor.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Link>
      </td>
    </tr>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

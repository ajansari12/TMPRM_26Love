import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { exportToExcel, exportToPDF, formatCurrency } from '../lib/exportUtils';
import { format } from 'date-fns';
import { SERVICE_CATEGORIES, BUSINESS_UNITS, LIFECYCLE_STAGES } from '../lib/constants';
import { logger } from '../lib/logger';
import {
  Download,
  FileText,
  Building2,
  Globe,
  DollarSign,
  Users,
  Layers,
  Filter,
  BarChart3,
  Loader2,
  Server,
  MapPin,
  LogOut,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Treemap,
} from 'recharts';

const TIER_COLORS = {
  'tier_5_critical': '#ef4444',
  'tier_4_high': '#f97316',
  'tier_3_moderate': '#eab308',
  'tier_2_low': '#22c55e',
  'tier_1_informational': '#3b82f6',
};

const TIER_LABELS: Record<string, string> = {
  'tier_5_critical': 'Tier 5 - Critical',
  'tier_4_high': 'Tier 4 - High',
  'tier_3_moderate': 'Tier 3 - Moderate',
  'tier_2_low': 'Tier 2 - Low',
  'tier_1_informational': 'Tier 1 - Informational',
};

const CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
  '#14b8a6', '#eab308', '#64748b', '#a855f7', '#22c55e',
];

export default function InventoryReports() {
  const { currentOrganization } = useOrganization();
  const [vendors, setVendors] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [fourthParties, setFourthParties] = useState<any[]>([]);
  const [exitStrategies, setExitStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');

  useEffect(() => {
    if (currentOrganization) {
      fetchData();
    }
  }, [currentOrganization]);

  async function fetchData() {
    if (!currentOrganization) return;
    try {
      const vendorsRes = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      const vendorList = vendorsRes.data || [];
      const vendorIds = vendorList.map((v) => v.id);

      const emptyRes = { data: [] as any[] };
      const hasVendors = vendorIds.length > 0;

      const [contractsRes, fourthPartiesRes, exitRes] = await Promise.all([
        hasVendors
          ? supabase.from('contracts').select('*').in('vendor_id', vendorIds)
          : emptyRes,
        supabase.from('fourth_parties').select('*').eq('organization_id', currentOrganization.id),
        supabase.from('exit_strategies').select('*').eq('organization_id', currentOrganization.id),
      ]);

      setVendors(vendorList);
      setContracts(contractsRes.data || []);
      setFourthParties(fourthPartiesRes.data || []);
      setExitStrategies(exitRes.data || []);
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (selectedCategory !== 'all' && v.service_category !== selectedCategory) return false;
      if (selectedTier !== 'all' && v.tier !== selectedTier) return false;
      return true;
    });
  }, [vendors, selectedCategory, selectedTier]);

  const analytics = useMemo(() => {
    const byCategory = SERVICE_CATEGORIES.map((cat, index) => {
      const categoryVendors = vendors.filter((v) => v.service_category === cat.value);
      const categoryContracts = contracts.filter((c) => {
        const vendor = vendors.find((v) => v.id === c.vendor_id);
        return vendor?.service_category === cat.value;
      });
      return {
        category: cat.label,
        categoryKey: cat.value,
        count: categoryVendors.length,
        value: categoryContracts.reduce((sum, c) => sum + (c.annual_value_cad || 0), 0),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      };
    }).filter((c) => c.count > 0);

    const byBusinessUnit = BUSINESS_UNITS.map((bu) => {
      const buVendors = vendors.filter((v) => v.business_unit === bu.value);
      return {
        unit: bu.label,
        unitKey: bu.value,
        count: buVendors.length,
        critical: buVendors.filter((v) => v.tier === 'tier_5_critical').length,
        high: buVendors.filter((v) => v.tier === 'tier_4_high').length,
        moderate: buVendors.filter((v) => v.tier === 'tier_3_moderate').length,
        low: buVendors.filter((v) => v.tier === 'tier_2_low').length,
        informational: buVendors.filter((v) => v.tier === 'tier_1_informational').length,
      };
    }).filter((bu) => bu.count > 0);

    const byTier = Object.entries(TIER_LABELS).map(([key, label]) => {
      const tierVendors = vendors.filter((v) => v.tier === key);
      const tierContracts = contracts.filter((c) => {
        const vendor = vendors.find((v) => v.id === c.vendor_id);
        return vendor?.tier === key;
      });
      return {
        tier: label,
        tierKey: key,
        count: tierVendors.length,
        value: tierContracts.reduce((sum, c) => sum + (c.annual_value_cad || 0), 0),
        color: TIER_COLORS[key as keyof typeof TIER_COLORS],
      };
    });

    const byCountry = vendors.reduce((acc, v) => {
      const country = v.country || 'Unknown';
      if (!acc[country]) {
        acc[country] = { country, count: 0, value: 0 };
      }
      acc[country].count++;
      const vendorContracts = contracts.filter((c) => c.vendor_id === v.id);
      acc[country].value += vendorContracts.reduce((sum, c) => sum + (c.annual_value_cad || 0), 0);
      return acc;
    }, {} as Record<string, { country: string; count: number; value: number }>);
    const countryData = Object.values(byCountry).sort((a, b) => b.count - a.count);

    const byLifecycle = LIFECYCLE_STAGES.map((stage) => ({
      stage: stage.label,
      stageKey: stage.value,
      count: vendors.filter((v) => v.lifecycle_stage === stage.value).length,
    }));

    const withSystemAccess = vendors.filter((v) => v.has_system_access).length;
    const withSensitiveData = vendors.filter((v) => v.handles_sensitive_data).length;
    const withSubcontractors = vendors.filter((v) => v.uses_subcontractors).length;

    const accessLevelDist = ['none', 'read_only', 'limited', 'moderate', 'high', 'full_admin'].map((level) => ({
      level: level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      levelKey: level,
      count: vendors.filter((v) => v.data_access_level === level).length,
    }));

    const subcontractorsByVendor = vendors
      .filter((v) => v.uses_subcontractors)
      .map((v) => ({
        vendor: v.legal_name,
        vendorId: v.id,
        count: fourthParties.filter((s) => s.vendor_id === v.id).length,
        tier: v.tier,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalContractValue = contracts.reduce((sum, c) => sum + (c.annual_value_cad || 0), 0);
    const avgContractValue = contracts.length > 0 ? totalContractValue / contracts.length : 0;

    const treemapData = byCategory.map((cat) => ({
      name: cat.category,
      size: cat.count,
      value: cat.value,
    }));

    const criticalHighVendors = vendors.filter((v) => v.tier === 'tier_5_critical' || v.tier === 'tier_4_high');
    const vendorsWithExitStrategy = criticalHighVendors.filter((v) =>
      exitStrategies.some((es) => es.vendor_id === v.id)
    );
    const approvedExitStrategies = exitStrategies.filter((es) => es.status === 'approved');
    const testedExitStrategies = exitStrategies.filter((es) => es.status === 'tested' || es.status === 'approved');

    const exitStrategyByStatus = ['not_started', 'in_progress', 'documented', 'tested', 'approved'].map((status) => ({
      status: status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      statusKey: status,
      count: exitStrategies.filter((es) => es.status === status).length,
    }));

    return {
      byCategory,
      byBusinessUnit,
      byTier,
      byCountry: countryData,
      byLifecycle,
      withSystemAccess,
      withSensitiveData,
      withSubcontractors,
      accessLevelDist,
      subcontractorsByVendor,
      totalContractValue,
      avgContractValue,
      treemapData,
      totalFourthParties: fourthParties.length,
      criticalHighVendors: criticalHighVendors.length,
      vendorsWithExitStrategy: vendorsWithExitStrategy.length,
      approvedExitStrategies: approvedExitStrategies.length,
      testedExitStrategies: testedExitStrategies.length,
      exitStrategyByStatus,
    };
  }, [vendors, contracts, fourthParties, exitStrategies]);

  async function handleExportPDF() {
    setExporting(true);
    try {
      await exportToPDF({
        title: 'Vendor Inventory Report',
        subtitle: 'Comprehensive Portfolio Analysis',
        date: format(new Date(), 'MMMM d, yyyy'),
        sections: [
          {
            title: 'Portfolio Summary',
            type: 'kpi',
            kpiData: [
              { label: 'Total Vendors', value: vendors.length },
              { label: 'Contract Value', value: formatCurrency(analytics.totalContractValue) },
              { label: 'With System Access', value: analytics.withSystemAccess },
              { label: 'Fourth Parties', value: analytics.totalFourthParties },
            ],
          },
          {
            title: 'Vendors by Service Category',
            type: 'table',
            tableData: {
              headers: ['Category', 'Count', 'Contract Value'],
              rows: analytics.byCategory.map((c) => [c.category, c.count, formatCurrency(c.value)]),
            },
          },
          {
            title: 'Vendors by Risk Tier',
            type: 'table',
            tableData: {
              headers: ['Risk Tier', 'Count', 'Contract Value'],
              rows: analytics.byTier.map((t) => [t.tier, t.count, formatCurrency(t.value)]),
            },
          },
          {
            title: 'Geographic Distribution',
            type: 'table',
            tableData: {
              headers: ['Country', 'Vendor Count', 'Contract Value'],
              rows: analytics.byCountry.slice(0, 10).map((c) => [c.country, c.count, formatCurrency(c.value)]),
            },
          },
        ],
      });
    } finally {
      setExporting(false);
    }
  }

  function handleExportExcel() {
    const data = filteredVendors.map((v) => {
      const vendorContracts = contracts.filter((c) => c.vendor_id === v.id);
      const totalValue = vendorContracts.reduce((sum, c) => sum + (c.annual_value_cad || 0), 0);
      const subCount = fourthParties.filter((s) => s.vendor_id === v.id).length;
      const exitStrategy = exitStrategies.find((es) => es.vendor_id === v.id);
      const isCriticalHigh = v.tier === 'tier_5_critical' || v.tier === 'tier_4_high';

      return {
        vendor_id: v.vendor_id,
        legal_name: v.legal_name,
        trading_name: v.trading_name || '',
        country: v.country || '',
        city: v.city || '',
        service_category: SERVICE_CATEGORIES.find((c) => c.value === v.service_category)?.label || v.service_category,
        business_unit: BUSINESS_UNITS.find((b) => b.value === v.business_unit)?.label || v.business_unit,
        tier: TIER_LABELS[v.tier] || 'Not Assessed',
        status: v.status,
        lifecycle_stage: LIFECYCLE_STAGES.find((s) => s.value === v.lifecycle_stage)?.label || v.lifecycle_stage,
        is_critical: v.is_critical ? 'Yes' : 'No',
        has_system_access: v.has_system_access ? 'Yes' : 'No',
        data_access_level: v.data_access_level || 'None',
        handles_sensitive_data: v.handles_sensitive_data ? 'Yes' : 'No',
        uses_subcontractors: v.uses_subcontractors ? 'Yes' : 'No',
        subcontractor_count: subCount,
        contract_count: vendorContracts.length,
        total_contract_value: totalValue,
        exit_strategy_required: isCriticalHigh ? 'Yes' : 'No',
        exit_strategy_status: exitStrategy?.status?.replace('_', ' ') || (isCriticalHigh ? 'Not Started' : 'N/A'),
        onboarding_date: v.onboarding_date || '',
      };
    });

    exportToExcel(data, `vendor_inventory_${format(new Date(), 'yyyy-MM-dd')}`, [
      { key: 'vendor_id', label: 'Vendor ID' },
      { key: 'legal_name', label: 'Legal Name' },
      { key: 'trading_name', label: 'Trading Name' },
      { key: 'country', label: 'Country' },
      { key: 'city', label: 'City' },
      { key: 'service_category', label: 'Service Category' },
      { key: 'business_unit', label: 'Business Unit' },
      { key: 'tier', label: 'Risk Tier' },
      { key: 'status', label: 'Status' },
      { key: 'lifecycle_stage', label: 'Lifecycle Stage' },
      { key: 'is_critical', label: 'Critical' },
      { key: 'has_system_access', label: 'System Access' },
      { key: 'data_access_level', label: 'Access Level' },
      { key: 'handles_sensitive_data', label: 'Sensitive Data' },
      { key: 'uses_subcontractors', label: 'Uses Fourth Parties' },
      { key: 'subcontractor_count', label: 'Fourth Party Count' },
      { key: 'contract_count', label: 'Contract Count' },
      { key: 'total_contract_value', label: 'Total Contract Value (CAD)' },
      { key: 'exit_strategy_required', label: 'Exit Strategy Required' },
      { key: 'exit_strategy_status', label: 'Exit Strategy Status' },
      { key: 'onboarding_date', label: 'Onboarding Date' },
    ]);
  }

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view inventory reports</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Inventory Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comprehensive vendor portfolio analysis and metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {SERVICE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Tiers</option>
            {Object.entries(TIER_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="ml-auto text-sm text-gray-500">
            Showing {filteredVendors.length} of {vendors.length} vendors
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vendors</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{vendors.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Contract Value</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{formatCurrency(analytics.totalContractValue)}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-full">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">With System Access</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{analytics.withSystemAccess}</p>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.withSystemAccess / vendors.length) * 100).toFixed(1)}% of vendors
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Server className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fourth Parties</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{analytics.totalFourthParties}</p>
              <p className="text-xs text-gray-500 mt-1">{analytics.withSubcontractors} vendors use subs</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {analytics.criticalHighVendors > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-gray-900">Exit Strategy Coverage</h2>
            </div>
            <span className="text-sm text-gray-500">
              For Critical & High Risk Vendors (OSFI B-10 Requirement)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-gray-600">Critical/High Vendors</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{analytics.criticalHighVendors}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">With Exit Strategy</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{analytics.vendorsWithExitStrategy}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.criticalHighVendors > 0
                  ? `${((analytics.vendorsWithExitStrategy / analytics.criticalHighVendors) * 100).toFixed(0)}% coverage`
                  : '0% coverage'}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-gray-600">Tested or Approved</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{analytics.testedExitStrategies}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Fully Approved</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{analytics.approvedExitStrategies}</p>
            </div>
          </div>
          {analytics.vendorsWithExitStrategy < analytics.criticalHighVendors && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <span className="font-medium">{analytics.criticalHighVendors - analytics.vendorsWithExitStrategy}</span> critical/high risk vendor(s) are missing documented exit strategies.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendors by Service Category</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={analytics.byCategory} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="category" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number, name: string) => [value, name === 'count' ? 'Vendors' : 'Value']} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Value by Tier</h2>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={analytics.byTier.filter((t) => t.value > 0)}
                cx="50%"
                cy="50%"
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                nameKey="tier"
                label={({ tier, value }) => `${tier.replace('Tier ', 'T')}: ${formatCurrency(value)}`}
                labelLine={false}
              >
                {analytics.byTier.map((entry) => (
                  <Cell key={entry.tierKey} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tier Distribution by Business Unit</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={analytics.byBusinessUnit}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="unit" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="critical" name="Critical" stackId="a" fill={TIER_COLORS['tier_5_critical']} />
            <Bar dataKey="high" name="High" stackId="a" fill={TIER_COLORS['tier_4_high']} />
            <Bar dataKey="moderate" name="Moderate" stackId="a" fill={TIER_COLORS['tier_3_moderate']} />
            <Bar dataKey="low" name="Low" stackId="a" fill={TIER_COLORS['tier_2_low']} />
            <Bar dataKey="informational" name="Info" stackId="a" fill={TIER_COLORS['tier_1_informational']} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h2>
          <div className="space-y-3">
            {analytics.byCountry.slice(0, 8).map((country, index) => (
              <div key={country.country} className="flex items-center">
                <div className="flex items-center gap-2 w-32">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 truncate">{country.country}</span>
                </div>
                <div className="flex-1 mx-3">
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(country.count / vendors.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-24 text-right">
                  <span className="text-sm font-semibold text-gray-900">{country.count}</span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({((country.count / vendors.length) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lifecycle Stage Funnel</h2>
          <div className="space-y-2">
            {analytics.byLifecycle.map((stage, index) => {
              const maxCount = Math.max(...analytics.byLifecycle.map((s) => s.count));
              const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
              return (
                <div key={stage.stageKey} className="flex items-center">
                  <div className="w-32 text-sm text-gray-600">{stage.stage}</div>
                  <div className="flex-1 mx-3">
                    <div className="h-8 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded flex items-center justify-end pr-2"
                        style={{
                          width: `${width}%`,
                          backgroundColor: `hsl(${210 - index * 20}, 70%, 50%)`,
                        }}
                      >
                        {stage.count > 0 && (
                          <span className="text-xs font-semibold text-white">{stage.count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Access Level Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.accessLevelDist.filter((a) => a.count > 0)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="level" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Vendors by Fourth Party Count</h2>
          {analytics.subcontractorsByVendor.length > 0 ? (
            <div className="space-y-2">
              {analytics.subcontractorsByVendor.map((item) => (
                <div key={item.vendorId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8' }}
                    />
                    <span className="text-sm text-gray-700 truncate max-w-[200px]">{item.vendor}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.count} parties</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No fourth party data available</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Data Access Summary</h2>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">System Access</span>
              </div>
              <p className="text-3xl font-bold text-orange-700">{analytics.withSystemAccess}</p>
              <p className="text-sm text-orange-600 mt-1">
                {((analytics.withSystemAccess / vendors.length) * 100).toFixed(1)}% of portfolio
              </p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-900">Sensitive Data</span>
              </div>
              <p className="text-3xl font-bold text-red-700">{analytics.withSensitiveData}</p>
              <p className="text-sm text-red-600 mt-1">
                {((analytics.withSensitiveData / vendors.length) * 100).toFixed(1)}% handle sensitive data
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Countries</span>
              </div>
              <p className="text-3xl font-bold text-purple-700">{analytics.byCountry.length}</p>
              <p className="text-sm text-purple-600 mt-1">
                Geographic locations served
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

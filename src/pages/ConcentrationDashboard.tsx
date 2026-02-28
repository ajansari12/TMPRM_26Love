import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { ConcentrationThreshold } from '../types';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Treemap,
} from 'recharts';
import {
  AlertTriangle,
  TrendingUp,
  Building2,
  Globe,
  Layers,
  RefreshCw,
  Info,
  ChevronRight,
} from 'lucide-react';
import { logger } from '../lib/logger';

interface VendorConcentration {
  vendor_id: string;
  legal_name: string;
  tier: string;
  contract_value_cad: number;
  percentage: number;
  service_category: string;
  country: string;
}

interface CategoryConcentration {
  category: string;
  display_name: string;
  total_value: number;
  percentage: number;
  vendor_count: number;
}

interface GeographicConcentration {
  country: string;
  total_value: number;
  percentage: number;
  vendor_count: number;
}

const TIER_COLORS: Record<string, string> = {
  tier_5_critical: '#ef4444',
  tier_4_high: '#f97316',
  tier_3_moderate: '#f59e0b',
  tier_2_low: '#10b981',
  tier_1_informational: '#64748b',
};

const CATEGORY_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#84cc16',
  '#06b6d4',
  '#a855f7',
  '#f43f5e',
  '#22c55e',
];

interface ConcentrationBreach {
  type: 'vendor' | 'category' | 'geographic';
  name: string;
  percentage: number;
  threshold: number;
  thresholdName: string;
  severity: 'warning' | 'critical';
}

export default function ConcentrationDashboard() {
  const { currentOrganization } = useOrganization();
  const [vendorConcentration, setVendorConcentration] = useState<VendorConcentration[]>([]);
  const [categoryConcentration, setCategoryConcentration] = useState<CategoryConcentration[]>([]);
  const [geographicConcentration, setGeographicConcentration] = useState<GeographicConcentration[]>([]);
  const [thresholds, setThresholds] = useState<ConcentrationThreshold[]>([]);
  const [concentrationBreaches, setConcentrationBreaches] = useState<ConcentrationBreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpend, setTotalSpend] = useState(0);
  const [activeView, setActiveView] = useState<'vendor' | 'category' | 'geographic'>('vendor');

  useEffect(() => {
    if (currentOrganization) {
      fetchData();
    }
  }, [currentOrganization]);

  async function fetchData() {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [vendorsRes, thresholdsRes] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, vendor_id, legal_name, tier, contract_value_cad, service_category, country')
          .eq('organization_id', currentOrganization.id)
          .not('contract_value_cad', 'is', null)
          .gt('contract_value_cad', 0),
        supabase.from('concentration_thresholds').select('*').eq('is_active', true).eq('organization_id', currentOrganization.id),
      ]);

      const vendors = vendorsRes.data || [];
      setThresholds(thresholdsRes.data || []);

      const total = vendors.reduce((sum, v) => sum + (v.contract_value_cad || 0), 0);
      setTotalSpend(total);

      const vendorData: VendorConcentration[] = vendors
        .map((v) => ({
          vendor_id: v.vendor_id,
          legal_name: v.legal_name,
          tier: v.tier || 'unassessed',
          contract_value_cad: v.contract_value_cad || 0,
          percentage: total > 0 ? ((v.contract_value_cad || 0) / total) * 100 : 0,
          service_category: v.service_category,
          country: v.country || 'Unknown',
        }))
        .sort((a, b) => b.contract_value_cad - a.contract_value_cad);
      setVendorConcentration(vendorData);

      const categoryMap = new Map<string, { total: number; count: number }>();
      vendors.forEach((v) => {
        const cat = v.service_category || 'other';
        const existing = categoryMap.get(cat) || { total: 0, count: 0 };
        categoryMap.set(cat, {
          total: existing.total + (v.contract_value_cad || 0),
          count: existing.count + 1,
        });
      });

      const categoryData: CategoryConcentration[] = Array.from(categoryMap.entries())
        .map(([cat, data]) => ({
          category: cat,
          display_name: cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          total_value: data.total,
          percentage: total > 0 ? (data.total / total) * 100 : 0,
          vendor_count: data.count,
        }))
        .sort((a, b) => b.total_value - a.total_value);
      setCategoryConcentration(categoryData);

      const geoMap = new Map<string, { total: number; count: number }>();
      vendors.forEach((v) => {
        const country = v.country || 'Unknown';
        const existing = geoMap.get(country) || { total: 0, count: 0 };
        geoMap.set(country, {
          total: existing.total + (v.contract_value_cad || 0),
          count: existing.count + 1,
        });
      });

      const geoData: GeographicConcentration[] = Array.from(geoMap.entries())
        .map(([country, data]) => ({
          country,
          total_value: data.total,
          percentage: total > 0 ? (data.total / total) * 100 : 0,
          vendor_count: data.count,
        }))
        .sort((a, b) => b.total_value - a.total_value);
      setGeographicConcentration(geoData);

      const breaches = checkConcentrationBreaches(
        vendorData,
        categoryData,
        geoData,
        thresholdsRes.data || []
      );
      setConcentrationBreaches(breaches);
    } catch (error) {
      logger.error('Error fetching concentration data:', error);
    } finally {
      setLoading(false);
    }
  }

  function checkConcentrationBreaches(
    vendors: VendorConcentration[],
    categories: CategoryConcentration[],
    geographic: GeographicConcentration[],
    thresholdList: ConcentrationThreshold[]
  ): ConcentrationBreach[] {
    const breaches: ConcentrationBreach[] = [];

    for (const threshold of thresholdList) {
      if (!threshold.is_active) continue;

      if (threshold.threshold_type === 'single_vendor') {
        for (const vc of vendors) {
          let severity: 'warning' | 'critical' | null = null;
          let thresholdValue = 0;

          if (vc.percentage >= threshold.critical_level) {
            severity = 'critical';
            thresholdValue = threshold.critical_level;
          } else if (vc.percentage >= threshold.warning_level) {
            severity = 'warning';
            thresholdValue = threshold.warning_level;
          }

          if (severity) {
            breaches.push({
              type: 'vendor',
              name: vc.legal_name,
              percentage: vc.percentage,
              threshold: thresholdValue,
              thresholdName: threshold.threshold_name,
              severity,
            });
          }
        }
      }

      if (threshold.threshold_type === 'service_category') {
        for (const cc of categories) {
          let severity: 'warning' | 'critical' | null = null;
          let thresholdValue = 0;

          if (cc.percentage >= threshold.critical_level) {
            severity = 'critical';
            thresholdValue = threshold.critical_level;
          } else if (cc.percentage >= threshold.warning_level) {
            severity = 'warning';
            thresholdValue = threshold.warning_level;
          }

          if (severity) {
            breaches.push({
              type: 'category',
              name: cc.display_name,
              percentage: cc.percentage,
              threshold: thresholdValue,
              thresholdName: threshold.threshold_name,
              severity,
            });
          }
        }
      }

      if (threshold.threshold_type === 'geographic') {
        for (const gc of geographic) {
          let severity: 'warning' | 'critical' | null = null;
          let thresholdValue = 0;

          if (gc.percentage >= threshold.critical_level) {
            severity = 'critical';
            thresholdValue = threshold.critical_level;
          } else if (gc.percentage >= threshold.warning_level) {
            severity = 'warning';
            thresholdValue = threshold.warning_level;
          }

          if (severity) {
            breaches.push({
              type: 'geographic',
              name: gc.country,
              percentage: gc.percentage,
              threshold: thresholdValue,
              thresholdName: threshold.threshold_name,
              severity,
            });
          }
        }
      }
    }

    return breaches;
  }

  function getThreshold(type: string): ConcentrationThreshold | undefined {
    return thresholds.find((t) => t.threshold_type === type);
  }

  function getBreachStatus(
    value: number,
    threshold?: ConcentrationThreshold
  ): 'green' | 'warning' | 'critical' {
    if (!threshold) return 'green';
    if (value >= threshold.critical_level) return 'critical';
    if (value >= threshold.warning_level) return 'warning';
    return 'green';
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  const singleVendorThreshold = getThreshold('single_vendor');
  const categoryThreshold = getThreshold('service_category');
  const geoThreshold = getThreshold('geographic');

  const topVendor = vendorConcentration[0];
  const topCategory = categoryConcentration[0];
  const topCountry = geographicConcentration[0];

  const vendorBreaches = vendorConcentration.filter(
    (v) => getBreachStatus(v.percentage, singleVendorThreshold) !== 'green'
  );
  const categoryBreaches = categoryConcentration.filter(
    (c) => getBreachStatus(c.percentage, categoryThreshold) !== 'green'
  );
  const geoBreaches = geographicConcentration.filter(
    (g) => getBreachStatus(g.percentage, geoThreshold) !== 'green'
  );

  const totalBreaches = vendorBreaches.length + categoryBreaches.length + geoBreaches.length;

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view concentration data</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const treemapData = vendorConcentration.slice(0, 20).map((v) => ({
    name: v.legal_name,
    size: v.contract_value_cad,
    tier: v.tier,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Concentration Risk</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor vendor spend concentration across dimensions
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Spend</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpend)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {vendorConcentration.length} vendors with contracts
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Top Vendor</span>
            <Building2 className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900 truncate">
            {topVendor?.legal_name || 'N/A'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-sm font-medium ${
                getBreachStatus(topVendor?.percentage || 0, singleVendorThreshold) === 'critical'
                  ? 'text-red-600'
                  : getBreachStatus(topVendor?.percentage || 0, singleVendorThreshold) === 'warning'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {topVendor?.percentage.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500">of total</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Top Category</span>
            <Layers className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900 truncate">
            {topCategory?.display_name || 'N/A'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-sm font-medium ${
                getBreachStatus(topCategory?.percentage || 0, categoryThreshold) === 'critical'
                  ? 'text-red-600'
                  : getBreachStatus(topCategory?.percentage || 0, categoryThreshold) === 'warning'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {topCategory?.percentage.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500">of total</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Threshold Breaches</span>
            <AlertTriangle
              className={`w-5 h-5 ${totalBreaches > 0 ? 'text-red-600' : 'text-emerald-600'}`}
            />
          </div>
          <p
            className={`text-2xl font-bold ${
              totalBreaches > 0 ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {totalBreaches}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {vendorBreaches.length} vendor, {categoryBreaches.length} category,{' '}
            {geoBreaches.length} geographic
          </p>
        </div>
      </div>

      {concentrationBreaches.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-amber-900 mb-3">
                Concentration Threshold Breaches Detected
              </h3>

              {concentrationBreaches.filter((b) => b.type === 'vendor').length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-amber-800 mb-1.5">
                    Vendor Concentration:
                  </h4>
                  <ul className="space-y-1">
                    {concentrationBreaches
                      .filter((b) => b.type === 'vendor')
                      .map((breach, idx) => (
                        <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>
                            <span className="font-medium">{breach.name}</span> is at{' '}
                            <span className="font-semibold">{breach.percentage.toFixed(1)}%</span> —
                            exceeds{' '}
                            <span className="font-semibold">{breach.threshold}%</span>{' '}
                            {breach.severity === 'critical' ? 'critical' : 'warning'} threshold
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {concentrationBreaches.filter((b) => b.type === 'category').length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-amber-800 mb-1.5">
                    Category Concentration:
                  </h4>
                  <ul className="space-y-1">
                    {concentrationBreaches
                      .filter((b) => b.type === 'category')
                      .map((breach, idx) => (
                        <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>
                            <span className="font-medium">{breach.name}</span> is at{' '}
                            <span className="font-semibold">{breach.percentage.toFixed(1)}%</span> —
                            exceeds{' '}
                            <span className="font-semibold">{breach.threshold}%</span>{' '}
                            {breach.severity === 'critical' ? 'critical' : 'warning'} threshold
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {concentrationBreaches.filter((b) => b.type === 'geographic').length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-amber-800 mb-1.5">
                    Geographic Concentration:
                  </h4>
                  <ul className="space-y-1">
                    {concentrationBreaches
                      .filter((b) => b.type === 'geographic')
                      .map((breach, idx) => (
                        <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>
                            <span className="font-medium">{breach.name}</span> is at{' '}
                            <span className="font-semibold">{breach.percentage.toFixed(1)}%</span> —
                            exceeds{' '}
                            <span className="font-semibold">{breach.threshold}%</span>{' '}
                            {breach.severity === 'critical' ? 'critical' : 'warning'} threshold
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-amber-200">
                <Link
                  to="/settings"
                  className="text-sm text-amber-800 hover:text-amber-900 font-medium underline"
                >
                  Adjust thresholds in Settings →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'vendor', label: 'By Vendor', icon: Building2 },
              { id: 'category', label: 'By Category', icon: Layers },
              { id: 'geographic', label: 'By Geography', icon: Globe },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as typeof activeView)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeView === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeView === 'vendor' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Vendor Spend Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={treemapData}
                      dataKey="size"
                      aspectRatio={4 / 3}
                      stroke="#fff"
                      content={({ x, y, width, height, name, tier }: any) => (
                        <g>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={TIER_COLORS[tier] || '#94a3b8'}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                          {width > 50 && height > 30 && (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {name?.substring(0, 15)}
                            </text>
                          )}
                        </g>
                      )}
                    />
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {Object.entries(TIER_COLORS).map(([tier, color]) => (
                    <div key={tier} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-gray-600">
                        {tier.replace('tier_', 'T').replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Top Vendors by Spend</h3>
                  {singleVendorThreshold && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Info className="w-3.5 h-3.5" />
                      Warning: {singleVendorThreshold.warning_level}% | Critical:{' '}
                      {singleVendorThreshold.critical_level}%
                    </div>
                  )}
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {vendorConcentration.slice(0, 10).map((v, idx) => {
                    const status = getBreachStatus(v.percentage, singleVendorThreshold);
                    return (
                      <Link
                        key={v.vendor_id}
                        to={`/vendors/${v.vendor_id}`}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg hover:bg-gray-50 transition-colors ${
                          status === 'critical'
                            ? 'border-red-500 bg-red-50'
                            : status === 'warning'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <span className="text-sm font-medium text-gray-400 w-6">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {v.legal_name}
                          </p>
                          <p className="text-xs text-gray-500">{formatCurrency(v.contract_value_cad)}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-sm font-semibold ${
                              status === 'critical'
                                ? 'text-red-600'
                                : status === 'warning'
                                ? 'text-amber-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {v.percentage.toFixed(1)}%
                          </span>
                          {status !== 'green' && (
                            <AlertTriangle
                              className={`w-4 h-4 inline-block ml-1 ${
                                status === 'critical' ? 'text-red-600' : 'text-amber-600'
                              }`}
                            />
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeView === 'category' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Service Category Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryConcentration}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="total_value"
                        nameKey="display_name"
                        label={({ display_name, percentage }) =>
                          percentage > 5 ? `${display_name.substring(0, 10)}... ${percentage.toFixed(0)}%` : ''
                        }
                      >
                        {categoryConcentration.map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => label}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Category Breakdown</h3>
                  {categoryThreshold && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Info className="w-3.5 h-3.5" />
                      Warning: {categoryThreshold.warning_level}% | Critical:{' '}
                      {categoryThreshold.critical_level}%
                    </div>
                  )}
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {categoryConcentration.map((c, idx) => {
                    const status = getBreachStatus(c.percentage, categoryThreshold);
                    return (
                      <div
                        key={c.category}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg ${
                          status === 'critical'
                            ? 'border-red-500 bg-red-50'
                            : status === 'warning'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.display_name}</p>
                          <p className="text-xs text-gray-500">
                            {c.vendor_count} vendors | {formatCurrency(c.total_value)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-sm font-semibold ${
                              status === 'critical'
                                ? 'text-red-600'
                                : status === 'warning'
                                ? 'text-amber-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {c.percentage.toFixed(1)}%
                          </span>
                          {status !== 'green' && (
                            <AlertTriangle
                              className={`w-4 h-4 inline-block ml-1 ${
                                status === 'critical' ? 'text-red-600' : 'text-amber-600'
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeView === 'geographic' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Geographic Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={geographicConcentration.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 80 }}
                    >
                      <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                      <YAxis type="category" dataKey="country" width={75} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value.toFixed(1)}%`,
                          'Concentration',
                        ]}
                      />
                      <Bar
                        dataKey="percentage"
                        radius={[0, 4, 4, 0]}
                        fill="#0ea5e9"
                        shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const status = getBreachStatus(payload.percentage, geoThreshold);
                          const color =
                            status === 'critical'
                              ? '#ef4444'
                              : status === 'warning'
                              ? '#f59e0b'
                              : '#0ea5e9';
                          return (
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              fill={color}
                              rx={4}
                            />
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Country Breakdown</h3>
                  {geoThreshold && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Info className="w-3.5 h-3.5" />
                      Warning: {geoThreshold.warning_level}% | Critical:{' '}
                      {geoThreshold.critical_level}%
                    </div>
                  )}
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {geographicConcentration.map((g) => {
                    const status = getBreachStatus(g.percentage, geoThreshold);
                    return (
                      <div
                        key={g.country}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg ${
                          status === 'critical'
                            ? 'border-red-500 bg-red-50'
                            : status === 'warning'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <Globe className="w-5 h-5 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{g.country}</p>
                          <p className="text-xs text-gray-500">
                            {g.vendor_count} vendors | {formatCurrency(g.total_value)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-sm font-semibold ${
                              status === 'critical'
                                ? 'text-red-600'
                                : status === 'warning'
                                ? 'text-amber-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {g.percentage.toFixed(1)}%
                          </span>
                          {status !== 'green' && (
                            <AlertTriangle
                              className={`w-4 h-4 inline-block ml-1 ${
                                status === 'critical' ? 'text-red-600' : 'text-amber-600'
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Concentration Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {thresholds.map((t) => (
            <div key={t.threshold_type} className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900">{t.threshold_name}</h4>
              <p className="text-xs text-gray-500 mt-1">{t.description}</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs text-gray-600">
                    {t.warning_level}
                    {t.measurement_unit === 'percentage' ? '%' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-600">
                    {t.critical_level}
                    {t.measurement_unit === 'percentage' ? '%' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Thresholds can be configured in Settings by administrators.
        </p>
      </div>
    </div>
  );
}

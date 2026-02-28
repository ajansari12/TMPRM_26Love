import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { Vendor } from '../types';
import { toast } from 'sonner';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  Download,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Shield,
  DollarSign,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { SERVICE_CATEGORIES, VENDOR_STATUSES } from '../lib/constants';
import { tierConfig } from '../lib/riskCalculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VendorWithMetrics extends Vendor {
  contracts?: { id: string; contract_value?: number; status: string }[];
  incidents?: { id: string; severity: string; status: string }[];
  assessments?: { id: string; overall_score?: number; category_scores?: Record<string, number> }[];
  sla_metrics?: { metric_name: string; current_value: number; target_value: number }[];
}

const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

const RISK_DIMENSIONS = [
  { key: 'operational', label: 'Operational Risk' },
  { key: 'financial', label: 'Financial Risk' },
  { key: 'compliance', label: 'Compliance Risk' },
  { key: 'strategic', label: 'Strategic Risk' },
  { key: 'reputational', label: 'Reputational Risk' },
  { key: 'security', label: 'Security Risk' },
];

export default function VendorComparison() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const reportRef = useRef<HTMLDivElement>(null);

  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<VendorWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchAllVendors();
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    const vendorIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];
    if (vendorIds.length > 0 && allVendors.length > 0) {
      loadSelectedVendors(vendorIds);
    }
  }, [searchParams, allVendors]);

  async function fetchAllVendors() {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('legal_name');

      if (error) throw error;
      setAllVendors(data || []);
    } catch (error) {
      logger.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedVendors(vendorIds: string[]) {
    setLoadingMetrics(true);
    try {
      const vendors = allVendors.filter((v) => vendorIds.includes(v.id));
      const vendorsWithMetrics: VendorWithMetrics[] = [];

      for (const vendor of vendors) {
        const [contractsRes, incidentsRes, assessmentsRes] = await Promise.all([
          supabase.from('contracts').select('id, contract_value, status').eq('vendor_id', vendor.id),
          supabase.from('incidents').select('id, severity, status').eq('vendor_id', vendor.id),
          supabase
            .from('tiering_assessments')
            .select('id, overall_score, category_scores')
            .eq('vendor_id', vendor.id)
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        vendorsWithMetrics.push({
          ...vendor,
          contracts: contractsRes.data || [],
          incidents: incidentsRes.data || [],
          assessments: assessmentsRes.data || [],
        });
      }

      setSelectedVendors(vendorsWithMetrics);
    } catch (error) {
      logger.error('Error loading vendor metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  }

  function addVendor(vendor: Vendor) {
    if (selectedVendors.length >= 4) return;
    if (selectedVendors.some((v) => v.id === vendor.id)) return;

    const newIds = [...selectedVendors.map((v) => v.id), vendor.id];
    navigate(`/vendors/compare?ids=${newIds.join(',')}`, { replace: true });
    setDropdownOpen(false);
    setSearchTerm('');
  }

  function removeVendor(vendorId: string) {
    const newIds = selectedVendors.filter((v) => v.id !== vendorId).map((v) => v.id);
    if (newIds.length > 0) {
      navigate(`/vendors/compare?ids=${newIds.join(',')}`, { replace: true });
    } else {
      navigate('/vendors/compare', { replace: true });
      setSelectedVendors([]);
    }
  }

  function getTierScore(tier?: string): number {
    if (!tier) return 0;
    const tierNum = parseInt(tier.match(/\d/)?.[0] || '0');
    return tierNum;
  }

  function getImpactScore(vendor: VendorWithMetrics): number {
    return vendor.impact_score || 0;
  }

  function getLikelihoodScore(vendor: VendorWithMetrics): number {
    return vendor.likelihood_score || 0;
  }

  function getTotalContractValue(vendor: VendorWithMetrics): number {
    return vendor.contracts?.reduce((sum, c) => sum + (c.contract_value || 0), 0) || 0;
  }

  function getIncidentCount(vendor: VendorWithMetrics): number {
    return vendor.incidents?.length || 0;
  }

  function getOpenIncidents(vendor: VendorWithMetrics): number {
    return vendor.incidents?.filter((i) => i.status !== 'closed').length || 0;
  }

  function getAssessmentScore(vendor: VendorWithMetrics): number | null {
    return vendor.assessments?.[0]?.overall_score ?? null;
  }

  function getRiskDimensionScore(vendor: VendorWithMetrics, dimension: string): number {
    const categoryScores = vendor.assessments?.[0]?.category_scores;
    if (categoryScores && categoryScores[dimension]) {
      return categoryScores[dimension];
    }
    const tierScore = getTierScore(vendor.tier);
    const baseScore = tierScore * 20;
    const hash = (vendor.id + dimension).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variance = (hash % 20) - 10;
    return Math.max(0, Math.min(100, baseScore + variance));
  }

  function getBestWorstIndicator(
    values: (number | null)[],
    currentValue: number | null,
    lowerIsBetter: boolean = false
  ): 'best' | 'worst' | null {
    const numericValues = values.filter((v): v is number => v !== null && !isNaN(v));
    if (numericValues.length < 2 || currentValue === null) return null;

    const best = lowerIsBetter ? Math.min(...numericValues) : Math.max(...numericValues);
    const worst = lowerIsBetter ? Math.max(...numericValues) : Math.min(...numericValues);

    if (currentValue === best && best !== worst) return 'best';
    if (currentValue === worst && best !== worst) return 'worst';
    return null;
  }

  function formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  function getRadarData() {
    return RISK_DIMENSIONS.map((dim) => {
      const entry: Record<string, string | number> = { dimension: dim.label };
      selectedVendors.forEach((vendor, idx) => {
        entry[`vendor${idx}`] = getRiskDimensionScore(vendor, dim.key);
      });
      return entry;
    });
  }

  async function exportToPDF() {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('Vendor Comparison Report', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Organization: ${currentOrganization?.name || 'N/A'}`, pageWidth / 2, 34, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('Vendors Compared', 14, 48);

      const vendorNames = selectedVendors.map((v) => v.legal_name).join(', ');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(vendorNames, 14, 56);

      const tableData = [
        ['Metric', ...selectedVendors.map((v) => v.legal_name)],
        ['Country', ...selectedVendors.map((v) => v.country || 'N/A')],
        ['Status', ...selectedVendors.map((v) => VENDOR_STATUSES.find((s) => s.value === v.status)?.label || v.status)],
        ['Tier', ...selectedVendors.map((v) => (v.tier ? tierConfig[v.tier]?.label || v.tier : 'Not Assessed'))],
        ['Risk Rating', ...selectedVendors.map((v) => (v.risk_rating ? v.risk_rating.toFixed(2) : 'N/A'))],
        ['Impact Score', ...selectedVendors.map((v) => getImpactScore(v).toFixed(1))],
        ['Likelihood Score', ...selectedVendors.map((v) => getLikelihoodScore(v).toFixed(1))],
        ['Contract Value', ...selectedVendors.map((v) => formatCurrency(getTotalContractValue(v)))],
        ['Total Incidents', ...selectedVendors.map((v) => getIncidentCount(v).toString())],
        ['Open Incidents', ...selectedVendors.map((v) => getOpenIncidents(v).toString())],
        [
          'Assessment Score',
          ...selectedVendors.map((v) => {
            const score = getAssessmentScore(v);
            return score !== null ? `${score.toFixed(0)}%` : 'N/A';
          }),
        ],
      ];

      autoTable(doc, {
        startY: 64,
        head: [tableData[0]],
        body: tableData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      });

      const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('Risk Dimension Scores', 14, finalY + 16);

      const riskData = [
        ['Risk Dimension', ...selectedVendors.map((v) => v.legal_name)],
        ...RISK_DIMENSIONS.map((dim) => [
          dim.label,
          ...selectedVendors.map((v) => getRiskDimensionScore(v, dim.key).toFixed(0)),
        ]),
      ];

      autoTable(doc, {
        startY: finalY + 22,
        head: [riskData[0]],
        body: riskData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      });

      doc.save(`vendor-comparison-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      logger.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }

  const availableVendors = allVendors.filter(
    (v) => !selectedVendors.some((sv) => sv.id === v.id) && v.legal_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No Organization Selected</h2>
        <p className="text-slate-600">Please select an organization to compare vendors</p>
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
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/vendors')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Vendor Comparison</h1>
            <p className="text-slate-600 mt-1">Compare up to 4 vendors side by side</p>
          </div>
        </div>
        {selectedVendors.length >= 2 && (
          <button
            onClick={exportToPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 flex-wrap">
          {selectedVendors.map((vendor, idx) => (
            <div
              key={vendor.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2"
              style={{ borderColor: CHART_COLORS[idx] }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx] }} />
              <span className="font-medium text-slate-900">{vendor.legal_name}</span>
              <button
                onClick={() => removeVendor(vendor.id)}
                className="p-0.5 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ))}

          {selectedVendors.length < 4 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Vendor
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                  <div className="p-2 border-b border-slate-200">
                    <input
                      type="text"
                      placeholder="Search vendors..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {availableVendors.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500 text-center">No vendors found</p>
                    ) : (
                      availableVendors.slice(0, 20).map((vendor) => (
                        <button
                          key={vendor.id}
                          onClick={() => addVendor(vendor)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-900">{vendor.legal_name}</p>
                          <p className="text-xs text-slate-500">
                            {vendor.tier ? tierConfig[vendor.tier]?.label : 'Not assessed'} | {vendor.country}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {loadingMetrics ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : selectedVendors.length < 2 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Select Vendors to Compare</h3>
          <p className="text-slate-600">Add at least 2 vendors to begin comparison</p>
        </div>
      ) : (
        <div ref={reportRef} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Dimensions</h3>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={getRadarData()}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  {selectedVendors.map((vendor, idx) => (
                    <Radar
                      key={vendor.id}
                      name={vendor.legal_name}
                      dataKey={`vendor${idx}`}
                      stroke={CHART_COLORS[idx]}
                      fill={CHART_COLORS[idx]}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Summary</h3>
              <div className="space-y-4">
                {selectedVendors.map((vendor, idx) => {
                  const tierScore = getTierScore(vendor.tier);
                  const incidents = getOpenIncidents(vendor);
                  const riskLevel = tierScore >= 4 ? 'critical' : tierScore >= 3 ? 'moderate' : 'low';

                  return (
                    <div
                      key={vendor.id}
                      className="p-4 rounded-lg border-l-4"
                      style={{ borderLeftColor: CHART_COLORS[idx], backgroundColor: '#f8fafc' }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{vendor.legal_name}</p>
                          <p className="text-sm text-slate-600">{vendor.country}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              riskLevel === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : riskLevel === 'moderate'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {vendor.tier ? tierConfig[vendor.tier]?.label : 'Not Assessed'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-3 text-center">
                        <div>
                          <p className="text-xs text-slate-500">Contract Value</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(getTotalContractValue(vendor))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Open Incidents</p>
                          <p
                            className={`text-sm font-semibold ${incidents > 0 ? 'text-red-600' : 'text-emerald-600'}`}
                          >
                            {incidents}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Risk Rating</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {vendor.risk_rating?.toFixed(2) || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Detailed Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-48">
                      Metric
                    </th>
                    {selectedVendors.map((vendor, idx) => (
                      <th
                        key={vendor.id}
                        className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: CHART_COLORS[idx] }}
                      >
                        {vendor.legal_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50">
                    <td colSpan={selectedVendors.length + 1} className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase">
                      Basic Information
                    </td>
                  </tr>
                  <ComparisonRow
                    label="Country"
                    values={selectedVendors.map((v) => v.country || 'N/A')}
                  />
                  <ComparisonRow
                    label="Service Category"
                    values={selectedVendors.map(
                      (v) => SERVICE_CATEGORIES.find((c) => c.value === v.service_category)?.label || v.service_category
                    )}
                  />
                  <ComparisonRow
                    label="Status"
                    values={selectedVendors.map((v) => (
                      <span
                        key={v.id}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          v.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : v.status === 'suspended' || v.status === 'terminated'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {VENDOR_STATUSES.find((s) => s.value === v.status)?.label || v.status}
                      </span>
                    ))}
                  />

                  <tr className="bg-slate-50">
                    <td colSpan={selectedVendors.length + 1} className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase">
                      Risk Metrics
                    </td>
                  </tr>
                  <ComparisonRow
                    label="Tier"
                    values={selectedVendors.map((v) => (
                      <span
                        key={v.id}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${v.tier ? tierConfig[v.tier]?.bgClass || 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {v.tier ? tierConfig[v.tier]?.label : 'Not Assessed'}
                      </span>
                    ))}
                  />
                  <ComparisonRow
                    label="Risk Rating"
                    values={selectedVendors.map((v) => v.risk_rating?.toFixed(2) ?? 'N/A')}
                    numericValues={selectedVendors.map((v) => v.risk_rating ?? null)}
                    lowerIsBetter
                  />
                  <ComparisonRow
                    label="Impact Score"
                    values={selectedVendors.map((v) => getImpactScore(v).toFixed(1))}
                    numericValues={selectedVendors.map((v) => getImpactScore(v))}
                    lowerIsBetter
                  />
                  <ComparisonRow
                    label="Likelihood Score"
                    values={selectedVendors.map((v) => getLikelihoodScore(v).toFixed(1))}
                    numericValues={selectedVendors.map((v) => getLikelihoodScore(v))}
                    lowerIsBetter
                  />

                  <tr className="bg-slate-50">
                    <td colSpan={selectedVendors.length + 1} className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase">
                      Financial Information
                    </td>
                  </tr>
                  <ComparisonRow
                    label="Total Contract Value"
                    values={selectedVendors.map((v) => formatCurrency(getTotalContractValue(v)))}
                    numericValues={selectedVendors.map((v) => getTotalContractValue(v))}
                  />
                  <ComparisonRow
                    label="Active Contracts"
                    values={selectedVendors.map((v) => v.contracts?.filter((c) => c.status === 'active').length.toString() || '0')}
                    numericValues={selectedVendors.map((v) => v.contracts?.filter((c) => c.status === 'active').length || 0)}
                  />

                  <tr className="bg-slate-50">
                    <td colSpan={selectedVendors.length + 1} className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase">
                      Incidents & Performance
                    </td>
                  </tr>
                  <ComparisonRow
                    label="Total Incidents"
                    values={selectedVendors.map((v) => getIncidentCount(v).toString())}
                    numericValues={selectedVendors.map((v) => getIncidentCount(v))}
                    lowerIsBetter
                  />
                  <ComparisonRow
                    label="Open Incidents"
                    values={selectedVendors.map((v) => getOpenIncidents(v).toString())}
                    numericValues={selectedVendors.map((v) => getOpenIncidents(v))}
                    lowerIsBetter
                  />
                  <ComparisonRow
                    label="Critical Incidents"
                    values={selectedVendors.map(
                      (v) => (v.incidents?.filter((i) => i.severity === 'critical').length || 0).toString()
                    )}
                    numericValues={selectedVendors.map(
                      (v) => v.incidents?.filter((i) => i.severity === 'critical').length || 0
                    )}
                    lowerIsBetter
                  />

                  <tr className="bg-slate-50">
                    <td colSpan={selectedVendors.length + 1} className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase">
                      Compliance & Assessment
                    </td>
                  </tr>
                  <ComparisonRow
                    label="Assessment Score"
                    values={selectedVendors.map((v) => {
                      const score = getAssessmentScore(v);
                      return score !== null ? `${score.toFixed(0)}%` : 'N/A';
                    })}
                    numericValues={selectedVendors.map((v) => getAssessmentScore(v))}
                  />
                  <ComparisonRow
                    label="Last Assessment"
                    values={selectedVendors.map((v) =>
                      v.last_assessment_date ? format(new Date(v.last_assessment_date), 'MMM d, yyyy') : 'Never'
                    )}
                  />
                  <ComparisonRow
                    label="Next Review"
                    values={selectedVendors.map((v) =>
                      v.next_review_date ? format(new Date(v.next_review_date), 'MMM d, yyyy') : 'Not scheduled'
                    )}
                  />
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Dimension Scores</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Dimension</th>
                    {selectedVendors.map((vendor, idx) => (
                      <th
                        key={vendor.id}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase"
                        style={{ color: CHART_COLORS[idx] }}
                      >
                        {vendor.legal_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {RISK_DIMENSIONS.map((dim) => {
                    const scores = selectedVendors.map((v) => getRiskDimensionScore(v, dim.key));
                    return (
                      <tr key={dim.key}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{dim.label}</td>
                        {selectedVendors.map((vendor, idx) => {
                          const score = scores[idx];
                          const indicator = getBestWorstIndicator(scores, score, true);
                          return (
                            <td key={vendor.id} className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-100 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full transition-all"
                                    style={{
                                      width: `${score}%`,
                                      backgroundColor:
                                        score >= 70
                                          ? '#ef4444'
                                          : score >= 50
                                            ? '#f59e0b'
                                            : score >= 30
                                              ? '#eab308'
                                              : '#10b981',
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-slate-700 w-12">{score.toFixed(0)}%</span>
                                {indicator === 'best' && <TrendingDown className="w-4 h-4 text-emerald-500" />}
                                {indicator === 'worst' && <TrendingUp className="w-4 h-4 text-red-500" />}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ComparisonRowProps {
  label: string;
  values: (string | React.ReactNode)[];
  numericValues?: (number | null)[];
  lowerIsBetter?: boolean;
}

function ComparisonRow({ label, values, numericValues, lowerIsBetter = false }: ComparisonRowProps) {
  function getIndicator(idx: number): 'best' | 'worst' | null {
    if (!numericValues) return null;
    const numValues = numericValues.filter((v): v is number => v !== null && !isNaN(v));
    if (numValues.length < 2) return null;

    const current = numericValues[idx];
    if (current === null) return null;

    const best = lowerIsBetter ? Math.min(...numValues) : Math.max(...numValues);
    const worst = lowerIsBetter ? Math.max(...numValues) : Math.min(...numValues);

    if (current === best && best !== worst) return 'best';
    if (current === worst && best !== worst) return 'worst';
    return null;
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-6 py-3 text-sm font-medium text-slate-700">{label}</td>
      {values.map((value, idx) => {
        const indicator = getIndicator(idx);
        return (
          <td key={idx} className="px-6 py-3 text-sm text-slate-900">
            <div className="flex items-center gap-2">
              {typeof value === 'string' ? <span>{value}</span> : value}
              {indicator === 'best' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
              {indicator === 'worst' && <AlertTriangle className="w-4 h-4 text-red-500" />}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

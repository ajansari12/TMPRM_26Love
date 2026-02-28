import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { exportToPDF, exportToPowerPoint, exportToExcel, formatCurrency, formatPercentage } from '../lib/exportUtils';
import { format, subMonths, startOfQuarter, endOfQuarter, startOfYear } from 'date-fns';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Shield,
  Building2,
  FileWarning,
  Activity,
  Loader2,
  Printer,
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
} from 'recharts';
import { logger } from '../lib/logger';

type PeriodType = 'q1' | 'q2' | 'q3' | 'q4' | 'ytd' | 'custom';

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

export default function BoardReports() {
  const { currentOrganization } = useOrganization();
  const [vendors, setVendors] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [dueDiligence, setDueDiligence] = useState<any[]>([]);
  const [kriThresholds, setKriThresholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState<PeriodType>('ytd');
  const [customStart, setCustomStart] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

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

      const [incidentsRes, contractsRes, assessmentsRes, ddRes, kriRes] = await Promise.all([
        hasVendors
          ? supabase.from('incidents').select('*').in('vendor_id', vendorIds)
          : emptyRes,
        hasVendors
          ? supabase.from('contracts').select('*').in('vendor_id', vendorIds)
          : emptyRes,
        hasVendors
          ? supabase.from('tiering_assessments').select('*').in('vendor_id', vendorIds)
          : emptyRes,
        hasVendors
          ? supabase.from('due_diligence').select('*').in('vendor_id', vendorIds)
          : emptyRes,
        supabase.from('kri_thresholds').select('*').order('display_order'),
      ]);

      setVendors(vendorList);
      setIncidents(incidentsRes.data || []);
      setContracts(contractsRes.data || []);
      setAssessments(assessmentsRes.data || []);
      setDueDiligence(ddRes.data || []);
      setKriThresholds(kriRes.data || []);
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const dateRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    switch (period) {
      case 'q1':
        return { start: new Date(year, 0, 1), end: new Date(year, 2, 31) };
      case 'q2':
        return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) };
      case 'q3':
        return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) };
      case 'q4':
        return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) };
      case 'ytd':
        return { start: startOfYear(now), end: now };
      case 'custom':
        return { start: new Date(customStart), end: new Date(customEnd) };
      default:
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
    }
  }, [period, customStart, customEnd]);

  const periodLabel = useMemo(() => {
    if (period === 'ytd') return `Year to Date ${dateRange.start.getFullYear()}`;
    if (period === 'custom') return `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    return `${period.toUpperCase()} ${dateRange.start.getFullYear()}`;
  }, [period, dateRange]);

  const reportData = useMemo(() => {
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter((v) => v.status === 'active').length;

    const tierDistribution = Object.entries(TIER_LABELS).map(([key, label]) => ({
      tier: label,
      tierKey: key,
      count: vendors.filter((v) => v.tier === key).length,
      percentage: totalVendors > 0 ? ((vendors.filter((v) => v.tier === key).length / totalVendors) * 100) : 0,
    }));

    const criticalVendors = vendors.filter((v) => v.tier === 'tier_5_critical' || v.is_critical);
    const criticalConcentration = totalVendors > 0 ? (criticalVendors.length / totalVendors) * 100 : 0;

    const totalContractValue = contracts.reduce((sum, c) => sum + (c.annual_value_cad || 0), 0);
    const criticalContractValue = contracts
      .filter((c) => {
        const vendor = vendors.find((v) => v.id === c.vendor_id);
        return vendor?.tier === 'tier_5_critical';
      })
      .reduce((sum, c) => sum + (c.annual_value_cad || 0), 0);

    const now = new Date();
    const expiringContracts90 = contracts.filter((c) => {
      if (!c.expiry_date) return false;
      const expiry = new Date(c.expiry_date);
      const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 90;
    });

    const openIncidents = incidents.filter((i) => !['resolved', 'closed'].includes(i.status));
    const criticalIncidents = incidents.filter((i) => i.severity === 'critical');
    const osfiNotifiableIncidents = incidents.filter((i) => i.osfi_notifiable);

    const incidentsByType = ['cyber_security', 'data_breach', 'service_outage', 'compliance', 'financial', 'operational'].map((type) => ({
      type: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      count: incidents.filter((i) => i.incident_type === type).length,
    }));

    const incidentsBySeverity = ['critical', 'high', 'medium', 'low'].map((sev) => ({
      severity: sev.charAt(0).toUpperCase() + sev.slice(1),
      count: incidents.filter((i) => i.severity === sev).length,
    }));

    const completedAssessments = assessments.filter((a) => a.status === 'approved').length;
    const pendingAssessments = assessments.filter((a) => ['draft', 'in_progress', 'pending_review'].includes(a.status)).length;
    const assessmentCompletionRate = (completedAssessments + pendingAssessments) > 0
      ? (completedAssessments / (completedAssessments + pendingAssessments)) * 100
      : 100;

    const completedDD = dueDiligence.filter((d) => d.status === 'completed' || d.final_rating).length;
    const ddCompletionRate = dueDiligence.length > 0 ? (completedDD / dueDiligence.length) * 100 : 100;

    const kriValues = [
      { code: 'KRI001', name: 'Critical Vendor Concentration', value: criticalConcentration, threshold: kriThresholds.find((k) => k.kri_code === 'KRI001') },
      { code: 'KRI002', name: 'Assessment Completion', value: assessmentCompletionRate, threshold: kriThresholds.find((k) => k.kri_code === 'KRI002') },
      { code: 'KRI003', name: 'Due Diligence Compliance', value: ddCompletionRate, threshold: kriThresholds.find((k) => k.kri_code === 'KRI003') },
      { code: 'KRI004', name: 'Contracts Expiring (90d)', value: expiringContracts90.length, threshold: kriThresholds.find((k) => k.kri_code === 'KRI004') },
      { code: 'KRI005', name: 'Open Incidents', value: openIncidents.length, threshold: kriThresholds.find((k) => k.kri_code === 'KRI005') },
    ];

    const getKRIStatus = (value: number, threshold: any) => {
      if (!threshold) return 'green';
      if (threshold.is_higher_better) {
        if (value >= (threshold.green_min || 0)) return 'green';
        if (value >= (threshold.amber_min || 0)) return 'amber';
        return 'red';
      } else {
        if (value <= (threshold.green_max || 100)) return 'green';
        if (value <= (threshold.amber_max || 100)) return 'amber';
        return 'red';
      }
    };

    const actionItems = [
      ...(criticalConcentration > 20 ? [`Critical vendor concentration at ${criticalConcentration.toFixed(1)}% exceeds 20% threshold`] : []),
      ...(expiringContracts90.length > 0 ? [`${expiringContracts90.length} contracts expiring within 90 days require renewal attention`] : []),
      ...(criticalIncidents.length > 0 ? [`${criticalIncidents.length} critical incidents require immediate escalation`] : []),
      ...(assessmentCompletionRate < 80 ? [`Assessment completion rate at ${assessmentCompletionRate.toFixed(1)}% - below 80% target`] : []),
      ...(ddCompletionRate < 80 ? [`Due diligence completion at ${ddCompletionRate.toFixed(1)}% - review outstanding items`] : []),
    ];

    return {
      totalVendors,
      activeVendors,
      tierDistribution,
      criticalVendors,
      criticalConcentration,
      totalContractValue,
      criticalContractValue,
      expiringContracts90,
      openIncidents,
      criticalIncidents,
      osfiNotifiableIncidents,
      incidentsByType,
      incidentsBySeverity,
      completedAssessments,
      pendingAssessments,
      assessmentCompletionRate,
      completedDD,
      ddCompletionRate,
      kriValues: kriValues.map((k) => ({ ...k, status: getKRIStatus(k.value, k.threshold) })),
      actionItems,
    };
  }, [vendors, incidents, contracts, assessments, dueDiligence, kriThresholds]);

  async function handleExportPDF() {
    setExporting(true);
    try {
      await exportToPDF({
        title: 'TPRM Board Report',
        subtitle: `Third-Party Risk Management Executive Summary - ${periodLabel}`,
        date: format(new Date(), 'MMMM d, yyyy'),
        sections: [
          {
            title: 'Executive Summary',
            type: 'kpi',
            kpiData: [
              { label: 'Total Vendors', value: reportData.totalVendors },
              { label: 'Critical Vendors', value: reportData.criticalVendors.length, status: reportData.criticalConcentration > 20 ? 'danger' : 'success' },
              { label: 'Open Incidents', value: reportData.openIncidents.length, status: reportData.openIncidents.length > 5 ? 'warning' : 'success' },
              { label: 'Expiring Contracts', value: reportData.expiringContracts90.length, status: reportData.expiringContracts90.length > 10 ? 'warning' : 'success' },
            ],
          },
          {
            title: 'Vendor Tier Distribution',
            type: 'table',
            tableData: {
              headers: ['Risk Tier', 'Count', 'Percentage'],
              rows: reportData.tierDistribution.map((t) => [t.tier, t.count, `${t.percentage.toFixed(1)}%`]),
            },
          },
          {
            title: 'Key Risk Indicators',
            type: 'table',
            tableData: {
              headers: ['Indicator', 'Current Value', 'Status'],
              rows: reportData.kriValues.map((k) => [
                k.name,
                k.threshold?.threshold_type === 'percentage' ? `${k.value.toFixed(1)}%` : k.value,
                k.status.toUpperCase(),
              ]),
            },
          },
          {
            title: 'Incidents by Severity',
            type: 'table',
            tableData: {
              headers: ['Severity', 'Count'],
              rows: reportData.incidentsBySeverity.map((i) => [i.severity, i.count]),
            },
          },
          {
            title: 'Action Items',
            type: 'text',
            content: reportData.actionItems.length > 0
              ? reportData.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')
              : 'No immediate action items identified.',
          },
        ],
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPPTX() {
    setExporting(true);
    try {
      await exportToPowerPoint({
        title: 'TPRM Board Report',
        subtitle: `Third-Party Risk Management Executive Summary`,
        author: 'TPRM System',
        date: periodLabel,
        sections: [
          {
            title: 'Executive Summary',
            type: 'kpi',
            kpiData: [
              { label: 'Total Vendors', value: reportData.totalVendors },
              { label: 'Critical Vendors', value: reportData.criticalVendors.length, status: reportData.criticalConcentration > 20 ? 'danger' : 'success' },
              { label: 'Open Incidents', value: reportData.openIncidents.length, status: reportData.openIncidents.length > 5 ? 'warning' : 'success' },
              { label: 'Expiring (90d)', value: reportData.expiringContracts90.length },
            ],
          },
          {
            title: 'Vendor Tier Distribution',
            type: 'chart',
            chartData: {
              labels: reportData.tierDistribution.map((t) => t.tier.replace('Tier ', 'T')),
              values: reportData.tierDistribution.map((t) => t.count),
              colors: Object.values(TIER_COLORS).map((c) => c.replace('#', '')),
            },
          },
          {
            title: 'Key Risk Indicators',
            type: 'table',
            tableData: {
              headers: ['Indicator', 'Value', 'Status'],
              rows: reportData.kriValues.map((k) => [
                k.name,
                k.threshold?.threshold_type === 'percentage' ? `${k.value.toFixed(1)}%` : String(k.value),
                k.status.toUpperCase(),
              ]),
            },
          },
          {
            title: 'Incident Summary',
            type: 'table',
            tableData: {
              headers: ['Severity', 'Count', 'Percentage'],
              rows: reportData.incidentsBySeverity.map((i) => {
                const total = incidents.length || 1;
                return [i.severity, String(i.count), `${((i.count / total) * 100).toFixed(1)}%`];
              }),
            },
          },
          {
            title: 'Required Actions',
            type: 'text',
            content: reportData.actionItems.length > 0
              ? reportData.actionItems.join('\n\n')
              : 'No immediate action items identified. All KRIs within acceptable thresholds.',
          },
        ],
      });
    } finally {
      setExporting(false);
    }
  }

  function handleExportExcel() {
    const data = vendors.map((v) => ({
      vendor_id: v.vendor_id,
      legal_name: v.legal_name,
      status: v.status,
      tier: TIER_LABELS[v.tier] || v.tier || 'Not Assessed',
      service_category: v.service_category,
      is_critical: v.is_critical ? 'Yes' : 'No',
      contract_value: v.contract_value_cad || 0,
      lifecycle_stage: v.lifecycle_stage,
    }));

    exportToExcel(data, `vendor_inventory_${format(new Date(), 'yyyy-MM-dd')}`, [
      { key: 'vendor_id', label: 'Vendor ID' },
      { key: 'legal_name', label: 'Vendor Name' },
      { key: 'status', label: 'Status' },
      { key: 'tier', label: 'Risk Tier' },
      { key: 'service_category', label: 'Service Category' },
      { key: 'is_critical', label: 'Critical' },
      { key: 'contract_value', label: 'Contract Value (CAD)' },
      { key: 'lifecycle_stage', label: 'Lifecycle Stage' },
    ]);
  }

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view board reports</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Board Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Executive summary and risk metrics for board presentation
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
            onClick={handleExportPPTX}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400"
          >
            <Download className="w-4 h-4" />
            Export PPTX
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Report Period:</span>
          </div>
          <div className="flex gap-2">
            {(['q1', 'q2', 'q3', 'q4', 'ytd'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  period === p
                    ? 'bg-slate-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                period === 'custom'
                  ? 'bg-slate-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Custom
            </button>
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          )}
          <div className="ml-auto text-sm text-gray-500">{periodLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vendors</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{reportData.totalVendors}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.activeVendors} active</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Vendors</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{reportData.criticalVendors.length}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.criticalConcentration.toFixed(1)}% concentration</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Incidents</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{reportData.openIncidents.length}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.criticalIncidents.length} critical</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contract Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(reportData.totalContractValue)}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(reportData.criticalContractValue)} critical</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-full">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendor Tier Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={reportData.tierDistribution.filter((t) => t.count > 0)}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey="tier"
                label={({ tier, percentage }) => `${tier.replace('Tier ', 'T')}: ${percentage.toFixed(0)}%`}
                labelLine={false}
              >
                {reportData.tierDistribution.map((entry) => (
                  <Cell key={entry.tierKey} fill={TIER_COLORS[entry.tierKey as keyof typeof TIER_COLORS] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'Vendors']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {reportData.tierDistribution.map((tier) => (
              <div key={tier.tierKey} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[tier.tierKey as keyof typeof TIER_COLORS] || '#94a3b8' }}
                />
                <span className="text-gray-600">{tier.tier}</span>
                <span className="font-medium ml-auto">{tier.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Incidents by Type</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reportData.incidentsByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="type" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Key Risk Indicators</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportData.kriValues.map((kri) => (
              <div
                key={kri.code}
                className={`p-4 rounded-lg border-2 ${
                  kri.status === 'green'
                    ? 'bg-emerald-50 border-emerald-200'
                    : kri.status === 'amber'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{kri.name}</span>
                  {kri.status === 'green' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : kri.status === 'amber' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      kri.status === 'green'
                        ? 'text-emerald-700'
                        : kri.status === 'amber'
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {kri.threshold?.threshold_type === 'percentage'
                      ? `${kri.value.toFixed(1)}%`
                      : kri.value}
                  </span>
                  <span
                    className={`text-sm font-medium uppercase ${
                      kri.status === 'green'
                        ? 'text-emerald-600'
                        : kri.status === 'amber'
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}
                  >
                    {kri.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Contract Status</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-700">Total Contracts</span>
                </div>
                <span className="text-lg font-semibold">{contracts.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileWarning className="w-5 h-5 text-amber-600" />
                  <span className="text-sm text-gray-700">Expiring in 90 days</span>
                </div>
                <span className="text-lg font-semibold text-amber-700">{reportData.expiringContracts90.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-700">Assessment Completion</span>
                </div>
                <span className="text-lg font-semibold text-blue-700">{reportData.assessmentCompletionRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm text-gray-700">Due Diligence Complete</span>
                </div>
                <span className="text-lg font-semibold text-emerald-700">{reportData.ddCompletionRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Action Items</h2>
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              {reportData.actionItems.length} items
            </span>
          </div>
          <div className="p-6">
            {reportData.actionItems.length > 0 ? (
              <ul className="space-y-3">
                {reportData.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-red-700">{index + 1}</span>
                    </div>
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-gray-500">No immediate action items</p>
                <p className="text-sm text-gray-400">All KRIs within acceptable thresholds</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {reportData.osfiNotifiableIncidents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">OSFI Notification Required</h2>
          </div>
          <p className="text-sm text-red-700 mb-4">
            {reportData.osfiNotifiableIncidents.length} incident(s) require or have been reported to OSFI
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-red-200">
                  <th className="text-left py-2 px-3 font-medium text-red-900">Incident ID</th>
                  <th className="text-left py-2 px-3 font-medium text-red-900">Title</th>
                  <th className="text-left py-2 px-3 font-medium text-red-900">Severity</th>
                  <th className="text-left py-2 px-3 font-medium text-red-900">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-red-900">OSFI Notified</th>
                </tr>
              </thead>
              <tbody>
                {reportData.osfiNotifiableIncidents.map((incident) => (
                  <tr key={incident.id} className="border-b border-red-100">
                    <td className="py-2 px-3 font-medium">{incident.incident_id}</td>
                    <td className="py-2 px-3">{incident.title}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        incident.severity === 'critical' ? 'bg-red-200 text-red-800' :
                        incident.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                        'bg-yellow-200 text-yellow-800'
                      }`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3">{incident.status}</td>
                    <td className="py-2 px-3">
                      {incident.osfi_notified ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Yes
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

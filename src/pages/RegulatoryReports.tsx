import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { exportToPDF, exportToExcel, formatCurrency, formatPercentage } from '../lib/exportUtils';
import { format, subMonths, startOfYear, endOfYear, parseISO } from 'date-fns';
import {
  FileText,
  Download,
  Calendar,
  Building2,
  Eye,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Target,
  Users,
  Loader2,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

type ReportType = 'osfi-annual' | 'material-inventory' | 'concentration' | 'incident-summary';

interface ReportConfig {
  id: ReportType;
  name: string;
  description: string;
  icon: React.ElementType;
}

const REPORT_TYPES: ReportConfig[] = [
  {
    id: 'osfi-annual',
    name: 'OSFI Annual TPRM Report',
    description: 'Comprehensive annual report on third-party risk management for OSFI regulatory submission',
    icon: Shield,
  },
  {
    id: 'material-inventory',
    name: 'Material Arrangement Inventory',
    description: 'Detailed inventory of all material third-party arrangements as required by OSFI B-10',
    icon: Building2,
  },
  {
    id: 'concentration',
    name: 'Concentration Risk Report',
    description: 'Analysis of concentration risks across third-party portfolio by service, geography, and vendor',
    icon: Target,
  },
  {
    id: 'incident-summary',
    name: 'Incident Summary Report',
    description: 'Summary of third-party related incidents, root causes, and remediation status',
    icon: AlertTriangle,
  },
];

const TIER_LABELS: Record<string, string> = {
  tier_5_critical: 'Tier 5 - Critical',
  tier_4_high: 'Tier 4 - High',
  tier_3_moderate: 'Tier 3 - Moderate',
  tier_2_low: 'Tier 2 - Low',
  tier_1_informational: 'Tier 1 - Informational',
};

export default function RegulatoryReports() {
  const { currentOrganization } = useOrganization();
  const [selectedReport, setSelectedReport] = useState<ReportType>('osfi-annual');
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [vendors, setVendors] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [dueDiligence, setDueDiligence] = useState<any[]>([]);
  const [kriThresholds, setKriThresholds] = useState<any[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<any[]>([]);
  const [riskExceptions, setRiskExceptions] = useState<any[]>([]);
  const [fourthParties, setFourthParties] = useState<any[]>([]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchAllData();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchAllData = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);

      const vendorsRes = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      const vendorList = vendorsRes.data || [];
      const vendorIds = vendorList.map((v) => v.id);

      const emptyRes = { data: [] as any[] };
      const hasVendors = vendorIds.length > 0;

      const [
        incidentsRes,
        contractsRes,
        assessmentsRes,
        ddRes,
        kriRes,
        complianceRes,
        exceptionsRes,
        fourthPartiesRes,
      ] = await Promise.all([
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
        supabase.from('osfi_b10_compliance_status').select('*').eq('organization_id', currentOrganization.id),
        supabase.from('risk_exceptions').select('*').eq('organization_id', currentOrganization.id),
        supabase.from('fourth_parties').select('*').eq('organization_id', currentOrganization.id),
      ]);

      setVendors(vendorList);
      setIncidents(incidentsRes.data || []);
      setContracts(contractsRes.data || []);
      setAssessments(assessmentsRes.data || []);
      setDueDiligence(ddRes.data || []);
      setKriThresholds(kriRes.data || []);
      setComplianceStatus(complianceRes.data || []);
      setRiskExceptions(exceptionsRes.data || []);
      setFourthParties(fourthPartiesRes.data || []);
    } catch (error) {
      logger.error('Error fetching data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const filterByDate = (items: any[], dateField: string) =>
      items.filter((item) => {
        if (!item[dateField]) return true;
        const itemDate = parseISO(item[dateField]);
        return itemDate >= start && itemDate <= end;
      });

    return {
      vendors: vendors,
      incidents: filterByDate(incidents, 'incident_date'),
      contracts: contracts,
      assessments: filterByDate(assessments, 'assessment_date'),
      exceptions: riskExceptions,
    };
  }, [vendors, incidents, contracts, assessments, riskExceptions, startDate, endDate]);

  const stats = useMemo(() => {
    const v = filteredData.vendors;
    const materialVendors = v.filter(
      (vendor) => vendor.tier === 'tier_5_critical' || vendor.tier === 'tier_4_high' || vendor.is_critical
    );

    const tierDistribution = Object.entries(
      v.reduce((acc: Record<string, number>, vendor) => {
        const tier = vendor.tier || 'unassessed';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {})
    ).map(([tier, count]) => ({ tier, count, label: TIER_LABELS[tier] || 'Unassessed' }));

    const categoryDistribution = Object.entries(
      v.reduce((acc: Record<string, number>, vendor) => {
        const cat = vendor.service_category || 'Other';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {})
    ).map(([category, count]) => ({ category, count }));

    const countryDistribution = Object.entries(
      v.reduce((acc: Record<string, number>, vendor) => {
        const country = vendor.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {})
    ).map(([country, count]) => ({ country, count }));

    const incidentsBySeverity = Object.entries(
      filteredData.incidents.reduce((acc: Record<string, number>, inc) => {
        const sev = inc.severity || 'unknown';
        acc[sev] = (acc[sev] || 0) + 1;
        return acc;
      }, {})
    ).map(([severity, count]) => ({ severity, count }));

    const totalContractValue = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);

    const complianceScore = complianceStatus.length > 0
      ? (complianceStatus.filter((s) => s.status === 'compliant').length / complianceStatus.length) * 100
      : 0;

    const activeExceptions = riskExceptions.filter((e) => e.status === 'approved').length;
    const pendingExceptions = riskExceptions.filter((e) => e.status === 'pending').length;

    return {
      totalVendors: v.length,
      materialVendors: materialVendors.length,
      activeVendors: v.filter((vendor) => vendor.status === 'active').length,
      totalIncidents: filteredData.incidents.length,
      criticalIncidents: filteredData.incidents.filter((i) => i.severity === 'critical' || i.severity === 'high').length,
      totalContracts: contracts.length,
      totalContractValue,
      complianceScore,
      activeExceptions,
      pendingExceptions,
      fourthPartyCount: fourthParties.length,
      tierDistribution,
      categoryDistribution,
      countryDistribution,
      incidentsBySeverity,
    };
  }, [filteredData, contracts, complianceStatus, riskExceptions, fourthParties]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const config = generateReportConfig();
      await exportToPDF(config);
      toast.success('PDF exported successfully');
    } catch (error) {
      logger.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    setExporting(true);
    try {
      const data = generateExcelData();
      exportToExcel(data.rows, data.filename, data.headers);
      toast.success('Excel file exported successfully');
    } catch (error) {
      logger.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const generateReportConfig = () => {
    const reportDate = format(new Date(), 'yyyy-MM-dd');
    const dateRange = `${format(parseISO(startDate), 'MMM d, yyyy')} - ${format(parseISO(endDate), 'MMM d, yyyy')}`;

    switch (selectedReport) {
      case 'osfi-annual':
        return {
          title: 'OSFI Annual TPRM Report',
          subtitle: `${currentOrganization?.name} - ${dateRange}`,
          author: currentOrganization?.name,
          date: reportDate,
          sections: [
            {
              title: 'Executive Summary',
              type: 'text' as const,
              content: `This report provides a comprehensive overview of ${currentOrganization?.name}'s Third-Party Risk Management (TPRM) program for the reporting period ${dateRange}. The organization maintains ${stats.totalVendors} third-party relationships, of which ${stats.materialVendors} are classified as material arrangements requiring enhanced oversight under OSFI B-10 guidelines. During this period, ${stats.totalIncidents} incidents were recorded with ${stats.criticalIncidents} classified as high severity. The overall OSFI B-10 compliance score stands at ${stats.complianceScore.toFixed(1)}%.`,
            },
            {
              title: 'Key Performance Indicators',
              type: 'kpi' as const,
              kpiData: [
                { label: 'Total Third Parties', value: stats.totalVendors },
                { label: 'Material Arrangements', value: stats.materialVendors, status: stats.materialVendors > 10 ? 'warning' : 'success' },
                { label: 'Active Incidents', value: stats.criticalIncidents, status: stats.criticalIncidents > 0 ? 'danger' : 'success' },
                { label: 'Compliance Score', value: `${stats.complianceScore.toFixed(0)}%`, status: stats.complianceScore >= 80 ? 'success' : stats.complianceScore >= 60 ? 'warning' : 'danger' },
              ],
            },
            {
              title: 'Third-Party Inventory Summary',
              type: 'table' as const,
              tableData: {
                headers: ['Risk Tier', 'Count', 'Percentage'],
                rows: stats.tierDistribution.map((t) => [
                  t.label,
                  t.count,
                  `${((t.count / stats.totalVendors) * 100).toFixed(1)}%`,
                ]),
              },
            },
            {
              title: 'Material Arrangements Detail',
              type: 'table' as const,
              tableData: {
                headers: ['Vendor Name', 'Service Category', 'Tier', 'Status', 'Contract Value'],
                rows: filteredData.vendors
                  .filter((v) => v.tier === 'tier_5_critical' || v.tier === 'tier_4_high' || v.is_critical)
                  .slice(0, 20)
                  .map((v) => [
                    v.legal_name,
                    v.service_category || 'N/A',
                    TIER_LABELS[v.tier] || 'Unassessed',
                    v.status || 'N/A',
                    formatCurrency(v.contract_value || 0),
                  ]),
              },
            },
            {
              title: 'Risk Assessment Summary',
              type: 'text' as const,
              content: `During the reporting period, ${filteredData.assessments.length} tiering assessments were conducted. The risk distribution shows ${stats.tierDistribution.find((t) => t.tier === 'tier_5_critical')?.count || 0} critical tier vendors, ${stats.tierDistribution.find((t) => t.tier === 'tier_4_high')?.count || 0} high-risk vendors, and ${stats.tierDistribution.find((t) => t.tier === 'tier_3_moderate')?.count || 0} moderate-risk vendors. ${stats.activeExceptions} risk exceptions are currently active, with ${stats.pendingExceptions} pending approval.`,
            },
            {
              title: 'Incident Summary',
              type: 'table' as const,
              tableData: {
                headers: ['Severity', 'Count', 'Percentage of Total'],
                rows: stats.incidentsBySeverity.map((i) => [
                  i.severity.charAt(0).toUpperCase() + i.severity.slice(1),
                  i.count,
                  `${((i.count / Math.max(stats.totalIncidents, 1)) * 100).toFixed(1)}%`,
                ]),
              },
            },
            {
              title: 'Concentration Analysis',
              type: 'table' as const,
              tableData: {
                headers: ['Service Category', 'Vendor Count', 'Concentration %'],
                rows: stats.categoryDistribution.slice(0, 10).map((c) => [
                  c.category,
                  c.count,
                  `${((c.count / stats.totalVendors) * 100).toFixed(1)}%`,
                ]),
              },
            },
            {
              title: 'Geographic Distribution',
              type: 'table' as const,
              tableData: {
                headers: ['Country', 'Vendor Count', 'Concentration %'],
                rows: stats.countryDistribution.slice(0, 10).map((c) => [
                  c.country,
                  c.count,
                  `${((c.count / stats.totalVendors) * 100).toFixed(1)}%`,
                ]),
              },
            },
            {
              title: 'Compliance Status',
              type: 'kpi' as const,
              kpiData: [
                { label: 'OSFI B-10 Score', value: `${stats.complianceScore.toFixed(0)}%`, status: stats.complianceScore >= 80 ? 'success' : 'warning' },
                { label: 'Active Exceptions', value: stats.activeExceptions, status: stats.activeExceptions > 5 ? 'warning' : 'success' },
                { label: 'Fourth Parties', value: stats.fourthPartyCount },
                { label: 'Contract Value', value: formatCurrency(stats.totalContractValue) },
              ],
            },
          ],
        };

      case 'material-inventory':
        return {
          title: 'Material Arrangement Inventory',
          subtitle: `${currentOrganization?.name} - ${dateRange}`,
          author: currentOrganization?.name,
          date: reportDate,
          sections: [
            {
              title: 'Overview',
              type: 'text' as const,
              content: `This inventory details all material third-party arrangements as defined by OSFI B-10 guidelines. Material arrangements include critical service providers and those presenting elevated risk to the organization. Total material arrangements: ${stats.materialVendors}.`,
            },
            {
              title: 'Material Arrangements Summary',
              type: 'kpi' as const,
              kpiData: [
                { label: 'Total Material', value: stats.materialVendors },
                { label: 'Critical Tier', value: stats.tierDistribution.find((t) => t.tier === 'tier_5_critical')?.count || 0, status: 'danger' },
                { label: 'High Risk', value: stats.tierDistribution.find((t) => t.tier === 'tier_4_high')?.count || 0, status: 'warning' },
                { label: 'Total Value', value: formatCurrency(stats.totalContractValue) },
              ],
            },
            {
              title: 'Material Arrangement Details',
              type: 'table' as const,
              tableData: {
                headers: ['Vendor ID', 'Legal Name', 'Service Category', 'Tier', 'Status', 'Country', 'Contract Value'],
                rows: filteredData.vendors
                  .filter((v) => v.tier === 'tier_5_critical' || v.tier === 'tier_4_high' || v.is_critical)
                  .map((v) => [
                    v.vendor_id || 'N/A',
                    v.legal_name,
                    v.service_category || 'N/A',
                    TIER_LABELS[v.tier] || 'Unassessed',
                    v.status || 'N/A',
                    v.country || 'N/A',
                    formatCurrency(v.contract_value || 0),
                  ]),
              },
            },
          ],
        };

      case 'concentration':
        return {
          title: 'Concentration Risk Report',
          subtitle: `${currentOrganization?.name} - ${dateRange}`,
          author: currentOrganization?.name,
          date: reportDate,
          sections: [
            {
              title: 'Executive Summary',
              type: 'text' as const,
              content: `This report analyzes concentration risks within the third-party portfolio. Concentration risk arises when excessive reliance is placed on a single vendor, service category, or geographic region. The analysis identifies areas where concentration exceeds acceptable thresholds and may require mitigation.`,
            },
            {
              title: 'Service Category Concentration',
              type: 'table' as const,
              tableData: {
                headers: ['Service Category', 'Vendor Count', 'Concentration %', 'Risk Level'],
                rows: stats.categoryDistribution.map((c) => {
                  const concentration = (c.count / stats.totalVendors) * 100;
                  const riskLevel = concentration > 30 ? 'High' : concentration > 20 ? 'Medium' : 'Low';
                  return [c.category, c.count, `${concentration.toFixed(1)}%`, riskLevel];
                }),
              },
            },
            {
              title: 'Geographic Concentration',
              type: 'table' as const,
              tableData: {
                headers: ['Country', 'Vendor Count', 'Concentration %', 'Risk Level'],
                rows: stats.countryDistribution.map((c) => {
                  const concentration = (c.count / stats.totalVendors) * 100;
                  const riskLevel = concentration > 40 ? 'High' : concentration > 25 ? 'Medium' : 'Low';
                  return [c.country, c.count, `${concentration.toFixed(1)}%`, riskLevel];
                }),
              },
            },
            {
              title: 'Tier Concentration',
              type: 'table' as const,
              tableData: {
                headers: ['Risk Tier', 'Count', 'Percentage'],
                rows: stats.tierDistribution.map((t) => [
                  t.label,
                  t.count,
                  `${((t.count / stats.totalVendors) * 100).toFixed(1)}%`,
                ]),
              },
            },
          ],
        };

      case 'incident-summary':
        return {
          title: 'Incident Summary Report',
          subtitle: `${currentOrganization?.name} - ${dateRange}`,
          author: currentOrganization?.name,
          date: reportDate,
          sections: [
            {
              title: 'Overview',
              type: 'text' as const,
              content: `This report summarizes all third-party related incidents during the reporting period. A total of ${stats.totalIncidents} incidents were recorded, with ${stats.criticalIncidents} classified as high or critical severity requiring immediate attention.`,
            },
            {
              title: 'Incident Statistics',
              type: 'kpi' as const,
              kpiData: [
                { label: 'Total Incidents', value: stats.totalIncidents },
                { label: 'Critical/High', value: stats.criticalIncidents, status: stats.criticalIncidents > 0 ? 'danger' : 'success' },
                { label: 'Open Incidents', value: filteredData.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length, status: 'warning' },
                { label: 'Resolved', value: filteredData.incidents.filter((i) => i.status === 'resolved' || i.status === 'closed').length, status: 'success' },
              ],
            },
            {
              title: 'Incidents by Severity',
              type: 'table' as const,
              tableData: {
                headers: ['Severity', 'Count', 'Percentage', 'Avg Resolution Time'],
                rows: stats.incidentsBySeverity.map((i) => [
                  i.severity.charAt(0).toUpperCase() + i.severity.slice(1),
                  i.count,
                  `${((i.count / Math.max(stats.totalIncidents, 1)) * 100).toFixed(1)}%`,
                  'N/A',
                ]),
              },
            },
            {
              title: 'Incident Details',
              type: 'table' as const,
              tableData: {
                headers: ['Date', 'Title', 'Severity', 'Status', 'Vendor'],
                rows: filteredData.incidents.slice(0, 20).map((inc) => [
                  inc.incident_date ? format(parseISO(inc.incident_date), 'yyyy-MM-dd') : 'N/A',
                  inc.title || 'N/A',
                  inc.severity || 'N/A',
                  inc.status || 'N/A',
                  inc.vendor_name || 'N/A',
                ]),
              },
            },
          ],
        };

      default:
        return {
          title: 'Report',
          date: reportDate,
          sections: [],
        };
    }
  };

  const generateExcelData = () => {
    switch (selectedReport) {
      case 'osfi-annual':
      case 'material-inventory':
        return {
          filename: `${selectedReport}_${format(new Date(), 'yyyy-MM-dd')}`,
          headers: [
            { key: 'vendor_id', label: 'Vendor ID' },
            { key: 'legal_name', label: 'Legal Name' },
            { key: 'service_category', label: 'Service Category' },
            { key: 'tier', label: 'Risk Tier' },
            { key: 'status', label: 'Status' },
            { key: 'country', label: 'Country' },
            { key: 'contract_value', label: 'Contract Value' },
            { key: 'is_critical', label: 'Is Critical' },
            { key: 'next_review_date', label: 'Next Review Date' },
          ],
          rows: (selectedReport === 'material-inventory'
            ? filteredData.vendors.filter((v) => v.tier === 'tier_5_critical' || v.tier === 'tier_4_high' || v.is_critical)
            : filteredData.vendors
          ).map((v) => ({
            vendor_id: v.vendor_id || '',
            legal_name: v.legal_name,
            service_category: v.service_category || '',
            tier: TIER_LABELS[v.tier] || 'Unassessed',
            status: v.status || '',
            country: v.country || '',
            contract_value: v.contract_value || 0,
            is_critical: v.is_critical ? 'Yes' : 'No',
            next_review_date: v.next_review_date || '',
          })),
        };

      case 'concentration':
        return {
          filename: `concentration_risk_${format(new Date(), 'yyyy-MM-dd')}`,
          headers: [
            { key: 'category', label: 'Category' },
            { key: 'type', label: 'Type' },
            { key: 'count', label: 'Vendor Count' },
            { key: 'concentration', label: 'Concentration %' },
          ],
          rows: [
            ...stats.categoryDistribution.map((c) => ({
              category: c.category,
              type: 'Service Category',
              count: c.count,
              concentration: `${((c.count / stats.totalVendors) * 100).toFixed(1)}%`,
            })),
            ...stats.countryDistribution.map((c) => ({
              category: c.country,
              type: 'Country',
              count: c.count,
              concentration: `${((c.count / stats.totalVendors) * 100).toFixed(1)}%`,
            })),
          ],
        };

      case 'incident-summary':
        return {
          filename: `incident_summary_${format(new Date(), 'yyyy-MM-dd')}`,
          headers: [
            { key: 'incident_date', label: 'Date' },
            { key: 'title', label: 'Title' },
            { key: 'description', label: 'Description' },
            { key: 'severity', label: 'Severity' },
            { key: 'status', label: 'Status' },
            { key: 'vendor_name', label: 'Vendor' },
            { key: 'root_cause', label: 'Root Cause' },
          ],
          rows: filteredData.incidents.map((inc) => ({
            incident_date: inc.incident_date || '',
            title: inc.title || '',
            description: inc.description || '',
            severity: inc.severity || '',
            status: inc.status || '',
            vendor_name: inc.vendor_name || '',
            root_cause: inc.root_cause || '',
          })),
        };

      default:
        return { filename: 'report', headers: [], rows: [] };
    }
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

  const selectedReportConfig = REPORT_TYPES.find((r) => r.id === selectedReport);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center">
          <FileText className="w-8 h-8 mr-3" />
          Regulatory Reports
        </h1>
        <p className="text-slate-600 mt-1">Generate compliance reports for regulatory submission</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Report Types</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {REPORT_TYPES.map((report) => {
                const Icon = report.icon;
                const isSelected = selectedReport === report.id;
                return (
                  <button
                    key={report.id}
                    onClick={() => {
                      setSelectedReport(report.id);
                      setShowPreview(false);
                    }}
                    className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-slate-100 border-l-4 border-slate-900' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{report.name}</p>
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{report.description}</p>
                      </div>
                      {isSelected && <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">{selectedReportConfig?.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{selectedReportConfig?.description}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    {showPreview ? 'Hide Preview' : 'Preview'}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={exporting}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white flex items-center gap-2 disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="no-print px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
            </div>

            {showPreview ? (
              <ReportPreview
                reportType={selectedReport}
                stats={stats}
                filteredData={filteredData}
                organizationName={currentOrganization.name}
                dateRange={`${format(parseISO(startDate), 'MMM d, yyyy')} - ${format(parseISO(endDate), 'MMM d, yyyy')}`}
              />
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">Total Third Parties</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalVendors}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">Material Arrangements</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.materialVendors}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">Total Incidents</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalIncidents}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">Compliance Score</p>
                    <p className={`text-2xl font-bold ${stats.complianceScore >= 80 ? 'text-emerald-600' : stats.complianceScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {stats.complianceScore.toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                  <Eye className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-2">Click "Preview" to see the full report</p>
                  <p className="text-sm text-slate-500">or export directly to PDF or Excel</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportPreview({
  reportType,
  stats,
  filteredData,
  organizationName,
  dateRange,
}: {
  reportType: ReportType;
  stats: any;
  filteredData: any;
  organizationName: string;
  dateRange: string;
}) {
  const materialVendors = filteredData.vendors.filter(
    (v: any) => v.tier === 'tier_5_critical' || v.tier === 'tier_4_high' || v.is_critical
  );

  return (
    <div className="p-6 max-h-[600px] overflow-y-auto">
      <div className="bg-slate-900 text-white p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-2">
          {reportType === 'osfi-annual' && 'OSFI Annual TPRM Report'}
          {reportType === 'material-inventory' && 'Material Arrangement Inventory'}
          {reportType === 'concentration' && 'Concentration Risk Report'}
          {reportType === 'incident-summary' && 'Incident Summary Report'}
        </h2>
        <p className="text-slate-300">{organizationName}</p>
        <p className="text-slate-400 text-sm">{dateRange}</p>
      </div>

      {reportType === 'osfi-annual' && (
        <>
          <Section title="Executive Summary">
            <p className="text-slate-600">
              This report provides a comprehensive overview of {organizationName}'s Third-Party Risk Management (TPRM) program.
              The organization maintains <strong>{stats.totalVendors}</strong> third-party relationships, of which{' '}
              <strong>{stats.materialVendors}</strong> are classified as material arrangements requiring enhanced oversight.
              During this period, <strong>{stats.totalIncidents}</strong> incidents were recorded with{' '}
              <strong>{stats.criticalIncidents}</strong> classified as high severity.
              The overall OSFI B-10 compliance score stands at <strong>{stats.complianceScore.toFixed(1)}%</strong>.
            </p>
          </Section>

          <Section title="Key Performance Indicators">
            <div className="grid grid-cols-4 gap-4">
              <KPICard label="Total Third Parties" value={stats.totalVendors} />
              <KPICard label="Material Arrangements" value={stats.materialVendors} status="warning" />
              <KPICard label="Active Incidents" value={stats.criticalIncidents} status={stats.criticalIncidents > 0 ? 'danger' : 'success'} />
              <KPICard label="Compliance Score" value={`${stats.complianceScore.toFixed(0)}%`} status={stats.complianceScore >= 80 ? 'success' : 'warning'} />
            </div>
          </Section>

          <Section title="Third-Party Inventory by Tier">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Risk Tier</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Count</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.tierDistribution.map((t: any, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{t.label}</td>
                    <td className="px-4 py-2">{t.count}</td>
                    <td className="px-4 py-2">{((t.count / stats.totalVendors) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Section>

          <Section title="Material Arrangements">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Vendor</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Category</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Tier</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {materialVendors.slice(0, 10).map((v: any) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 font-medium">{v.legal_name}</td>
                    <td className="px-4 py-2">{v.service_category || 'N/A'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        v.tier === 'tier_5_critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {TIER_LABELS[v.tier] || 'Unassessed'}
                      </span>
                    </td>
                    <td className="px-4 py-2">{v.status || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {materialVendors.length > 10 && (
              <p className="text-sm text-slate-500 mt-2">+ {materialVendors.length - 10} more vendors</p>
            )}
          </Section>
        </>
      )}

      {reportType === 'material-inventory' && (
        <>
          <Section title="Material Arrangements Overview">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <KPICard label="Total Material" value={stats.materialVendors} />
              <KPICard label="Critical Tier" value={stats.tierDistribution.find((t: any) => t.tier === 'tier_5_critical')?.count || 0} status="danger" />
              <KPICard label="High Risk" value={stats.tierDistribution.find((t: any) => t.tier === 'tier_4_high')?.count || 0} status="warning" />
            </div>
          </Section>

          <Section title="Material Arrangement Details">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Vendor ID</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Legal Name</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Category</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Tier</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {materialVendors.map((v: any) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 font-mono text-xs">{v.vendor_id || 'N/A'}</td>
                    <td className="px-4 py-2 font-medium">{v.legal_name}</td>
                    <td className="px-4 py-2">{v.service_category || 'N/A'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        v.tier === 'tier_5_critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {TIER_LABELS[v.tier] || 'Unassessed'}
                      </span>
                    </td>
                    <td className="px-4 py-2">{v.country || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Section>
        </>
      )}

      {reportType === 'concentration' && (
        <>
          <Section title="Service Category Concentration">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Category</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Count</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Concentration</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.categoryDistribution.map((c: any, i: number) => {
                  const concentration = (c.count / stats.totalVendors) * 100;
                  const riskLevel = concentration > 30 ? 'High' : concentration > 20 ? 'Medium' : 'Low';
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2">{c.category}</td>
                      <td className="px-4 py-2">{c.count}</td>
                      <td className="px-4 py-2">{concentration.toFixed(1)}%</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          riskLevel === 'High' ? 'bg-red-100 text-red-700' :
                          riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {riskLevel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Section>

          <Section title="Geographic Concentration">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Country</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Count</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Concentration</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.countryDistribution.map((c: any, i: number) => {
                  const concentration = (c.count / stats.totalVendors) * 100;
                  const riskLevel = concentration > 40 ? 'High' : concentration > 25 ? 'Medium' : 'Low';
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2">{c.country}</td>
                      <td className="px-4 py-2">{c.count}</td>
                      <td className="px-4 py-2">{concentration.toFixed(1)}%</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          riskLevel === 'High' ? 'bg-red-100 text-red-700' :
                          riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {riskLevel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Section>
        </>
      )}

      {reportType === 'incident-summary' && (
        <>
          <Section title="Incident Overview">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <KPICard label="Total Incidents" value={stats.totalIncidents} />
              <KPICard label="Critical/High" value={stats.criticalIncidents} status={stats.criticalIncidents > 0 ? 'danger' : 'success'} />
              <KPICard label="Open" value={filteredData.incidents.filter((i: any) => i.status === 'open' || i.status === 'investigating').length} status="warning" />
              <KPICard label="Resolved" value={filteredData.incidents.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length} status="success" />
            </div>
          </Section>

          <Section title="Incidents by Severity">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Severity</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Count</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.incidentsBySeverity.map((i: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 capitalize">{i.severity}</td>
                    <td className="px-4 py-2">{i.count}</td>
                    <td className="px-4 py-2">{((i.count / Math.max(stats.totalIncidents, 1)) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Section>

          <Section title="Recent Incidents">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Title</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Severity</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.incidents.slice(0, 10).map((inc: any) => (
                  <tr key={inc.id}>
                    <td className="px-4 py-2">{inc.incident_date ? format(parseISO(inc.incident_date), 'yyyy-MM-dd') : 'N/A'}</td>
                    <td className="px-4 py-2 font-medium">{inc.title || 'N/A'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        inc.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        inc.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        inc.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {inc.severity || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-2 capitalize">{inc.status || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Section>
        </>
      )}

      <div className="mt-6 pt-4 border-t border-slate-200 text-center text-sm text-slate-500">
        <p>Report generated on {format(new Date(), 'MMMM d, yyyy')} - OSFI B-10 TPRM - Confidential</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-200">{title}</h3>
      {children}
    </div>
  );
}

function KPICard({ label, value, status }: { label: string; value: string | number; status?: 'success' | 'warning' | 'danger' }) {
  const colorClass = status === 'success' ? 'text-emerald-600' : status === 'warning' ? 'text-amber-600' : status === 'danger' ? 'text-red-600' : 'text-slate-900';

  return (
    <div className="p-4 bg-slate-50 rounded-lg">
      <p className="text-sm text-slate-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

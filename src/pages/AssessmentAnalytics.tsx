import { useState, useEffect, useMemo } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { SERVICE_CATEGORIES, BUSINESS_UNITS } from '../lib/constants';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  PieChart,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  Target,
  Zap,
} from 'lucide-react';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, differenceInDays } from 'date-fns';

interface AssessmentMetrics {
  totalCompleted: number;
  thisMonth: number;
  thisQuarter: number;
  thisYear: number;
  avgActivationDays: number;
  avgActivationDaysTrend: number;
  tierAdjustmentRate: number;
  completionByDefenseLine: { line: string; count: number; rate: number }[];
}

interface RiskDistribution {
  tierDistribution: { name: string; value: number; color: string }[];
  riskTrend: { date: string; avgRisk: number }[];
  autoCriticalTriggers: number;
  autoCriticalRate: number;
}

interface ComplianceMetrics {
  reassessmentsOnTime: number;
  reassessmentsOverdue: number;
  ddCompletionRate: number;
  avgDocumentCollectionDays: number;
  documentCompletionByType: { type: string; rate: number }[];
}

interface FilterOptions {
  dateRange: 'month' | 'quarter' | 'year' | 'custom';
  startDate: string;
  endDate: string;
  businessUnit: string;
  serviceCategory: string;
  assessor: string;
}

const TIER_COLORS = {
  'Tier 5 - Critical': '#ef4444',
  'Tier 4 - High': '#f97316',
  'Tier 3 - Moderate': '#f59e0b',
  'Tier 2 - Low': '#10b981',
  'Tier 1 - Informational': '#64748b',
};

const DEFENSE_LINE_LABELS: Record<string, string> = {
  '1a': '1st Line (Business)',
  '1b': '1st Line (GRC)',
  '2nd': '2nd Line',
  '3rd': '3rd Line',
  'admin': 'Admin',
};

export default function AssessmentAnalytics() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: 'quarter',
    startDate: format(startOfQuarter(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfQuarter(new Date()), 'yyyy-MM-dd'),
    businessUnit: '',
    serviceCategory: '',
    assessor: '',
  });
  const [assessmentMetrics, setAssessmentMetrics] = useState<AssessmentMetrics | null>(null);
  const [riskDistribution, setRiskDistribution] = useState<RiskDistribution | null>(null);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null);
  const [assessors, setAssessors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchAssessors();
      fetchAllMetrics();
    }
  }, [currentOrganization?.id, filters]);

  const fetchAssessors = async () => {
    if (!currentOrganization?.id) return;

    const { data } = await supabase
      .from('organization_users')
      .select('user_id, profiles:user_id(full_name)')
      .eq('organization_id', currentOrganization.id)
      .in('defense_line', ['1b', '2nd', '3rd']);

    if (data) {
      const uniqueAssessors = data
        .filter((m: any) => m.profiles?.full_name)
        .map((m: any) => ({ id: m.user_id, name: m.profiles.full_name }));
      setAssessors(uniqueAssessors);
    }
  };

  const fetchAllMetrics = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);

    try {
      await Promise.all([
        fetchAssessmentMetrics(),
        fetchRiskDistribution(),
        fetchComplianceMetrics(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessmentMetrics = async () => {
    if (!currentOrganization?.id) return;

    let query = supabase
      .from('tiering_assessments')
      .select('*, vendors!inner(*)')
      .eq('vendors.organization_id', currentOrganization.id)
      .eq('status', 'completed');

    if (filters.businessUnit) {
      query = query.eq('vendors.business_unit', filters.businessUnit);
    }
    if (filters.serviceCategory) {
      query = query.eq('vendors.service_category', filters.serviceCategory);
    }

    const { data: assessments } = await query;

    if (!assessments) {
      setAssessmentMetrics(null);
      return;
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const quarterStart = startOfQuarter(now);
    const yearStart = startOfYear(now);

    const thisMonth = assessments.filter(a => new Date(a.created_at) >= monthStart).length;
    const thisQuarter = assessments.filter(a => new Date(a.created_at) >= quarterStart).length;
    const thisYear = assessments.filter(a => new Date(a.created_at) >= yearStart).length;

    const { data: onboardingData } = await supabase
      .from('onboarding_requests')
      .select('created_at, approved_at')
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'approved')
      .not('approved_at', 'is', null);

    let avgActivationDays = 0;
    if (onboardingData && onboardingData.length > 0) {
      const totalDays = onboardingData.reduce((sum, req) => {
        const days = differenceInDays(new Date(req.approved_at!), new Date(req.created_at));
        return sum + days;
      }, 0);
      avgActivationDays = Math.round(totalDays / onboardingData.length);
    }

    const { data: previousOnboarding } = await supabase
      .from('onboarding_requests')
      .select('created_at, approved_at')
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'approved')
      .gte('approved_at', format(subMonths(now, 6), 'yyyy-MM-dd'))
      .lt('approved_at', format(subMonths(now, 3), 'yyyy-MM-dd'));

    let prevAvgDays = avgActivationDays;
    if (previousOnboarding && previousOnboarding.length > 0) {
      const totalDays = previousOnboarding.reduce((sum, req) => {
        const days = differenceInDays(new Date(req.approved_at!), new Date(req.created_at));
        return sum + days;
      }, 0);
      prevAvgDays = Math.round(totalDays / previousOnboarding.length);
    }

    const tierAdjusted = assessments.filter(a =>
      a.previous_tier && a.calculated_tier !== a.previous_tier && a.tier_change_justification
    ).length;
    const tierAdjustmentRate = assessments.length > 0
      ? Math.round((tierAdjusted / assessments.length) * 100)
      : 0;

    const byDefenseLine: Record<string, { total: number; completed: number }> = {};
    assessments.forEach(a => {
      const line = a.assessed_by_defense_line || '1b';
      if (!byDefenseLine[line]) {
        byDefenseLine[line] = { total: 0, completed: 0 };
      }
      byDefenseLine[line].total++;
      if (a.status === 'completed') {
        byDefenseLine[line].completed++;
      }
    });

    const completionByDefenseLine = Object.entries(byDefenseLine).map(([line, data]) => ({
      line: DEFENSE_LINE_LABELS[line] || line,
      count: data.completed,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));

    setAssessmentMetrics({
      totalCompleted: assessments.length,
      thisMonth,
      thisQuarter,
      thisYear,
      avgActivationDays,
      avgActivationDaysTrend: avgActivationDays - prevAvgDays,
      tierAdjustmentRate,
      completionByDefenseLine,
    });
  };

  const fetchRiskDistribution = async () => {
    if (!currentOrganization?.id) return;

    let query = supabase
      .from('vendors')
      .select('tier, is_critical, created_at')
      .eq('organization_id', currentOrganization.id)
      .in('status', ['active', 'under_review']);

    if (filters.businessUnit) {
      query = query.eq('business_unit', filters.businessUnit);
    }
    if (filters.serviceCategory) {
      query = query.eq('service_category', filters.serviceCategory);
    }

    const { data: vendors } = await query;

    if (!vendors) {
      setRiskDistribution(null);
      return;
    }

    const tierCounts: Record<string, number> = {
      'Tier 5 - Critical': 0,
      'Tier 4 - High': 0,
      'Tier 3 - Moderate': 0,
      'Tier 2 - Low': 0,
      'Tier 1 - Informational': 0,
    };

    const tierMapping: Record<string, string> = {
      'tier_5_critical': 'Tier 5 - Critical',
      'tier_4_high': 'Tier 4 - High',
      'tier_3_moderate': 'Tier 3 - Moderate',
      'tier_2_low': 'Tier 2 - Low',
      'tier_1_informational': 'Tier 1 - Informational',
    };

    vendors.forEach(v => {
      const tierLabel = tierMapping[v.tier] || 'Tier 1 - Informational';
      tierCounts[tierLabel]++;
    });

    const tierDistribution = Object.entries(tierCounts).map(([name, value]) => ({
      name,
      value,
      color: TIER_COLORS[name as keyof typeof TIER_COLORS],
    }));

    const { data: assessmentHistory } = await supabase
      .from('tiering_assessments')
      .select('created_at, risk_rating, vendors!inner(id)')
      .eq('vendors.organization_id', currentOrganization.id)
      .eq('status', 'completed')
      .gte('created_at', format(subMonths(new Date(), 12), 'yyyy-MM-dd'))
      .order('created_at', { ascending: true });

    const monthlyAvg: Record<string, { total: number; count: number }> = {};
    assessmentHistory?.forEach(a => {
      const monthKey = format(new Date(a.created_at), 'MMM yyyy');
      if (!monthlyAvg[monthKey]) {
        monthlyAvg[monthKey] = { total: 0, count: 0 };
      }
      monthlyAvg[monthKey].total += a.risk_rating || 0;
      monthlyAvg[monthKey].count++;
    });

    const riskTrend = Object.entries(monthlyAvg).map(([date, data]) => ({
      date,
      avgRisk: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
    }));

    const { data: autoCritical } = await supabase
      .from('vendors')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .eq('is_critical', true);

    const autoCriticalTriggers = autoCritical?.length || 0;
    const autoCriticalRate = vendors.length > 0
      ? Math.round((autoCriticalTriggers / vendors.length) * 100)
      : 0;

    setRiskDistribution({
      tierDistribution,
      riskTrend,
      autoCriticalTriggers,
      autoCriticalRate,
    });
  };

  const fetchComplianceMetrics = async () => {
    if (!currentOrganization?.id) return;

    const { data: reassessments } = await supabase
      .from('assessment_tasks')
      .select('status, due_date, completed_at')
      .eq('organization_id', currentOrganization.id)
      .in('task_type', ['annual_reassessment', 'triggered_reassessment', 'bulk_import_assessment']);

    const now = new Date();
    let onTime = 0;
    let overdue = 0;

    reassessments?.forEach(r => {
      if (r.status === 'completed') {
        if (r.completed_at && r.due_date) {
          if (new Date(r.completed_at) <= new Date(r.due_date)) {
            onTime++;
          } else {
            overdue++;
          }
        } else {
          onTime++;
        }
      } else if (r.due_date && new Date(r.due_date) < now) {
        overdue++;
      }
    });

    const { data: ddRequests } = await supabase
      .from('due_diligence_document_requests')
      .select('status, requested_at, received_at')
      .eq('organization_id', currentOrganization.id);

    const completedDD = ddRequests?.filter(d => d.status === 'approved').length || 0;
    const totalDD = ddRequests?.length || 1;
    const ddCompletionRate = Math.round((completedDD / totalDD) * 100);

    let avgDocDays = 0;
    const completedWithDates = ddRequests?.filter(d => d.status === 'approved' && d.received_at);
    if (completedWithDates && completedWithDates.length > 0) {
      const totalDays = completedWithDates.reduce((sum, d) => {
        return sum + differenceInDays(new Date(d.received_at!), new Date(d.requested_at));
      }, 0);
      avgDocDays = Math.round(totalDays / completedWithDates.length);
    }

    const { data: ddDocuments } = await supabase
      .from('due_diligence_document_requests')
      .select('document_type_code, status')
      .eq('organization_id', currentOrganization.id);

    const docByType: Record<string, { total: number; completed: number }> = {};
    ddDocuments?.forEach(doc => {
      const type = doc.document_type_code || 'other';
      if (!docByType[type]) {
        docByType[type] = { total: 0, completed: 0 };
      }
      docByType[type].total++;
      if (doc.status === 'approved') {
        docByType[type].completed++;
      }
    });

    const documentCompletionByType = Object.entries(docByType)
      .map(([type, data]) => ({
        type: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .slice(0, 6);

    setComplianceMetrics({
      reassessmentsOnTime: onTime,
      reassessmentsOverdue: overdue,
      ddCompletionRate,
      avgDocumentCollectionDays: avgDocDays,
      documentCompletionByType,
    });
  };

  const handleDateRangeChange = (range: 'month' | 'quarter' | 'year' | 'custom') => {
    const now = new Date();
    let startDate = '';
    let endDate = format(now, 'yyyy-MM-dd');

    switch (range) {
      case 'month':
        startDate = format(startOfMonth(now), 'yyyy-MM-dd');
        endDate = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'quarter':
        startDate = format(startOfQuarter(now), 'yyyy-MM-dd');
        endDate = format(endOfQuarter(now), 'yyyy-MM-dd');
        break;
      case 'year':
        startDate = format(startOfYear(now), 'yyyy-MM-dd');
        endDate = format(endOfYear(now), 'yyyy-MM-dd');
        break;
      case 'custom':
        startDate = filters.startDate;
        endDate = filters.endDate;
        break;
    }

    setFilters({ ...filters, dateRange: range, startDate, endDate });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text('Assessment Analytics Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Period: ${format(new Date(filters.startDate), 'MMM d, yyyy')} - ${format(new Date(filters.endDate), 'MMM d, yyyy')}`, pageWidth / 2, 34, { align: 'center' });

    let yPos = 50;

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('Assessment Metrics', 14, yPos);
    yPos += 8;

    if (assessmentMetrics) {
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Total Assessments Completed', assessmentMetrics.totalCompleted.toString()],
          ['This Month', assessmentMetrics.thisMonth.toString()],
          ['This Quarter', assessmentMetrics.thisQuarter.toString()],
          ['This Year', assessmentMetrics.thisYear.toString()],
          ['Avg. Time to Activation', `${assessmentMetrics.avgActivationDays} days`],
          ['Tier Adjustment Rate', `${assessmentMetrics.tierAdjustmentRate}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    doc.setFontSize(14);
    doc.text('Risk Distribution', 14, yPos);
    yPos += 8;

    if (riskDistribution) {
      autoTable(doc, {
        startY: yPos,
        head: [['Risk Tier', 'Count']],
        body: riskDistribution.tierDistribution.map(t => [t.name, t.value.toString()]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Compliance Metrics', 14, yPos);
    yPos += 8;

    if (complianceMetrics) {
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Reassessments On Time', complianceMetrics.reassessmentsOnTime.toString()],
          ['Reassessments Overdue', complianceMetrics.reassessmentsOverdue.toString()],
          ['Due Diligence Completion Rate', `${complianceMetrics.ddCompletionRate}%`],
          ['Avg. Document Collection Time', `${complianceMetrics.avgDocumentCollectionDays} days`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (assessmentMetrics?.completionByDefenseLine) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.text('Completion by Defense Line', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Defense Line', 'Completed', 'Rate']],
        body: assessmentMetrics.completionByDefenseLine.map(d => [
          d.line,
          d.count.toString(),
          `${d.rate}%`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
      });
    }

    doc.save(`assessment-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const MetricCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    color = 'blue'
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: any;
    trend?: number;
    color?: string;
  }) => {
    const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-500' },
      red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'text-red-500' },
      slate: { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'text-slate-500' },
    };
    const c = colorClasses[color] || colorClasses.blue;

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-lg ${c.bg}`}>
            <Icon className={`w-6 h-6 ${c.icon}`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center text-sm ${
              trend > 0 ? 'text-red-600' : trend < 0 ? 'text-emerald-600' : 'text-slate-500'
            }`}>
              {trend > 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : trend < 0 ? (
                <ArrowDownRight className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              <span>{Math.abs(trend)} days</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
          <p className="text-sm text-slate-500 mt-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assessment Analytics</h1>
          <p className="text-slate-500 mt-1">Comprehensive risk assessment metrics and trends</p>
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export PDF</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <span className="font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Business Unit</label>
            <select
              value={filters.businessUnit}
              onChange={(e) => setFilters({ ...filters, businessUnit: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Units</option>
              {BUSINESS_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Service Category</label>
            <select
              value={filters.serviceCategory}
              onChange={(e) => setFilters({ ...filters, serviceCategory: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Assessor</label>
            <select
              value={filters.assessor}
              onChange={(e) => setFilters({ ...filters, assessor: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Assessors</option>
              {assessors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Assessments"
          value={assessmentMetrics?.totalCompleted || 0}
          subtitle="Completed this period"
          icon={CheckCircle}
          color="emerald"
        />
        <MetricCard
          title="Avg. Activation Time"
          value={`${assessmentMetrics?.avgActivationDays || 0} days`}
          subtitle="Request to vendor active"
          icon={Clock}
          trend={assessmentMetrics?.avgActivationDaysTrend}
          color="blue"
        />
        <MetricCard
          title="Tier Adjustment Rate"
          value={`${assessmentMetrics?.tierAdjustmentRate || 0}%`}
          subtitle="Changed by 2nd line review"
          icon={Target}
          color="amber"
        />
        <MetricCard
          title="Auto-Critical Triggers"
          value={riskDistribution?.autoCriticalTriggers || 0}
          subtitle={`${riskDistribution?.autoCriticalRate || 0}% of vendors`}
          icon={Zap}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Assessments by Period</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-slate-700">This Month</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{assessmentMetrics?.thisMonth || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-slate-700">This Quarter</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{assessmentMetrics?.thisQuarter || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-slate-700">This Year</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{assessmentMetrics?.thisYear || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Completion by Defense Line</h3>
          <div className="space-y-3">
            {assessmentMetrics?.completionByDefenseLine.map((line) => (
              <div key={line.line}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">{line.line}</span>
                  <span className="text-sm font-medium text-slate-900">{line.count} ({line.rate}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${line.rate}%` }}
                  />
                </div>
              </div>
            ))}
            {(!assessmentMetrics?.completionByDefenseLine || assessmentMetrics.completionByDefenseLine.length === 0) && (
              <p className="text-sm text-slate-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Reassessment Status</h3>
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${((complianceMetrics?.reassessmentsOnTime || 0) /
                    ((complianceMetrics?.reassessmentsOnTime || 0) + (complianceMetrics?.reassessmentsOverdue || 1))) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold text-slate-900">
                  {complianceMetrics?.reassessmentsOnTime || 0}
                </span>
                <span className="text-xs text-slate-500">On Time</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">{complianceMetrics?.reassessmentsOnTime || 0}</p>
              <p className="text-xs text-emerald-700">On Time</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{complianceMetrics?.reassessmentsOverdue || 0}</p>
              <p className="text-xs text-red-700">Overdue</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Vendors by Risk Tier</h3>
          <div className="h-64">
            {riskDistribution?.tierDistribution && riskDistribution.tierDistribution.some(t => t.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={riskDistribution.tierDistribution.filter(t => t.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name.split(' - ')[1]}: ${value}`}
                  >
                    {riskDistribution.tierDistribution.filter(t => t.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                No vendor data available
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {riskDistribution?.tierDistribution.map((tier) => (
              <div key={tier.name} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                <span className="text-xs text-slate-600">{tier.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Score Trend (12 months)</h3>
          <div className="h-64">
            {riskDistribution?.riskTrend && riskDistribution.riskTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={riskDistribution.riskTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                    domain={[0, 25]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRisk"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                    name="Avg Risk Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                No trend data available
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Due Diligence Metrics</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-blue-600">{complianceMetrics?.ddCompletionRate || 0}%</p>
              <p className="text-sm text-blue-700">Completion Rate</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-slate-700">{complianceMetrics?.avgDocumentCollectionDays || 0}</p>
              <p className="text-sm text-slate-600">Avg. Days to Collect</p>
            </div>
          </div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Document Completion by Type</h4>
          <div className="space-y-2">
            {complianceMetrics?.documentCompletionByType.map((doc) => (
              <div key={doc.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{doc.type}</span>
                  <span className="text-xs font-medium text-slate-900">{doc.rate}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      doc.rate >= 80 ? 'bg-emerald-500' : doc.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${doc.rate}%` }}
                  />
                </div>
              </div>
            ))}
            {(!complianceMetrics?.documentCompletionByType || complianceMetrics.documentCompletionByType.length === 0) && (
              <p className="text-sm text-slate-500 text-center py-4">No document data available</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Insights</h3>
          <div className="space-y-4">
            {assessmentMetrics && assessmentMetrics.avgActivationDays > 14 && (
              <div className="flex items-start space-x-3 p-3 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">High Activation Time</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Average time to activate vendors ({assessmentMetrics.avgActivationDays} days) exceeds target of 14 days.
                  </p>
                </div>
              </div>
            )}

            {complianceMetrics && complianceMetrics.reassessmentsOverdue > 0 && (
              <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Overdue Reassessments</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {complianceMetrics.reassessmentsOverdue} reassessment{complianceMetrics.reassessmentsOverdue !== 1 ? 's' : ''} past due date. Review and prioritize completion.
                  </p>
                </div>
              </div>
            )}

            {assessmentMetrics && assessmentMetrics.tierAdjustmentRate > 30 && (
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">High Tier Adjustment Rate</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {assessmentMetrics.tierAdjustmentRate}% of assessments adjusted by 2nd line. Consider calibration training.
                  </p>
                </div>
              </div>
            )}

            {riskDistribution && riskDistribution.autoCriticalRate > 20 && (
              <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                <Zap className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Auto-Critical Rate</p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    {riskDistribution.autoCriticalRate}% of vendors auto-flagged as critical. Review rule configurations.
                  </p>
                </div>
              </div>
            )}

            {complianceMetrics && complianceMetrics.ddCompletionRate >= 90 && (
              <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">Strong Due Diligence</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Due diligence completion rate of {complianceMetrics.ddCompletionRate}% meets compliance targets.
                  </p>
                </div>
              </div>
            )}

            {(!assessmentMetrics || assessmentMetrics.totalCompleted === 0) && (
              <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                <FileText className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700">No Assessment Data</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Complete vendor assessments to generate analytics insights.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

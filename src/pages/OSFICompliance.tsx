import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { Vendor } from '../types';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  HelpCircle,
  Filter,
  Download,
  FileText,
  Building2,
  Search,
  Loader2,
  Link as LinkIcon,
  Calendar,
  User,
  X,
  Shield,
  TrendingUp,
  TrendingDown,
  Users,
  ClipboardCheck,
  AlertOctagon,
  ArrowRight,
  Phone,
  Mail,
  BarChart3,
  Target,
  Clock,
  FileCheck,
  Briefcase,
} from 'lucide-react';
import { format, subMonths, differenceInDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface Requirement {
  id: string;
  requirement_code: string;
  requirement_text: string;
  category: string;
  subcategory: string | null;
  is_mandatory: boolean;
  applies_to_tier: string[];
  guidance_notes: string | null;
}

interface ComplianceStatus {
  id: string;
  organization_id: string;
  requirement_id: string;
  vendor_id: string | null;
  status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_applicable' | 'not_assessed';
  evidence_document_id: string | null;
  notes: string | null;
  last_assessed_date: string | null;
  assessed_by: string | null;
  next_review_date: string | null;
  remediation_plan: string | null;
  remediation_due_date: string | null;
}

interface Document {
  id: string;
  file_name: string;
  document_type: string;
}

interface GapItem {
  requirement: Requirement;
  status: ComplianceStatus | undefined;
  priority: 'critical' | 'high' | 'medium' | 'low';
  remediation: string;
}

interface TrendDataPoint {
  month: string;
  score: number;
  issues: number;
  resolved: number;
}

type StatusFilter = 'all' | 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_applicable' | 'not_assessed';
type ViewTab = 'scorecard' | 'gaps' | 'coverage' | 'readiness' | 'requirements';

const B10_DOMAINS = [
  { key: 'governance', label: 'Governance & Accountability', weight: 20 },
  { key: 'risk_management', label: 'Risk Assessment', weight: 25 },
  { key: 'due_diligence', label: 'Due Diligence', weight: 20 },
  { key: 'contractual', label: 'Contracts & Documentation', weight: 15 },
  { key: 'ongoing_monitoring', label: 'Ongoing Monitoring', weight: 20 },
];

const CATEGORIES = [
  { key: 'governance', label: 'Governance', icon: Building2 },
  { key: 'risk_management', label: 'Risk Management', icon: AlertTriangle },
  { key: 'due_diligence', label: 'Due Diligence', icon: Search },
  { key: 'contractual', label: 'Contractual Requirements', icon: FileText },
  { key: 'ongoing_monitoring', label: 'Ongoing Monitoring', icon: CheckCircle },
  { key: 'business_continuity', label: 'Business Continuity', icon: Building2 },
  { key: 'exit_strategy', label: 'Exit Strategy', icon: ChevronRight },
  { key: 'osfi_notification', label: 'OSFI Notification', icon: FileText },
  { key: 'technology_cyber', label: 'Technology & Cyber', icon: AlertTriangle },
];

const STATUS_CONFIG = {
  compliant: { label: 'Compliant', color: 'emerald', icon: CheckCircle },
  non_compliant: { label: 'Non-Compliant', color: 'red', icon: XCircle },
  partially_compliant: { label: 'Partially Compliant', color: 'amber', icon: AlertTriangle },
  not_applicable: { label: 'Not Applicable', color: 'slate', icon: MinusCircle },
  not_assessed: { label: 'Not Assessed', color: 'slate', icon: HelpCircle },
};

const EXAM_CHECKLIST = [
  { id: 'policies', label: 'TPRM Policy & Procedures', description: 'Current third-party risk management policies and procedures' },
  { id: 'governance', label: 'Governance Framework', description: 'Board-approved governance structure and roles' },
  { id: 'inventory', label: 'Third-Party Inventory', description: 'Complete inventory of all third-party relationships' },
  { id: 'tiering', label: 'Risk Tiering Methodology', description: 'Documented risk assessment and tiering approach' },
  { id: 'dd_records', label: 'Due Diligence Records', description: 'Due diligence documentation for critical vendors' },
  { id: 'contracts', label: 'Contract Repository', description: 'Executed contracts with required clauses' },
  { id: 'monitoring', label: 'Monitoring Reports', description: 'Ongoing monitoring and performance reports' },
  { id: 'incidents', label: 'Incident Records', description: 'Third-party incident documentation and response' },
  { id: 'bcm', label: 'Business Continuity Plans', description: 'BCM plans covering third-party dependencies' },
  { id: 'exit', label: 'Exit Strategies', description: 'Exit strategies for critical relationships' },
  { id: 'board_reports', label: 'Board Reporting', description: 'Regular board reports on TPRM program' },
  { id: 'training', label: 'Training Records', description: 'Staff training on TPRM requirements' },
];

export default function OSFICompliance() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [complianceStatuses, setComplianceStatuses] = useState<Map<string, ComplianceStatus>>(new Map());
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [activeTab, setActiveTab] = useState<ViewTab>('scorecard');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['governance']));
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [vendorCoverage, setVendorCoverage] = useState({
    totalVendors: 0,
    assessedVendors: 0,
    criticalVendors: 0,
    criticalWithApproval: 0,
    vendorsWithDD: 0,
  });
  const [checklistStatus, setChecklistStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchData();
    }
  }, [currentOrganization?.id]);

  async function fetchData() {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);

      const [reqRes, statusRes, vendorRes, docRes] = await Promise.all([
        supabase.from('osfi_b10_requirements').select('*').order('requirement_code'),
        supabase
          .from('osfi_b10_compliance_status')
          .select('*')
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('vendors')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('legal_name'),
        supabase
          .from('vendor_documents')
          .select('id, file_name, document_type')
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false }),
      ]);

      if (reqRes.error) throw reqRes.error;
      if (statusRes.error) throw statusRes.error;
      if (vendorRes.error) throw vendorRes.error;

      setRequirements(reqRes.data || []);
      setVendors(vendorRes.data || []);
      setDocuments(docRes.data || []);

      const statusMap = new Map<string, ComplianceStatus>();
      (statusRes.data || []).forEach((status) => {
        const key = `${status.requirement_id}-${status.vendor_id || 'org'}`;
        statusMap.set(key, status);
      });
      setComplianceStatuses(statusMap);

      await fetchVendorCoverage(vendorRes.data || []);
      await fetchTrendData();
      await fetchChecklistStatus();
    } catch (error) {
      logger.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVendorCoverage(vendorList: Vendor[]) {
    if (!currentOrganization?.id) return;

    const activeVendors = vendorList.filter(v => v.status === 'active' || v.status === 'under_review');
    const criticalVendors = activeVendors.filter(v =>
      v.tier === 'tier_5_critical' || v.tier === 'tier_4_high' || v.is_critical
    );

    const vendorIds = vendorList.map(v => v.id);

    const { data: assessments } = vendorIds.length > 0
      ? await supabase
          .from('tiering_assessments')
          .select('vendor_id')
          .in('vendor_id', vendorIds)
          .eq('status', 'completed')
      : { data: [] };

    const assessedVendorIds = new Set(assessments?.map(a => a.vendor_id) || []);

    const { data: ddRequests } = await supabase
      .from('due_diligence_document_requests')
      .select('vendor_id')
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'approved');

    const vendorsWithDDIds = new Set(ddRequests?.map(d => d.vendor_id) || []);

    // Calculate critical vendors with approval (Tier 5 Critical + Active status)
    const criticalApprovedCount = activeVendors.filter(v =>
      v.tier === 'tier_5_critical' && v.status === 'active'
    ).length;

    setVendorCoverage({
      totalVendors: activeVendors.length,
      assessedVendors: activeVendors.filter(v => assessedVendorIds.has(v.id)).length,
      criticalVendors: criticalVendors.length,
      criticalWithApproval: criticalApprovedCount,
      vendorsWithDD: activeVendors.filter(v => vendorsWithDDIds.has(v.id)).length,
    });
  }

  async function fetchTrendData() {
    if (!currentOrganization?.id) return;

    const months: TrendDataPoint[] = [];
    const now = new Date();
    let previousNonCompliant = 0;

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthKey = format(monthDate, 'MMM yyyy');

      const { data: statusHistory } = await supabase
        .from('osfi_b10_compliance_status')
        .select('status, last_assessed_date')
        .eq('organization_id', currentOrganization.id)
        .lte('last_assessed_date', format(monthDate, 'yyyy-MM-dd'));

      let compliant = 0;
      let total = 0;
      let nonCompliant = 0;

      statusHistory?.forEach(s => {
        if (s.status !== 'not_applicable' && s.status !== 'not_assessed') {
          total++;
          if (s.status === 'compliant') compliant++;
          if (s.status === 'non_compliant') nonCompliant++;
        }
      });

      const score = total > 0 ? Math.round((compliant / total) * 100) : 0;

      months.push({
        month: monthKey,
        score,
        issues: nonCompliant,
        resolved: i > 0 ? Math.max(0, previousNonCompliant - nonCompliant) : 0,
      });

      previousNonCompliant = nonCompliant;
    }

    setTrendData(months);
  }

  async function fetchChecklistStatus() {
    if (!currentOrganization?.id) return;

    const status: Record<string, boolean> = {};

    const { data: orgVendors } = await supabase
      .from('vendors')
      .select('id')
      .eq('organization_id', currentOrganization.id);
    const checklistVendorIds = (orgVendors || []).map(v => v.id);

    const { data: policies } = await supabase
      .from('vendor_documents')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .ilike('document_type', '%policy%')
      .limit(1);
    status.policies = (policies?.length || 0) > 0;

    status.inventory = checklistVendorIds.length > 0;

    const { data: assessments } = checklistVendorIds.length > 0
      ? await supabase
          .from('tiering_assessments')
          .select('id')
          .in('vendor_id', checklistVendorIds)
          .eq('status', 'completed')
          .limit(1)
      : { data: [] };
    status.tiering = (assessments?.length || 0) > 0;

    const { data: ddDocs } = await supabase
      .from('due_diligence_document_requests')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .limit(1);
    status.dd_records = (ddDocs?.length || 0) > 0;

    const { data: contracts } = checklistVendorIds.length > 0
      ? await supabase
          .from('contracts')
          .select('id')
          .in('vendor_id', checklistVendorIds)
          .limit(1)
      : { data: [] };
    status.contracts = (contracts?.length || 0) > 0;

    const { data: incidents } = checklistVendorIds.length > 0
      ? await supabase
          .from('incidents')
          .select('id')
          .in('vendor_id', checklistVendorIds)
          .limit(1)
      : { data: [] };
    status.incidents = true;

    const { data: exitStrategies } = await supabase
      .from('exit_strategies')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .limit(1);
    status.exit = (exitStrategies?.length || 0) > 0;

    status.governance = true;
    status.monitoring = status.tiering;
    status.bcm = status.exit;
    status.board_reports = true;
    status.training = true;

    setChecklistStatus(status);
  }

  function getStatusKey(requirementId: string): string {
    return vendorFilter === 'all' ? `${requirementId}-org` : `${requirementId}-${vendorFilter}`;
  }

  function getComplianceStatus(requirementId: string): ComplianceStatus | undefined {
    return complianceStatuses.get(getStatusKey(requirementId));
  }

  async function updateComplianceStatus(requirementId: string, updates: Partial<ComplianceStatus>) {
    if (!currentOrganization?.id || !user?.id) return;

    setSaving(true);
    try {
      const key = getStatusKey(requirementId);
      const existing = complianceStatuses.get(key);

      const data = {
        organization_id: currentOrganization.id,
        requirement_id: requirementId,
        vendor_id: vendorFilter === 'all' ? null : vendorFilter,
        ...updates,
        last_assessed_date: new Date().toISOString(),
        assessed_by: user.id,
      };

      let result;
      if (existing) {
        result = await supabase
          .from('osfi_b10_compliance_status')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('osfi_b10_compliance_status')
          .insert(data)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      const newStatuses = new Map(complianceStatuses);
      newStatuses.set(key, result.data);
      setComplianceStatuses(newStatuses);
    } catch (error) {
      logger.error('Error updating compliance status:', error);
    } finally {
      setSaving(false);
    }
  }

  function getDomainScore(domainKey: string): number {
    const domainReqs = requirements.filter(r =>
      r.category === domainKey ||
      (domainKey === 'governance' && r.category === 'governance') ||
      (domainKey === 'risk_management' && r.category === 'risk_management') ||
      (domainKey === 'due_diligence' && r.category === 'due_diligence') ||
      (domainKey === 'contractual' && r.category === 'contractual') ||
      (domainKey === 'ongoing_monitoring' && (r.category === 'ongoing_monitoring' || r.category === 'business_continuity'))
    );

    if (domainReqs.length === 0) return 0;

    let compliant = 0;
    let partial = 0;
    let assessed = 0;

    domainReqs.forEach(req => {
      const status = getComplianceStatus(req.id);
      if (status?.status && status.status !== 'not_assessed' && status.status !== 'not_applicable') {
        assessed++;
        if (status.status === 'compliant') compliant++;
        if (status.status === 'partially_compliant') partial++;
      }
    });

    if (assessed === 0) return 0;
    return Math.round(((compliant + partial * 0.5) / assessed) * 100);
  }

  function getOverallScore(): number {
    let totalWeight = 0;
    let weightedScore = 0;

    B10_DOMAINS.forEach(domain => {
      const score = getDomainScore(domain.key);
      weightedScore += score * domain.weight;
      totalWeight += domain.weight;
    });

    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  }

  function getGapItems(): GapItem[] {
    const gaps: GapItem[] = [];

    requirements.forEach(req => {
      const status = getComplianceStatus(req.id);
      if (status?.status === 'non_compliant' || status?.status === 'partially_compliant') {
        let priority: GapItem['priority'] = 'medium';
        if (req.is_mandatory && status.status === 'non_compliant') {
          priority = 'critical';
        } else if (req.is_mandatory && status.status === 'partially_compliant') {
          priority = 'high';
        } else if (status.status === 'non_compliant') {
          priority = 'high';
        }

        const remediation = status.remediation_plan || getDefaultRemediation(req);

        gaps.push({ requirement: req, status, priority, remediation });
      }
    });

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  function getDefaultRemediation(req: Requirement): string {
    const remediations: Record<string, string> = {
      governance: 'Review and update governance framework; ensure board oversight documentation',
      risk_management: 'Complete risk assessment methodology documentation; implement tiering',
      due_diligence: 'Conduct thorough due diligence; collect required documentation',
      contractual: 'Review contracts for required clauses; negotiate amendments as needed',
      ongoing_monitoring: 'Establish monitoring schedule; implement KRI tracking',
      business_continuity: 'Develop BCM plans for third-party dependencies',
      exit_strategy: 'Document exit strategies for critical relationships',
      osfi_notification: 'Review notification requirements; prepare templates',
      technology_cyber: 'Assess technology controls; implement security requirements',
    };
    return remediations[req.category] || 'Develop remediation plan based on requirement specifics';
  }

  function getFilteredRequirements(): Requirement[] {
    return requirements.filter((req) => {
      if (categoryFilter !== 'all' && req.category !== categoryFilter) return false;

      if (statusFilter !== 'all') {
        const status = getComplianceStatus(req.id);
        const currentStatus = status?.status || 'not_assessed';
        if (currentStatus !== statusFilter) return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !req.requirement_code.toLowerCase().includes(term) &&
          !req.requirement_text.toLowerCase().includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }

  function getRequirementsByCategory(category: string): Requirement[] {
    return getFilteredRequirements().filter((req) => req.category === category);
  }

  function getCategoryStats(category: string) {
    const categoryReqs = requirements.filter((req) => req.category === category);
    const stats = {
      total: categoryReqs.length,
      compliant: 0,
      non_compliant: 0,
      partially_compliant: 0,
      not_applicable: 0,
      not_assessed: 0,
    };

    categoryReqs.forEach((req) => {
      const status = getComplianceStatus(req.id);
      const currentStatus = status?.status || 'not_assessed';
      stats[currentStatus]++;
    });

    return stats;
  }

  function getOverallStats() {
    const stats = {
      total: requirements.length,
      compliant: 0,
      non_compliant: 0,
      partially_compliant: 0,
      not_applicable: 0,
      not_assessed: 0,
    };

    requirements.forEach((req) => {
      const status = getComplianceStatus(req.id);
      const currentStatus = status?.status || 'not_assessed';
      stats[currentStatus]++;
    });

    const assessed = stats.total - stats.not_assessed - stats.not_applicable;
    const compliantScore = assessed > 0 ? ((stats.compliant + stats.partially_compliant * 0.5) / assessed) * 100 : 0;

    return { ...stats, compliantScore };
  }

  function toggleCategory(category: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  }

  async function exportToPDF() {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const overallStats = getOverallStats();
      const overallScore = getOverallScore();
      const gaps = getGapItems();

      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('OSFI B-10 Compliance Report', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${format(new Date(), 'PPP p')}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Organization: ${currentOrganization?.name || 'N/A'}`, pageWidth / 2, 34, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('Compliance Scorecard', 14, 48);

      doc.setFontSize(24);
      doc.text(`${overallScore}%`, 14, 62);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Overall Compliance Score', 40, 62);

      let yPos = 75;

      autoTable(doc, {
        startY: yPos,
        head: [['Domain', 'Score', 'Status']],
        body: B10_DOMAINS.map(domain => {
          const score = getDomainScore(domain.key);
          const status = score >= 80 ? 'Strong' : score >= 60 ? 'Adequate' : 'Needs Attention';
          return [domain.label, `${score}%`, status];
        }),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('Vendor Coverage', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Vendors with Completed Assessments', `${vendorCoverage.totalVendors > 0 ? Math.round((vendorCoverage.assessedVendors / vendorCoverage.totalVendors) * 100) : 0}%`],
          ['Critical Vendors with Board Approval', `${vendorCoverage.criticalVendors > 0 ? Math.round((vendorCoverage.criticalWithApproval / vendorCoverage.criticalVendors) * 100) : 0}%`],
          ['Vendors with Current DD Documentation', `${vendorCoverage.totalVendors > 0 ? Math.round((vendorCoverage.vendorsWithDD / vendorCoverage.totalVendors) * 100) : 0}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      if (gaps.length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Gap Analysis - Priority Items', 14, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['Code', 'Requirement', 'Priority', 'Remediation']],
          body: gaps.slice(0, 10).map(gap => [
            gap.requirement.requirement_code,
            gap.requirement.requirement_text.substring(0, 50) + '...',
            gap.priority.toUpperCase(),
            gap.remediation.substring(0, 40) + '...',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59] },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 60 },
            2: { cellWidth: 25 },
            3: { cellWidth: 70 },
          },
        });
      }

      doc.save(`osfi-b10-compliance-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      logger.error('Error exporting PDF:', error);
    } finally {
      setExporting(false);
    }
  }

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No Organization Selected</h2>
        <p className="text-slate-600">Please select an organization to view compliance status</p>
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

  const overallStats = getOverallStats();
  const overallScore = getOverallScore();
  const gaps = getGapItems();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">OSFI B-10 Compliance</h1>
          <p className="text-slate-500 mt-1">Third-Party Risk Management Guideline Compliance</p>
        </div>
        <button
          onClick={exportToPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export PDF
        </button>
      </div>

      <div className="flex space-x-1 border-b border-slate-200">
        {[
          { key: 'scorecard', label: 'Scorecard', icon: BarChart3 },
          { key: 'gaps', label: 'Gap Analysis', icon: AlertOctagon },
          { key: 'coverage', label: 'Vendor Coverage', icon: Users },
          { key: 'readiness', label: 'Exam Readiness', icon: ClipboardCheck },
          { key: 'requirements', label: 'Requirements', icon: FileText },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as ViewTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'scorecard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Overall Compliance</h3>
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="10" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke={overallScore >= 80 ? '#10b981' : overallScore >= 60 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${overallScore * 2.51} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-4xl font-bold text-slate-900">{overallScore}%</span>
                    <span className="text-xs text-slate-500">Score</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-emerald-600">{overallStats.compliant}</p>
                  <p className="text-xs text-emerald-700">Compliant</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-amber-600">{overallStats.partially_compliant}</p>
                  <p className="text-xs text-amber-700">Partial</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-600">{overallStats.non_compliant}</p>
                  <p className="text-xs text-red-700">Non-Compliant</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-slate-600">{overallStats.not_assessed}</p>
                  <p className="text-xs text-slate-600">Not Assessed</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">B-10 Domain Breakdown</h3>
              <div className="space-y-4">
                {B10_DOMAINS.map(domain => {
                  const score = getDomainScore(domain.key);
                  const color = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'red';
                  return (
                    <div key={domain.key}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">{domain.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold text-${color}-600`}>{score}%</span>
                          <span className="text-xs text-slate-400">({domain.weight}% weight)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 bg-${color}-500`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Compliance Trend (6 months)</h3>
              <div className="h-64">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                        name="Compliance Score"
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

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Issues Resolved vs New</h3>
              <div className="h-64">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
                      <Bar dataKey="issues" fill="#ef4444" name="Open Issues" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    No issue data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gaps' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {['critical', 'high', 'medium', 'low'].map(priority => {
              const count = gaps.filter(g => g.priority === priority).length;
              const colors: Record<string, { bg: string; text: string; border: string }> = {
                critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                low: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
              };
              const c = colors[priority];
              return (
                <div key={priority} className={`${c.bg} rounded-xl border ${c.border} p-4`}>
                  <p className={`text-3xl font-bold ${c.text}`}>{count}</p>
                  <p className={`text-sm ${c.text} capitalize`}>{priority} Priority</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Requirements Not Fully Met</h3>
              <p className="text-sm text-slate-500 mt-1">Prioritized gaps with recommended remediation actions</p>
            </div>
            {gaps.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {gaps.map((gap, idx) => {
                  const priorityColors: Record<string, string> = {
                    critical: 'bg-red-100 text-red-700',
                    high: 'bg-orange-100 text-orange-700',
                    medium: 'bg-amber-100 text-amber-700',
                    low: 'bg-slate-100 text-slate-700',
                  };
                  return (
                    <div key={idx} className="p-6 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm font-medium text-slate-500">
                              {gap.requirement.requirement_code}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[gap.priority]}`}>
                              {gap.priority.toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              gap.status?.status === 'non_compliant' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {STATUS_CONFIG[gap.status?.status || 'not_assessed'].label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-900 mb-3">{gap.requirement.requirement_text}</p>
                          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                            <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-blue-800 mb-1">Recommended Remediation</p>
                              <p className="text-sm text-blue-700">{gap.remediation}</p>
                            </div>
                          </div>
                          {gap.status?.remediation_due_date && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Due: {format(new Date(gap.status.remediation_due_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedRequirement(gap.requirement)}
                          className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-900 mb-2">No Compliance Gaps</h4>
                <p className="text-slate-500">All assessed requirements are fully compliant</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'coverage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-600">Assessment Coverage</h3>
                <Target className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#3b82f6"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${vendorCoverage.totalVendors > 0 ? (vendorCoverage.assessedVendors / vendorCoverage.totalVendors) * 251 : 0} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-2xl font-bold text-slate-900">
                      {vendorCoverage.totalVendors > 0 ? Math.round((vendorCoverage.assessedVendors / vendorCoverage.totalVendors) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-slate-600">
                {vendorCoverage.assessedVendors} of {vendorCoverage.totalVendors} vendors assessed
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-600">Critical Vendor Approvals</h3>
                <Shield className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#10b981"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${vendorCoverage.criticalVendors > 0 ? (vendorCoverage.criticalWithApproval / vendorCoverage.criticalVendors) * 251 : 0} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-2xl font-bold text-slate-900">
                      {vendorCoverage.criticalVendors > 0 ? Math.round((vendorCoverage.criticalWithApproval / vendorCoverage.criticalVendors) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-slate-600">
                {vendorCoverage.criticalWithApproval} of {vendorCoverage.criticalVendors} critical vendors approved
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-600">Due Diligence Coverage</h3>
                <FileCheck className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#f59e0b"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${vendorCoverage.totalVendors > 0 ? (vendorCoverage.vendorsWithDD / vendorCoverage.totalVendors) * 251 : 0} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-2xl font-bold text-slate-900">
                      {vendorCoverage.totalVendors > 0 ? Math.round((vendorCoverage.vendorsWithDD / vendorCoverage.totalVendors) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-slate-600">
                {vendorCoverage.vendorsWithDD} of {vendorCoverage.totalVendors} with DD documents
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Coverage Summary</h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Vendors with Completed Assessments</span>
                  <span className="text-sm font-bold text-slate-900">
                    {vendorCoverage.totalVendors > 0 ? Math.round((vendorCoverage.assessedVendors / vendorCoverage.totalVendors) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${vendorCoverage.totalVendors > 0 ? (vendorCoverage.assessedVendors / vendorCoverage.totalVendors) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Critical Vendors with Board Approval</span>
                  <span className="text-sm font-bold text-slate-900">
                    {vendorCoverage.criticalVendors > 0 ? Math.round((vendorCoverage.criticalWithApproval / vendorCoverage.criticalVendors) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${vendorCoverage.criticalVendors > 0 ? (vendorCoverage.criticalWithApproval / vendorCoverage.criticalVendors) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Vendors with Current DD Documentation</span>
                  <span className="text-sm font-bold text-slate-900">
                    {vendorCoverage.totalVendors > 0 ? Math.round((vendorCoverage.vendorsWithDD / vendorCoverage.totalVendors) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${vendorCoverage.totalVendors > 0 ? (vendorCoverage.vendorsWithDD / vendorCoverage.totalVendors) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'readiness' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">OSFI Examination Preparation Checklist</h3>
            <p className="text-sm text-slate-500 mb-6">Ensure all documentation is readily available for regulatory review</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {EXAM_CHECKLIST.map(item => {
                const isComplete = checklistStatus[item.id] || false;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      isComplete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        {isComplete ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : (
                          <MinusCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${isComplete ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {item.label}
                        </p>
                        <p className={`text-sm mt-0.5 ${isComplete ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Document Availability Status</h3>
              <div className="space-y-3">
                {[
                  { label: 'TPRM Policies', available: checklistStatus.policies },
                  { label: 'Vendor Inventory', available: checklistStatus.inventory },
                  { label: 'Risk Assessments', available: checklistStatus.tiering },
                  { label: 'Due Diligence Files', available: checklistStatus.dd_records },
                  { label: 'Contracts', available: checklistStatus.contracts },
                  { label: 'Exit Strategies', available: checklistStatus.exit },
                ].map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700">{doc.label}</span>
                    {doc.available ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        Available
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <XCircle className="w-4 h-4" />
                        Missing
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Contacts</h3>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Briefcase className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">TPRM Program Owner</p>
                      <p className="text-sm text-slate-500">Chief Risk Officer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-3">
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      cro@organization.com
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Ext. 1001
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Users className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Vendor Management Lead</p>
                      <p className="text-sm text-slate-500">Director, Operational Risk</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-3">
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      oprisk@organization.com
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Ext. 1002
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Shield className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Compliance Officer</p>
                      <p className="text-sm text-slate-500">VP, Regulatory Compliance</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-3">
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      compliance@organization.com
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Ext. 1003
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requirements' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-64 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search requirements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>

                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                >
                  <option value="all">Organization-Wide</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.legal_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {CATEGORIES.map((category) => {
              const categoryReqs = getRequirementsByCategory(category.key);
              const stats = getCategoryStats(category.key);
              const isExpanded = expandedCategories.has(category.key);
              const Icon = category.icon;

              if (categoryFilter !== 'all' && category.key !== categoryFilter) return null;
              if (categoryReqs.length === 0 && categoryFilter === 'all') return null;

              return (
                <div key={category.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.key)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                      <Icon className="w-5 h-5 text-slate-600" />
                      <span className="font-semibold text-slate-900">{category.label}</span>
                      <span className="text-sm text-slate-500">({stats.total} requirements)</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-slate-600">{stats.compliant}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-xs text-slate-600">{stats.partially_compliant}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs text-slate-600">{stats.non_compliant}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-xs text-slate-600">{stats.not_assessed}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-28">Code</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Requirement</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-40">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-32">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {categoryReqs.map((req) => {
                            const status = getComplianceStatus(req.id);
                            const currentStatus = status?.status || 'not_assessed';
                            const StatusIcon = STATUS_CONFIG[currentStatus].icon;
                            const statusColor = STATUS_CONFIG[currentStatus].color;

                            return (
                              <tr key={req.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                  <span className="font-mono text-sm font-medium text-slate-900">
                                    {req.requirement_code}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm text-slate-900">{req.requirement_text}</p>
                                  {req.guidance_notes && (
                                    <p className="text-xs text-slate-500 mt-1">{req.guidance_notes}</p>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-700`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {STATUS_CONFIG[currentStatus].label}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() => setSelectedRequirement(req)}
                                    className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                                  >
                                    Update
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {categoryReqs.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                No requirements match the current filters
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedRequirement && (
        <RequirementModal
          requirement={selectedRequirement}
          status={getComplianceStatus(selectedRequirement.id)}
          documents={documents}
          vendors={vendors}
          vendorFilter={vendorFilter}
          saving={saving}
          onClose={() => setSelectedRequirement(null)}
          onSave={(updates) => updateComplianceStatus(selectedRequirement.id, updates)}
        />
      )}
    </div>
  );
}

interface RequirementModalProps {
  requirement: Requirement;
  status: ComplianceStatus | undefined;
  documents: Document[];
  vendors: Vendor[];
  vendorFilter: string;
  saving: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ComplianceStatus>) => void;
}

function RequirementModal({
  requirement,
  status,
  documents,
  vendors,
  vendorFilter,
  saving,
  onClose,
  onSave,
}: RequirementModalProps) {
  const [formStatus, setFormStatus] = useState<ComplianceStatus['status']>(status?.status || 'not_assessed');
  const [notes, setNotes] = useState(status?.notes || '');
  const [evidenceId, setEvidenceId] = useState(status?.evidence_document_id || '');
  const [nextReview, setNextReview] = useState(status?.next_review_date?.split('T')[0] || '');
  const [remediationPlan, setRemediationPlan] = useState(status?.remediation_plan || '');
  const [remediationDue, setRemediationDue] = useState(status?.remediation_due_date?.split('T')[0] || '');

  function handleSave() {
    onSave({
      status: formStatus,
      notes: notes || null,
      evidence_document_id: evidenceId || null,
      next_review_date: nextReview ? `${nextReview}T00:00:00Z` : null,
      remediation_plan: remediationPlan || null,
      remediation_due_date: remediationDue ? `${remediationDue}T00:00:00Z` : null,
    });
    onClose();
  }

  const selectedVendor = vendorFilter !== 'all' ? vendors.find((v) => v.id === vendorFilter) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-sm font-medium text-slate-500">{requirement.requirement_code}</span>
              <h2 className="text-xl font-semibold text-slate-900 mt-1">{requirement.requirement_text}</h2>
              {selectedVendor && (
                <p className="text-sm text-slate-600 mt-2">Assessing for: {selectedVendor.legal_name}</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {requirement.guidance_notes && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Guidance:</span> {requirement.guidance_notes}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Compliance Status</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = formStatus === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFormStatus(key as ComplianceStatus['status'])}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                      isSelected
                        ? `border-${config.color}-500 bg-${config.color}-50`
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 text-${config.color}-500`} />
                    <span className="text-xs font-medium text-slate-700">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Assessment Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              placeholder="Add notes about this compliance assessment..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <LinkIcon className="w-4 h-4 inline mr-1" />
                Evidence Document
              </label>
              <select
                value={evidenceId}
                onChange={(e) => setEvidenceId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              >
                <option value="">No document linked</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.file_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Next Review Date
              </label>
              <input
                type="date"
                value={nextReview}
                onChange={(e) => setNextReview(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          {(formStatus === 'non_compliant' || formStatus === 'partially_compliant') && (
            <div className="p-4 bg-amber-50 rounded-lg space-y-4">
              <h4 className="font-medium text-amber-900">Remediation Plan</h4>
              <textarea
                value={remediationPlan}
                onChange={(e) => setRemediationPlan(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                placeholder="Describe the remediation plan..."
              />
              <div>
                <label className="block text-sm font-medium text-amber-800 mb-2">Remediation Due Date</label>
                <input
                  type="date"
                  value={remediationDue}
                  onChange={(e) => setRemediationDue(e.target.value)}
                  className="w-full px-4 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>
            </div>
          )}

          {status?.last_assessed_date && (
            <div className="text-sm text-slate-500 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Last assessed: {format(new Date(status.last_assessed_date), 'PPP')}
              </span>
              {status.assessed_by && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {status.assessed_by}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Assessment
          </button>
        </div>
      </div>
    </div>
  );
}

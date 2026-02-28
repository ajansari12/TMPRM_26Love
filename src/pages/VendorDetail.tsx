import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { Vendor, TieringAssessment, AssessmentTaskType, OffboardingTask } from '../types';
import RiskSummaryCard from '../components/ai/RiskSummaryCard';
import FinancialRiskCard from '../components/FinancialRiskCard';
import MonitoringSignals from '../components/MonitoringSignals';
import RiskTrajectoryChart from '../components/ai/RiskTrajectoryChart';
import DocumentAnalyzer from '../components/ai/DocumentAnalyzer';
import { formatDate, getStatusColor, isValidUUID } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import {
  SERVICE_CATEGORIES,
  BUSINESS_UNITS,
  PROVIDER_TYPES,
  VENDOR_STATUSES,
} from '../lib/constants';
import { tierConfig } from '../lib/riskCalculations';
import { getAvailableTransitions, isValidTransition, STATUS_TRANSITION_DESCRIPTIONS } from '../lib/vendorStatusTransitions';
import { DEFAULT_OFFBOARDING_TASKS, CATEGORY_LABELS, STATUS_COLORS } from '../lib/offboardingChecklist';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Edit,
  Building2,
  Calculator,
  ClipboardCheck,
  FileText,
  TrendingUp,
  ShieldAlert,
  Users,
  FolderOpen,
  History,
  MapPin,
  Globe,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  Calendar,
  LogOut,
  Gauge,
  ExternalLink,
  AlertTriangle,
  FileUp,
  X,
  Settings,
} from 'lucide-react';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

interface ExitStrategyStatus {
  status: 'not_started' | 'in_progress' | 'documented' | 'tested' | 'approved';
  next_test_date: string | null;
  alternative_vendors_count: number;
}

interface SLASummary {
  total_slas: number;
  compliance_rate: number;
  recent_misses: number;
  trend: 'improving' | 'stable' | 'declining';
}

type TabType = 'overview' | 'assessments' | 'due-diligence' | 'contracts' | 'performance' | 'sla' | 'incidents' | 'subcontractors' | 'exit-strategy' | 'offboarding' | 'documents' | 'history' | 'audit';

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrganization, currentMembership } = useOrganization();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [assessments, setAssessments] = useState<TieringAssessment[]>([]);
  const [fourthPartyCount, setFourthPartyCount] = useState(0);
  const [exitStrategy, setExitStrategy] = useState<ExitStrategyStatus | null>(null);
  const [slaSummary, setSlaSummary] = useState<SLASummary | null>(null);
  const [latestAssessment, setLatestAssessment] = useState<TieringAssessment | null>(null);
  const [onboardingRequest, setOnboardingRequest] = useState<{ request_number: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showRequestReassessmentModal, setShowRequestReassessmentModal] = useState(false);
  const [reassessmentType, setReassessmentType] = useState<'material_change' | 'contract_renewal'>('material_change');
  const [reassessmentReason, setReassessmentReason] = useState('');
  const [reassessmentUrgency, setReassessmentUrgency] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [requestingReassessment, setRequestingReassessment] = useState(false);
  const [vendorContracts, setVendorContracts] = useState<any[]>([]);
  const [vendorIncidents, setVendorIncidents] = useState<any[]>([]);
  const [vendorPerformance, setVendorPerformance] = useState<any[]>([]);
  const [vendorDocuments, setVendorDocuments] = useState<any[]>([]);
  const [vendorAuditLogs, setVendorAuditLogs] = useState<any[]>([]);
  const [vendorDueDiligence, setVendorDueDiligence] = useState<any[]>([]);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const [showOffboardingConfirm, setShowOffboardingConfirm] = useState(false);
  const [offboardingTasks, setOffboardingTasks] = useState<OffboardingTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [completingOffboarding, setCompletingOffboarding] = useState(false);
  const [taskCompletionNotes, setTaskCompletionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id && currentOrganization?.id) {
      fetchVendor();
      fetchAssessments();
      fetchFourthPartyCount();
      fetchExitStrategy();
      fetchSlaSummary();
      fetchOnboardingRequest();
      fetchVendorContracts();
      fetchVendorIncidents();
      fetchVendorPerformance();
      fetchVendorDocuments();
      fetchVendorAuditLogs();
      fetchVendorDueDiligence();
    } else if (!currentOrganization?.id) {
      setLoading(false);
    }
  }, [id, currentOrganization?.id]);

  useEffect(() => {
    if (vendor && (vendor.status === 'offboarding' || vendor.status === 'terminated')) {
      fetchOffboardingTasks();
    }
  }, [vendor?.status]);

  const fetchOnboardingRequest = async () => {
    if (!currentOrganization?.id || !id) return;

    try {
      const { data, error } = await supabase
        .from('onboarding_requests')
        .select('id, request_number')
        .eq('vendor_id', id)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setOnboardingRequest(data);
      }
    } catch (error) {
      logger.error('Error fetching onboarding request:', error);
    }
  };

  const fetchVendor = async () => {
    if (!currentOrganization?.id || !id) return;

    try {
      setLoading(true);
      let query = supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      if (isValidUUID(id)) {
        query = query.eq('id', id);
      } else {
        query = query.eq('vendor_id', id.toUpperCase());
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (!data) {
        logger.error('Vendor not found');
        return;
      }

      setVendor(data);
    } catch (error) {
      logger.error('Error fetching vendor:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessments = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('tiering_assessments')
        .select('*')
        .eq('vendor_id', id)
        .order('assessment_date', { ascending: false });

      if (error) throw error;
      setAssessments(data || []);
      if (data && data.length > 0) {
        setLatestAssessment(data[0]);
      }
    } catch (error) {
      logger.error('Error fetching assessments:', error);
    }
  };

  const fetchFourthPartyCount = async () => {
    if (!currentOrganization?.id || !id) return;

    try {
      const { count, error } = await supabase
        .from('fourth_parties')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', id)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;
      setFourthPartyCount(count || 0);
    } catch (error) {
      logger.error('Error fetching fourth party count:', error);
    }
  };

  const fetchExitStrategy = async () => {
    if (!currentOrganization?.id || !id) return;

    try {
      const { data, error } = await supabase
        .from('exit_strategies')
        .select('status, next_test_date, alternative_vendors')
        .eq('vendor_id', id)
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setExitStrategy({
          status: data.status,
          next_test_date: data.next_test_date,
          alternative_vendors_count: Array.isArray(data.alternative_vendors) ? data.alternative_vendors.length : 0,
        });
      }
    } catch (error) {
      logger.error('Error fetching exit strategy:', error);
    }
  };

  const fetchSlaSummary = async () => {
    if (!currentOrganization?.id || !id) return;

    try {
      const { data: slas, error: slasError } = await supabase
        .from('vendor_slas')
        .select('id, target_value, target_unit')
        .eq('vendor_id', id)
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true);

      if (slasError) throw slasError;
      if (!slas || slas.length === 0) return;

      const { data: measurements, error: measurementsError } = await supabase
        .from('sla_measurements')
        .select('*')
        .in('sla_id', slas.map((s) => s.id))
        .order('measurement_period_end', { ascending: false });

      if (measurementsError) throw measurementsError;

      const totalMeasurements = measurements?.length || 0;
      const metCount = measurements?.filter((m) => m.target_met).length || 0;
      const complianceRate = totalMeasurements > 0 ? (metCount / totalMeasurements) * 100 : 100;

      const recentMeasurements = measurements?.slice(0, 10) || [];
      const recentMisses = recentMeasurements.filter((m) => !m.target_met).length;

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (measurements && measurements.length >= 6) {
        const recent = measurements.slice(0, 3);
        const earlier = measurements.slice(3, 6);
        const recentMetRate = recent.filter((m) => m.target_met).length / recent.length;
        const earlierMetRate = earlier.filter((m) => m.target_met).length / earlier.length;
        if (recentMetRate > earlierMetRate + 0.1) trend = 'improving';
        else if (recentMetRate < earlierMetRate - 0.1) trend = 'declining';
      }

      setSlaSummary({
        total_slas: slas.length,
        compliance_rate: complianceRate,
        recent_misses: recentMisses,
        trend,
      });
    } catch (error) {
      logger.error('Error fetching SLA summary:', error);
    }
  };

  const fetchVendorContracts = async () => {
    if (!currentOrganization?.id || !id) return;
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false });
    setVendorContracts(data || []);
  };

  const fetchVendorIncidents = async () => {
    if (!currentOrganization?.id || !id) return;
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('vendor_id', id)
      .order('reported_date', { ascending: false });
    setVendorIncidents(data || []);
  };

  const fetchVendorPerformance = async () => {
    if (!currentOrganization?.id || !id) return;
    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .eq('vendor_id', id)
      .order('review_period_end', { ascending: false });
    setVendorPerformance(data || []);
  };

  const fetchVendorDocuments = async () => {
    if (!currentOrganization?.id || !id) return;
    const { data } = await supabase
      .from('vendor_documents')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .eq('vendor_id', id)
      .order('created_at', { ascending: false });
    setVendorDocuments(data || []);
  };

  const fetchVendorAuditLogs = async () => {
    if (!currentOrganization?.id || !id) return;
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .ilike('notes', `%${id}%`)
      .order('timestamp', { ascending: false })
      .limit(50);
    setVendorAuditLogs(data || []);
  };

  const fetchVendorDueDiligence = async () => {
    if (!currentOrganization?.id || !id) return;
    const { data } = await supabase
      .from('due_diligence_document_requests')
      .select('*, document_type:due_diligence_document_types(name)')
      .eq('organization_id', currentOrganization.id)
      .eq('vendor_id', id)
      .order('created_at', { ascending: false });
    setVendorDueDiligence(data || []);
  };

  const fetchOffboardingTasks = async () => {
    if (!currentOrganization?.id || !id) return;

    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('offboarding_tasks')
        .select(`
          *,
          completed_by_user:completed_by(id, full_name, email)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('vendor_id', id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setOffboardingTasks(data || []);
    } catch (error) {
      logger.error('Error fetching offboarding tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleStartReassessment = async () => {
    if (!vendor || !currentOrganization) return;

    try {
      await supabase
        .from('vendors')
        .update({ status: 'under_review' })
        .eq('id', vendor.id);

      const latestAssessment = assessments[0];
      const queryParams = new URLSearchParams();
      queryParams.set('type', 'periodic_review');
      if (latestAssessment) {
        queryParams.set('previousAssessmentId', latestAssessment.id);
      }

      navigate(`/vendors/${vendor.id}/assess?${queryParams.toString()}`);
    } catch (error) {
      logger.error('Error starting reassessment:', error);
    }
  };

  const handleRequestReassessment = async () => {
    if (!vendor || !currentOrganization || !reassessmentReason.trim()) return;

    setRequestingReassessment(true);
    try {
      const dueDate = new Date();
      if (reassessmentUrgency === 'urgent') {
        dueDate.setDate(dueDate.getDate() + 3);
      } else if (reassessmentUrgency === 'high') {
        dueDate.setDate(dueDate.getDate() + 7);
      } else {
        dueDate.setDate(dueDate.getDate() + 14);
      }

      await supabase.from('assessment_tasks').insert({
        organization_id: currentOrganization.id,
        vendor_id: vendor.id,
        task_type: reassessmentType,
        status: 'pending',
        priority: reassessmentUrgency,
        assigned_defense_line: '1b',
        due_date: dueDate.toISOString().split('T')[0],
        trigger_reason: reassessmentReason,
        notes: `${reassessmentType === 'material_change' ? 'Material change' : 'Contract renewal'} reassessment requested for ${vendor.legal_name}. Reason: ${reassessmentReason}`,
      });

      await supabase.from('notifications').insert({
        organization_id: currentOrganization.id,
        type: 'reassessment_requested',
        title: `Reassessment Requested: ${vendor.legal_name}`,
        message: `A ${reassessmentType === 'material_change' ? 'material change' : 'contract renewal'} reassessment has been requested. Priority: ${reassessmentUrgency}.`,
        priority: reassessmentUrgency === 'urgent' ? 'critical' : reassessmentUrgency === 'high' ? 'high' : 'medium',
        related_entity_type: 'vendor',
        related_entity_id: vendor.id,
        action_url: '/assessments/reassessments',
        target_role: 'risk_manager',
      });

      setShowRequestReassessmentModal(false);
      setReassessmentReason('');
      setReassessmentType('material_change');
      setReassessmentUrgency('normal');
    } catch (error) {
      logger.error('Error requesting reassessment:', error);
    } finally {
      setRequestingReassessment(false);
    }
  };

  const handleStatusChange = async () => {
    if (!vendor || !currentOrganization || !newStatus || !statusChangeReason.trim() || !user) return;

    if (!isValidTransition(vendor.status, newStatus)) {
      toast.error('Invalid status transition', {
        description: `Cannot transition from ${vendor.status} to ${newStatus}`
      });
      return;
    }

    if (newStatus === 'terminated') {
      const { data: tasks } = await supabase
        .from('offboarding_tasks')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('organization_id', currentOrganization.id);

      const requiredTasks = tasks?.filter(t => t.is_required) || [];
      const incompleteTasks = requiredTasks.filter(
        t => t.status !== 'completed' && t.status !== 'not_applicable'
      );

      if (incompleteTasks.length > 0) {
        toast.error('Cannot terminate vendor', {
          description: 'Please complete the offboarding checklist first.'
        });
        return;
      }
    }

    if (newStatus === 'offboarding' && !showOffboardingConfirm) {
      setShowOffboardingConfirm(true);
      return;
    }

    setChangingStatus(true);
    try {
      const previousStatus = vendor.status;

      const { error: updateError } = await supabase
        .from('vendors')
        .update({ status: newStatus })
        .eq('id', vendor.id);

      if (updateError) throw updateError;

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          organization_id: currentOrganization.id,
          user_id: user.id,
          action: 'status_change',
          entity_type: 'vendor',
          entity_id: vendor.id,
          changes: {
            from: previousStatus,
            to: newStatus
          },
          notes: statusChangeReason
        });

      if (auditError) throw auditError;

      if (newStatus === 'offboarding') {
        const { data: existingTasks } = await supabase
          .from('offboarding_tasks')
          .select('id')
          .eq('vendor_id', vendor.id)
          .eq('organization_id', currentOrganization.id)
          .limit(1);

        if (!existingTasks || existingTasks.length === 0) {
          const tasksToInsert = DEFAULT_OFFBOARDING_TASKS.map(task => ({
            organization_id: currentOrganization.id,
            vendor_id: vendor.id,
            task_name: task.task_name,
            task_category: task.task_category,
            description: task.description,
            is_required: task.is_required,
            sort_order: task.sort_order,
            status: 'pending' as const,
          }));

          const { error: tasksError } = await supabase
            .from('offboarding_tasks')
            .insert(tasksToInsert);

          if (tasksError) throw tasksError;

          await supabase.from('audit_logs').insert({
            organization_id: currentOrganization.id,
            user_id: user.id,
            action: 'offboarding_initiated',
            entity_type: 'vendor',
            entity_id: vendor.id,
            notes: `Offboarding checklist created with ${tasksToInsert.length} tasks`
          });

          toast.success('Offboarding initiated', {
            description: 'Complete the exit checklist to terminate this vendor'
          });
        }
      }

      toast.success('Status updated successfully', {
        description: `Vendor status changed from ${VENDOR_STATUSES.find(s => s.value === previousStatus)?.label} to ${VENDOR_STATUSES.find(s => s.value === newStatus)?.label}`
      });

      setShowStatusChange(false);
      setNewStatus('');
      setStatusChangeReason('');
      setShowOffboardingConfirm(false);

      await fetchVendor();
      await fetchVendorAuditLogs();
    } catch (error) {
      logger.error('Error changing status:', error);
      toast.error('Failed to change status', {
        description: 'Please try again or contact support'
      });
    } finally {
      setChangingStatus(false);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newTaskStatus: string, completionNotes?: string) => {
    if (!currentOrganization || !user) return;

    setUpdatingTaskId(taskId);
    try {
      const updateData: any = { status: newTaskStatus };

      if (newTaskStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user.id;
        updateData.completion_notes = completionNotes || null;
      }

      const { error } = await supabase
        .from('offboarding_tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      const task = offboardingTasks.find(t => t.id === taskId);
      if (task) {
        await supabase.from('audit_logs').insert({
          organization_id: currentOrganization.id,
          user_id: user.id,
          action: 'offboarding_task_completed',
          entity_type: 'offboarding_task',
          entity_id: taskId,
          notes: `Task "${task.task_name}" marked as ${newTaskStatus}`
        });
      }

      toast.success('Task updated');
      await fetchOffboardingTasks();
    } catch (error) {
      logger.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleCompleteOffboarding = async () => {
    if (!vendor || !currentOrganization || !user) return;

    setCompletingOffboarding(true);
    try {
      const { error: vendorError } = await supabase
        .from('vendors')
        .update({
          status: 'terminated',
          termination_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', vendor.id);

      if (vendorError) throw vendorError;

      const completedTasks = offboardingTasks.filter(t => t.status === 'completed').length;
      const naTask = offboardingTasks.filter(t => t.status === 'not_applicable').length;

      await supabase.from('audit_logs').insert({
        organization_id: currentOrganization.id,
        user_id: user.id,
        action: 'vendor_terminated',
        entity_type: 'vendor',
        entity_id: vendor.id,
        notes: `Vendor offboarding completed. ${completedTasks} tasks completed, ${naTask} marked as N/A.`
      });

      toast.success('Vendor relationship terminated successfully');
      setShowTerminationModal(false);
      await fetchVendor();
    } catch (error) {
      logger.error('Error completing offboarding:', error);
      toast.error('Failed to complete offboarding');
    } finally {
      setCompletingOffboarding(false);
    }
  };

  const calculateOffboardingProgress = () => {
    if (offboardingTasks.length === 0) return { percentage: 0, completed: 0, total: 0 };

    const requiredTasks = offboardingTasks.filter(t => t.is_required);
    const completedTasks = requiredTasks.filter(
      t => t.status === 'completed' || t.status === 'not_applicable'
    );

    return {
      percentage: (completedTasks.length / requiredTasks.length) * 100,
      completed: completedTasks.length,
      total: requiredTasks.length
    };
  };

  const canCompleteOffboarding = () => {
    const requiredTasks = offboardingTasks.filter(t => t.is_required);
    return requiredTasks.every(t => t.status === 'completed' || t.status === 'not_applicable');
  };

  const getScoreChangeIndicator = (current: number | undefined, previous: number | undefined) => {
    if (!current || !previous) return null;
    const change = ((current - previous) / previous) * 100;
    const isSignificant = Math.abs(change) > 20;

    if (change > 0) {
      return (
        <span className={`inline-flex items-center text-sm ${isSignificant ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
          <ArrowUpRight className="w-4 h-4 mr-1" />
          +{change.toFixed(1)}%
          {isSignificant && <span className="ml-1 text-xs">(significant)</span>}
        </span>
      );
    } else if (change < 0) {
      return (
        <span className={`inline-flex items-center text-sm ${isSignificant ? 'text-green-600 font-medium' : 'text-emerald-600'}`}>
          <ArrowDownRight className="w-4 h-4 mr-1" />
          {change.toFixed(1)}%
          {isSignificant && <span className="ml-1 text-xs">(significant)</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-sm text-slate-500">
        <Minus className="w-4 h-4 mr-1" />
        No change
      </span>
    );
  };

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          No Organization Selected
        </h2>
        <p className="text-slate-600">
          Please select or register an organization to view vendor details
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-slate-200 rounded animate-pulse" />
        </div>
        <CardSkeleton count={3} />
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <TableSkeleton rows={4} cols={3} />
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="mb-6">
          <Link
            to="/vendors"
            className="flex items-center text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Vendors
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Vendor Not Found</h2>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              The vendor you're looking for could not be found. Please check the vendor ID and try again.
            </p>
            <div className="flex justify-center space-x-3">
              <Link
                to="/vendors"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Back to Vendors
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCriticalOrHighTier = vendor.tier && (vendor.tier.includes('5') || vendor.tier.includes('4'));

  const getReassessmentStatus = () => {
    if (!vendor.next_review_date) return null;
    const reviewDate = new Date(vendor.next_review_date);
    const now = new Date();
    const daysUntilReview = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilReview < 0) {
      return { text: `${Math.abs(daysUntilReview)} days overdue`, color: 'text-red-600', isOverdue: true };
    } else if (daysUntilReview <= 7) {
      return { text: `Due in ${daysUntilReview} days`, color: 'text-orange-600', isOverdue: false };
    } else if (daysUntilReview <= 30) {
      return { text: `Due in ${daysUntilReview} days`, color: 'text-amber-600', isOverdue: false };
    }
    return null;
  };

  const reassessmentStatus = getReassessmentStatus();

  const baseTabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'assessments', label: 'Risk Assessments', icon: Calculator },
    { id: 'history', label: 'Assessment History', icon: Clock },
    { id: 'due-diligence', label: 'Due Diligence', icon: ClipboardCheck },
    { id: 'contracts', label: 'Contracts', icon: FileText },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'sla', label: 'SLA Tracking', icon: Gauge, slaCount: slaSummary?.total_slas },
    { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
    { id: 'subcontractors', label: 'Fourth Parties', icon: Users, count: fourthPartyCount },
  ];

  const exitStrategyTab = { id: 'exit-strategy', label: 'Exit Strategy', icon: LogOut, status: exitStrategy?.status };

  const offboardingTab = { id: 'offboarding', label: 'Offboarding', icon: LogOut };

  const endTabs = [
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'audit', label: 'Audit Log', icon: History },
  ];

  const isOffboarding = vendor.status === 'offboarding' || vendor.status === 'terminated';

  let tabs = [...baseTabs];
  if (isCriticalOrHighTier) {
    tabs.push(exitStrategyTab);
  }
  if (isOffboarding) {
    tabs.push(offboardingTab);
  }
  tabs = [...tabs, ...endTabs];

  const tierInfo = vendor.tier ? tierConfig[vendor.tier] : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/vendors')}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vendors
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900">{vendor.legal_name}</h1>
              {tierInfo && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${tierInfo.bgClass}`}>
                  Tier {vendor.tier?.charAt(5)} - {tierInfo.label}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${getStatusColor(vendor.status)}-100 text-${getStatusColor(vendor.status)}-800`}>
                {VENDOR_STATUSES.find((s) => s.value === vendor.status)?.label}
              </span>
            </div>
            <p className="text-slate-600">Vendor ID: {vendor.vendor_id}</p>
            {vendor.trading_name && (
              <p className="text-slate-600 text-sm">Trading as: {vendor.trading_name}</p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {vendor.tier && (
              <>
                <button
                  onClick={handleStartReassessment}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reassess</span>
                </button>
                <button
                  onClick={() => setShowRequestReassessmentModal(true)}
                  className="px-4 py-2 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors flex items-center space-x-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Request Review</span>
                </button>
              </>
            )}
            <Link
              to={`/vendors/${vendor.id}/edit`}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-2"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Reassessment Due Banner */}
      {reassessmentStatus && (
        <div className={`mb-6 rounded-lg border-2 p-4 ${reassessmentStatus.isOverdue ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg ${reassessmentStatus.isOverdue ? 'bg-red-100' : 'bg-amber-100'}`}>
                <RefreshCw className={`w-6 h-6 ${reassessmentStatus.isOverdue ? 'text-red-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <h3 className={`font-semibold ${reassessmentStatus.isOverdue ? 'text-red-900' : 'text-amber-900'}`}>
                  Periodic Reassessment {reassessmentStatus.isOverdue ? 'Overdue' : 'Due Soon'}
                </h3>
                <p className={`text-sm mt-1 ${reassessmentStatus.isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                  {reassessmentStatus.text}. {tierInfo?.reviewFrequency ? `${tierInfo.reviewFrequency} reviews are required for ${tierInfo.label} vendors.` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={handleStartReassessment}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                reassessmentStatus.isOverdue
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Start Reassessment
            </button>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 mb-1">Risk Profile</p>
          {vendor.risk_rating ? (
            <>
              <p className="text-2xl font-bold text-slate-900">{vendor.risk_rating.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">
                Impact: {vendor.impact_score?.toFixed(2)} × Likelihood: {vendor.likelihood_score?.toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Not assessed</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 mb-1">Lifecycle Stage</p>
          <p className="text-lg font-semibold text-slate-900 capitalize">
            {vendor.lifecycle_stage.replace('_', ' ')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 mb-1">Contract Status</p>
          {vendor.has_formal_contract ? (
            <>
              <div className="flex items-center text-emerald-600">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">Active Contract</span>
              </div>
              {vendor.contract_end_date && (
                <p className="text-xs text-slate-500 mt-1">
                  Expires: {formatDate(vendor.contract_end_date)}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center text-amber-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">No Contract</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 mb-1">Next Review</p>
          {vendor.next_review_date ? (
            <>
              <p className="text-lg font-semibold text-slate-900">
                {formatDate(vendor.next_review_date)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {tierInfo?.reviewFrequency && `${tierInfo.reviewFrequency} reviews`}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Not scheduled</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-slate-200">
          <nav className="flex space-x-1 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const tabCount = 'count' in tab ? (tab as { count: number }).count : undefined;
              const tabSlaCount = 'slaCount' in tab ? (tab as { slaCount: number }).slaCount : undefined;
              const tabStatus = 'status' in tab ? (tab as { status: string }).status : undefined;
              const exitStatusColors: Record<string, string> = {
                not_started: 'bg-slate-200 text-slate-600',
                in_progress: 'bg-blue-100 text-blue-700',
                documented: 'bg-amber-100 text-amber-700',
                tested: 'bg-emerald-100 text-emerald-700',
                approved: 'bg-green-100 text-green-700',
              };
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tabCount !== undefined && tabCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-slate-200 text-slate-700">
                      {tabCount}
                    </span>
                  )}
                  {tabSlaCount !== undefined && tabSlaCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      {tabSlaCount}
                    </span>
                  )}
                  {tabStatus && (
                    <span className={`ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full ${exitStatusColors[tabStatus] || exitStatusColors.not_started}`}>
                      {tabStatus === 'not_started' ? 'New' : tabStatus.replace('_', ' ')}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Risk Assessment Section */}
              {latestAssessment && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Current Risk Assessment</h3>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-slate-600">Status:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(vendor.status)}-100 text-${getStatusColor(vendor.status)}-800`}>
                            {VENDOR_STATUSES.find((s) => s.value === vendor.status)?.label}
                          </span>
                          {(currentMembership?.defense_line === '1b' ||
                            currentMembership?.defense_line === '2nd' ||
                            currentMembership?.defense_line === 'admin') && (
                            <button
                              onClick={() => {
                                setShowStatusChange(true);
                                setNewStatus('');
                                setStatusChangeReason('');
                                setShowOffboardingConfirm(false);
                              }}
                              className="ml-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="Change Status"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {vendor.last_review_date && (
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="text-slate-600">Last Assessed:</span>
                            <span className="font-medium text-slate-900">{formatDate(vendor.last_review_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 mt-2">
                      {tierInfo && (
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-slate-600">Tier:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierInfo.bgClass}`}>
                            {tierInfo.label}
                          </span>
                        </div>
                      )}
                      {vendor.next_review_date && (
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-slate-600">Next Review:</span>
                          <span className={`font-medium ${reassessmentStatus?.isOverdue ? 'text-red-600' : reassessmentStatus ? 'text-amber-600' : 'text-slate-900'}`}>
                            {formatDate(vendor.next_review_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Risk Scores</h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-600">Impact</span>
                            <span className="font-medium text-slate-900">{vendor.impact_score?.toFixed(1)} / 5.0</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div
                              className="bg-slate-700 h-2.5 rounded-full transition-all"
                              style={{ width: `${((vendor.impact_score || 0) / 5) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 text-right">
                            {(((vendor.impact_score || 0) / 5) * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-600">Likelihood</span>
                            <span className="font-medium text-slate-900">{vendor.likelihood_score?.toFixed(1)} / 5.0</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div
                              className="bg-slate-600 h-2.5 rounded-full transition-all"
                              style={{ width: `${((vendor.likelihood_score || 0) / 5) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 text-right">
                            {(((vendor.likelihood_score || 0) / 5) * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-600">Inherent Risk</span>
                            <span className="font-medium text-slate-900">{vendor.risk_rating?.toFixed(2)} / 25</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full transition-all ${
                                (vendor.risk_rating || 0) >= 15 ? 'bg-red-500' :
                                (vendor.risk_rating || 0) >= 10 ? 'bg-orange-500' :
                                (vendor.risk_rating || 0) >= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${((vendor.risk_rating || 0) / 25) * 100}%` }}
                            />
                          </div>
                        </div>
                        {(vendor as Record<string, unknown>).control_effectiveness_score != null && (vendor as Record<string, unknown>).control_effectiveness_score! > 0 && (
                          <>
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-600">Control Effectiveness</span>
                                <span className="font-medium text-emerald-700">{(vendor as Record<string, unknown>).control_effectiveness_score as number}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2.5">
                                <div
                                  className="bg-emerald-500 h-2.5 rounded-full transition-all"
                                  style={{ width: `${(vendor as Record<string, unknown>).control_effectiveness_score as number}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-600 font-medium">Residual Risk</span>
                                <span className="font-bold text-slate-900">
                                  {((vendor as Record<string, unknown>).residual_risk_rating as number)?.toFixed(2) ?? vendor.risk_rating?.toFixed(2)} / 25
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full transition-all ${
                                    (((vendor as Record<string, unknown>).residual_risk_rating as number) || 0) >= 15 ? 'bg-red-500' :
                                    (((vendor as Record<string, unknown>).residual_risk_rating as number) || 0) >= 10 ? 'bg-orange-500' :
                                    (((vendor as Record<string, unknown>).residual_risk_rating as number) || 0) >= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${((((vendor as Record<string, unknown>).residual_risk_rating as number) || 0) / 25) * 100}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs text-emerald-600 font-medium">
                                  {Math.round(((vendor.risk_rating || 0) - (((vendor as Record<string, unknown>).residual_risk_rating as number) || 0)) / (vendor.risk_rating || 1) * 100)}% risk reduction from controls
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                        {(vendor as Record<string, unknown>).esg_score != null && ((vendor as Record<string, unknown>).esg_score as number) > 0 && (
                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-slate-600">ESG Score</span>
                              <span className={`font-medium ${
                                ((vendor as Record<string, unknown>).esg_score as number) >= 3.5 ? 'text-red-600' :
                                ((vendor as Record<string, unknown>).esg_score as number) >= 2.5 ? 'text-amber-600' : 'text-emerald-600'
                              }`}>{((vendor as Record<string, unknown>).esg_score as number)?.toFixed(1)} / 5.0</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full transition-all ${
                                  ((vendor as Record<string, unknown>).esg_score as number) >= 3.5 ? 'bg-red-400' :
                                  ((vendor as Record<string, unknown>).esg_score as number) >= 2.5 ? 'bg-amber-400' : 'bg-emerald-400'
                                }`}
                                style={{ width: `${((((vendor as Record<string, unknown>).esg_score as number) || 0) / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Risk Summary */}
                    <div className="mt-4">
                      <RiskSummaryCard
                        vendorId={vendor.id}
                        vendorData={{
                          legal_name: vendor.legal_name,
                          service_category: vendor.service_category,
                          provider_type: vendor.provider_type,
                          tier: vendor.tier,
                          risk_rating: vendor.risk_rating,
                          impact_score: vendor.impact_score,
                          likelihood_score: vendor.likelihood_score,
                          is_critical: vendor.is_critical,
                          status: vendor.status,
                          country: vendor.country,
                          contract_value_cad: vendor.contract_value_cad,
                          handles_sensitive_data: vendor.handles_sensitive_data,
                          has_system_access: vendor.has_system_access,
                        }}
                      />
                    </div>

                    {/* Financial Risk Estimate */}
                    <div className="mt-4">
                      <FinancialRiskCard
                        vendor={{
                          tier: vendor.tier,
                          contract_value_cad: vendor.contract_value_cad,
                          service_category: vendor.service_category,
                          handles_sensitive_data: vendor.handles_sensitive_data,
                          is_critical: vendor.is_critical,
                          has_system_access: vendor.has_system_access,
                          data_access_level: vendor.data_access_level,
                        }}
                      />
                    </div>

                    {/* Monitoring Signals */}
                    <div className="mt-4">
                      <MonitoringSignals vendorId={vendor.id} vendorName={vendor.legal_name} />
                    </div>

                    {/* Risk Trajectory */}
                    <div className="mt-4">
                      <RiskTrajectoryChart
                        vendorId={vendor.id}
                        vendorName={vendor.legal_name}
                        currentRiskRating={vendor.risk_rating}
                        assessmentHistory={assessments?.map(a => ({
                          date: a.assessment_date || a.created_at,
                          risk_rating: a.risk_rating || 0,
                        })).filter(a => a.risk_rating > 0) || []}
                      />
                    </div>

                    {/* Document Analyzer */}
                    <div className="mt-4">
                      <DocumentAnalyzer vendorId={vendor.id} vendorName={vendor.legal_name} />
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-2">
                      <div className="flex items-center text-sm">
                        <span className="text-slate-600 w-32">Assessment Source:</span>
                        {onboardingRequest ? (
                          <Link
                            to={`/onboarding/${onboardingRequest.id}`}
                            className="font-medium text-slate-900 hover:text-slate-600 flex items-center"
                          >
                            Onboarding Request #{onboardingRequest.request_number}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Link>
                        ) : latestAssessment.assessment_type === 'periodic_review' ? (
                          <span className="font-medium text-slate-900">
                            Periodic Reassessment on {latestAssessment.assessment_date && formatDate(latestAssessment.assessment_date)}
                          </span>
                        ) : (
                          <span className="font-medium text-slate-900">
                            {latestAssessment.assessment_type === 'initial' ? 'Initial Assessment' :
                             latestAssessment.assessment_type === 'triggered' ? 'Triggered Review' :
                             latestAssessment.assessment_type === 'renewal' ? 'Contract Renewal' : 'Assessment'}
                          </span>
                        )}
                      </div>
                      {latestAssessment.assessor_name && (
                        <div className="flex items-center text-sm">
                          <span className="text-slate-600 w-32">Assessed by:</span>
                          <span className="font-medium text-slate-900">{latestAssessment.assessor_name}</span>
                        </div>
                      )}
                      {(latestAssessment as TieringAssessment & { validator_name?: string; validated_at?: string }).validator_name && (
                        <div className="flex items-center text-sm">
                          <span className="text-slate-600 w-32">Validated by:</span>
                          <span className="font-medium text-slate-900">
                            {(latestAssessment as TieringAssessment & { validator_name?: string; validated_at?: string }).validator_name}
                            {(latestAssessment as TieringAssessment & { validator_name?: string; validated_at?: string }).validated_at && (
                              <span className="text-slate-500 font-normal"> on {formatDate((latestAssessment as TieringAssessment & { validated_at?: string }).validated_at!)}</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 pt-4 border-t border-slate-200 mt-4">
                      <button
                        onClick={() => setActiveTab('assessments')}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
                      >
                        View Full Assessment Details
                      </button>
                      <button
                        onClick={handleStartReassessment}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium flex items-center space-x-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Start Reassessment</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Company Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Company Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Legal Name</p>
                    <p className="font-medium text-slate-900">{vendor.legal_name}</p>
                  </div>
                  {vendor.trading_name && (
                    <div>
                      <p className="text-sm text-slate-600">Trading Name</p>
                      <p className="font-medium text-slate-900">{vendor.trading_name}</p>
                    </div>
                  )}
                  {vendor.description && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-600">Description</p>
                      <p className="text-slate-900">{vendor.description}</p>
                    </div>
                  )}
                  {(vendor.street_address || vendor.city) && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-600 mb-1">Address</p>
                      <div className="flex items-start text-slate-900">
                        <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          {vendor.street_address && <p>{vendor.street_address}</p>}
                          {vendor.suite_unit && <p>{vendor.suite_unit}</p>}
                          <p>
                            {vendor.city && vendor.city}
                            {vendor.province_state && `, ${vendor.province_state}`}
                            {vendor.postal_code && ` ${vendor.postal_code}`}
                          </p>
                          <p>{vendor.country}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {vendor.website && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Website</p>
                      <a
                        href={vendor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-slate-900 hover:text-slate-600"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        {vendor.website}
                      </a>
                    </div>
                  )}
                  {vendor.number_of_employees && (
                    <div>
                      <p className="text-sm text-slate-600">Number of Employees</p>
                      <p className="font-medium text-slate-900">{vendor.number_of_employees.toLocaleString()}</p>
                    </div>
                  )}
                  {vendor.years_in_operation && (
                    <div>
                      <p className="text-sm text-slate-600">Years in Operation</p>
                      <p className="font-medium text-slate-900">{vendor.years_in_operation}</p>
                    </div>
                  )}
                  {vendor.lei && (
                    <div>
                      <p className="text-sm text-slate-600">LEI</p>
                      <p className="font-medium text-slate-900">{vendor.lei}</p>
                    </div>
                  )}
                  {vendor.ultimate_parent_name && (
                    <div>
                      <p className="text-sm text-slate-600">Ultimate Parent</p>
                      <p className="font-medium text-slate-900">{vendor.ultimate_parent_name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Primary Contact</h3>
                <div className="grid grid-cols-2 gap-4">
                  {vendor.primary_contact_name && (
                    <div>
                      <p className="text-sm text-slate-600">Name</p>
                      <p className="font-medium text-slate-900">{vendor.primary_contact_name}</p>
                    </div>
                  )}
                  {vendor.primary_contact_email && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Email</p>
                      <a
                        href={`mailto:${vendor.primary_contact_email}`}
                        className="flex items-center text-slate-900 hover:text-slate-600"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {vendor.primary_contact_email}
                      </a>
                    </div>
                  )}
                  {vendor.primary_contact_phone && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Phone</p>
                      <a
                        href={`tel:${vendor.primary_contact_phone}`}
                        className="flex items-center text-slate-900 hover:text-slate-600"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        {vendor.primary_contact_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Details */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Service Classification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Service Category</p>
                    <p className="font-medium text-slate-900">
                      {SERVICE_CATEGORIES.find((c) => c.value === vendor.service_category)?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Provider Type</p>
                    <p className="font-medium text-slate-900">
                      {PROVIDER_TYPES.find((p) => p.value === vendor.provider_type)?.label}
                    </p>
                  </div>
                  {vendor.service_description && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-600">Service Description</p>
                      <p className="text-slate-900">{vendor.service_description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Ownership */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Internal Ownership</h3>
                <div className="grid grid-cols-2 gap-4">
                  {vendor.responsible_officer && (
                    <div>
                      <p className="text-sm text-slate-600">Responsible Officer</p>
                      <p className="font-medium text-slate-900">{vendor.responsible_officer}</p>
                    </div>
                  )}
                  {vendor.business_unit && (
                    <div>
                      <p className="text-sm text-slate-600">Business Unit</p>
                      <p className="font-medium text-slate-900">
                        {BUSINESS_UNITS.find((b) => b.value === vendor.business_unit)?.label}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {vendor.notes && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Notes</h3>
                  <p className="text-slate-700 whitespace-pre-wrap">{vendor.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Risk Assessments Tab */}
          {activeTab === 'assessments' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Risk Assessments</h3>
                {assessments.length > 0 && (
                  <button
                    onClick={handleStartReassessment}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Start Reassessment</span>
                  </button>
                )}
              </div>

              {assessments.length === 0 ? (
                <div className="text-center py-12">
                  <Calculator className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-slate-900 mb-2">No Risk Assessments</h4>
                  <p className="text-slate-600 mb-4 max-w-md mx-auto">
                    Risk assessments are typically completed during the onboarding process.
                    If this vendor was bulk imported, you may need to complete an initial assessment.
                  </p>
                  <Link
                    to={`/vendors/${vendor.id}/assess`}
                    className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                  >
                    Start Assessment
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {assessments.map((assessment, index) => {
                    const tierInfo = assessment.calculated_tier && tierConfig[assessment.calculated_tier];
                    const previousAssessment = assessments[index + 1];
                    const statusColors = {
                      draft: 'bg-slate-100 text-slate-800',
                      completed: 'bg-emerald-100 text-emerald-800',
                      under_review: 'bg-amber-100 text-amber-800',
                      approved: 'bg-blue-100 text-blue-800',
                    };
                    const isOnboardingAssessment = assessment.assessment_type === 'initial' && index === assessments.length - 1;
                    const assessmentTypeLabels: Record<string, string> = {
                      initial: isOnboardingAssessment ? 'Onboarding Assessment' : 'Initial Assessment',
                      periodic_review: 'Periodic Review',
                      triggered: 'Triggered Review',
                      renewal: 'Contract Renewal',
                      reassessment: 'Reassessment',
                    };

                    return (
                      <div key={assessment.id} className="border border-slate-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-slate-900">
                                {assessment.assessment_id}
                              </h4>
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600">
                                {assessmentTypeLabels[assessment.assessment_type] || assessment.assessment_type}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600">
                              {assessment.assessment_date && formatDate(assessment.assessment_date)}
                            </p>
                          </div>
                          <span className={`px-3 py-1 text-xs font-medium rounded ${statusColors[assessment.status as keyof typeof statusColors] || statusColors.draft}`}>
                            {assessment.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-slate-600">Tier</p>
                            {tierInfo && (
                              <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded border ${tierInfo.bgClass}`}>
                                {tierInfo.label}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">Risk Rating</p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">
                              {assessment.risk_rating?.toFixed(2)}
                            </p>
                            {previousAssessment && getScoreChangeIndicator(assessment.risk_rating, previousAssessment.risk_rating)}
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">Impact Score</p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">
                              {assessment.impact_score?.toFixed(2)}
                            </p>
                            {previousAssessment && getScoreChangeIndicator(assessment.impact_score, previousAssessment.impact_score)}
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">Likelihood Score</p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">
                              {assessment.likelihood_score?.toFixed(2)}
                            </p>
                            {previousAssessment && getScoreChangeIndicator(assessment.likelihood_score, previousAssessment.likelihood_score)}
                          </div>
                        </div>

                        {(assessment as TieringAssessment & { tier_change_justification?: string }).tier_change_justification && (
                          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm font-medium text-amber-800 mb-1">Tier Change Justification</p>
                            <p className="text-sm text-amber-700">{(assessment as TieringAssessment & { tier_change_justification?: string }).tier_change_justification}</p>
                          </div>
                        )}

                        {assessment.assessor_name && (
                          <div className="pt-4 border-t border-slate-200">
                            <p className="text-sm text-slate-600">
                              Assessed by: <span className="text-slate-900 font-medium">{assessment.assessor_name}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Due Diligence Tab */}
          {activeTab === 'due-diligence' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Due Diligence Documents</h3>
                <Link to="/due-diligence" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm">
                  View All Due Diligence
                </Link>
              </div>
              {vendorDueDiligence.length > 0 ? (
                <div className="space-y-3">
                  {vendorDueDiligence.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{(doc.document_type as any)?.name || doc.document_type_code}</p>
                        <p className="text-sm text-slate-500">Status: {doc.status?.replace('_', ' ')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.is_critical && <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">Critical</span>}
                        <span className="text-sm text-slate-500">{doc.due_date ? new Date(doc.due_date).toLocaleDateString() : 'No due date'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClipboardCheck className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No due diligence documents for this vendor</p>
                </div>
              )}
            </div>
          )}

          {/* Contracts Tab */}
          {activeTab === 'contracts' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Contracts</h3>
                <Link to="/contracts" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm">
                  View Contract Register
                </Link>
              </div>
              {vendorContracts.length > 0 ? (
                <div className="space-y-3">
                  {vendorContracts.map((contract) => (
                    <Link key={contract.id} to={`/contracts/${contract.id}`} className="block p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{contract.title}</p>
                          <p className="text-sm text-slate-500">{contract.contract_type || 'No type'} • {contract.contract_number || 'No number'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${contract.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {contract.status?.replace('_', ' ')}
                          </span>
                          {contract.annual_value_cad && <p className="text-sm text-slate-500 mt-1">${contract.annual_value_cad.toLocaleString()} CAD</p>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No contracts on file for this vendor</p>
                </div>
              )}
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Performance Reviews</h3>
                <Link to="/performance" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm">
                  View All Reviews
                </Link>
              </div>
              {vendorPerformance.length > 0 ? (
                <div className="space-y-3">
                  {vendorPerformance.map((review) => (
                    <div key={review.id} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{review.review_type || 'Performance Review'}</p>
                          <p className="text-sm text-slate-500">
                            {review.review_period_start ? new Date(review.review_period_start).toLocaleDateString() : ''} - {review.review_period_end ? new Date(review.review_period_end).toLocaleDateString() : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${review.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {review.status?.replace('_', ' ')}
                          </span>
                          {review.overall_score != null && <p className="text-lg font-bold text-slate-900 mt-1">{review.overall_score}%</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No performance reviews for this vendor</p>
                </div>
              )}
            </div>
          )}

          {/* Incidents Tab */}
          {activeTab === 'incidents' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Incidents</h3>
                <Link to="/incidents" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm">
                  View All Incidents
                </Link>
              </div>
              {vendorIncidents.length > 0 ? (
                <div className="space-y-3">
                  {vendorIncidents.map((incident) => (
                    <div key={incident.id} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{incident.title}</p>
                          <p className="text-sm text-slate-500">{incident.incident_id} • {incident.incident_type || 'Unclassified'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {incident.severity && (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
                              incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                              incident.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>{incident.severity}</span>
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            ['resolved', 'closed'].includes(incident.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>{incident.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No incidents reported for this vendor</p>
                </div>
              )}
            </div>
          )}

          {/* SLA Tracking Tab */}
          {activeTab === 'sla' && (
            <div>
              {slaSummary ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">SLA Performance</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {slaSummary.total_slas} active SLA{slaSummary.total_slas !== 1 ? 's' : ''} being tracked
                      </p>
                    </div>
                    <Link
                      to={`/vendors/${vendor.id}/sla`}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Manage SLAs
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-600 mb-1">Compliance Rate</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-2xl font-bold ${
                          slaSummary.compliance_rate >= 95 ? 'text-emerald-600' :
                          slaSummary.compliance_rate >= 90 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {slaSummary.compliance_rate.toFixed(1)}%
                        </p>
                        {slaSummary.trend === 'improving' && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                        {slaSummary.trend === 'declining' && <ArrowDownRight className="w-5 h-5 text-red-500" />}
                        {slaSummary.trend === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-600 mb-1">Recent Misses</p>
                      <p className={`text-2xl font-bold ${slaSummary.recent_misses > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {slaSummary.recent_misses}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-600 mb-1">Trend</p>
                      <p className={`text-lg font-semibold capitalize ${
                        slaSummary.trend === 'improving' ? 'text-emerald-600' :
                        slaSummary.trend === 'declining' ? 'text-red-600' : 'text-slate-600'
                      }`}>
                        {slaSummary.trend}
                      </p>
                    </div>
                  </div>

                  {slaSummary.recent_misses > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">SLA Attention Required</p>
                          <p className="text-sm text-amber-700 mt-1">
                            {slaSummary.recent_misses} SLA miss{slaSummary.recent_misses !== 1 ? 'es' : ''} detected in recent measurements. Review SLA details for corrective action.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Gauge className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No SLAs Defined</h3>
                  <p className="text-slate-600 mb-4">
                    Track service level agreements to monitor vendor performance
                  </p>
                  <Link
                    to={`/vendors/${vendor.id}/sla`}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 inline-block"
                  >
                    Add SLA
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Fourth Parties/Subcontractors Tab */}
          {activeTab === 'subcontractors' && (
            <div>
              {fourthPartyCount > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Fourth Parties / Subcontractors</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {fourthPartyCount} subcontractor{fourthPartyCount !== 1 ? 's' : ''} registered
                      </p>
                    </div>
                    <Link
                      to={`/vendors/${vendor.id}/fourth-parties`}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Manage Fourth Parties
                    </Link>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                    <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 mb-4">
                      View and manage all fourth-party relationships for this vendor
                    </p>
                    <Link
                      to={`/vendors/${vendor.id}/fourth-parties`}
                      className="text-slate-900 font-medium hover:underline"
                    >
                      View all {fourthPartyCount} fourth parties
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">
                    {vendor.uses_subcontractors
                      ? 'No fourth parties registered yet'
                      : 'This vendor does not use subcontractors'}
                  </p>
                  <Link
                    to={`/vendors/${vendor.id}/fourth-parties`}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 inline-block"
                  >
                    Add Fourth Party
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Exit Strategy Tab */}
          {activeTab === 'exit-strategy' && isCriticalOrHighTier && (
            <div>
              {exitStrategy ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Exit Strategy Planning</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Business continuity and exit planning for critical vendor
                      </p>
                    </div>
                    <Link
                      to={`/vendors/${vendor.id}/exit-strategy`}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Manage Exit Plan
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-600 mb-1">Plan Status</p>
                      <p className="text-lg font-semibold text-slate-900 capitalize">
                        {exitStrategy.status.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-600 mb-1">Alternative Vendors</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {exitStrategy.alternative_vendors_count}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-600 mb-1">Next Test Date</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {exitStrategy.next_test_date ? formatDate(exitStrategy.next_test_date) : 'Not scheduled'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">OSFI B-10 Requirement</p>
                        <p className="text-sm text-amber-700 mt-1">
                          Critical and high-risk vendor arrangements require documented exit strategies
                          that are regularly tested and approved.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <LogOut className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Exit Strategy Required</h3>
                  <p className="text-slate-600 mb-4 max-w-md mx-auto">
                    As a critical/high-risk vendor, an exit strategy must be documented
                    to ensure business continuity.
                  </p>
                  <Link
                    to={`/vendors/${vendor.id}/exit-strategy`}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 inline-block"
                  >
                    Create Exit Strategy
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Vendor Documents</h3>
              {vendorDocuments.length > 0 ? (
                <div className="space-y-3">
                  {vendorDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">{doc.document_name || doc.file_name || 'Document'}</p>
                          <p className="text-sm text-slate-500">{doc.document_type || 'General'} • Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {doc.expiry_date && (
                        <span className={`text-sm ${new Date(doc.expiry_date) < new Date() ? 'text-red-600' : 'text-slate-500'}`}>
                          Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No documents uploaded for this vendor</p>
                </div>
              )}
            </div>
          )}

          {/* Assessment History Tab */}
          {activeTab === 'history' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Assessment History Timeline</h3>
              </div>

              {assessments.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No assessment history available</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

                  <div className="space-y-6">
                    {assessments.map((assessment, index) => {
                      const tierInfo = assessment.calculated_tier && tierConfig[assessment.calculated_tier];
                      const previousAssessment = assessments[index + 1];
                      const tierChanged = previousAssessment && previousAssessment.calculated_tier !== assessment.calculated_tier;
                      const previousTierInfo = previousAssessment?.calculated_tier && tierConfig[previousAssessment.calculated_tier];
                      const riskChange = previousAssessment
                        ? ((assessment.risk_rating || 0) - (previousAssessment.risk_rating || 0)) / (previousAssessment.risk_rating || 1) * 100
                        : 0;
                      const isSignificantChange = Math.abs(riskChange) > 20;

                      const assessmentTypeLabels: Record<string, string> = {
                        initial: 'Initial Assessment',
                        periodic_review: 'Periodic Review',
                        triggered: 'Triggered Review',
                        renewal: 'Contract Renewal',
                        reassessment: 'Reassessment',
                      };

                      return (
                        <div key={assessment.id} className="relative pl-10">
                          <div className={`absolute left-2 w-4 h-4 rounded-full border-2 border-white ${
                            index === 0 ? 'bg-blue-500' : 'bg-slate-300'
                          }`} />

                          <div className={`bg-white border rounded-lg p-4 ${
                            isSignificantChange ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'
                          }`}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-slate-900">
                                    {assessmentTypeLabels[assessment.assessment_type] || assessment.assessment_type}
                                  </span>
                                  {index === 0 && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                      Current
                                    </span>
                                  )}
                                  {isSignificantChange && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">
                                      Significant Change
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center text-sm text-slate-500 mt-1">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {assessment.assessment_date && formatDate(assessment.assessment_date)}
                                  <span className="mx-2">|</span>
                                  {assessment.assessment_id}
                                </div>
                              </div>
                              {tierInfo && (
                                <span className={`px-2 py-1 text-xs font-medium rounded border ${tierInfo.bgClass}`}>
                                  {tierInfo.label}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-slate-500">Risk Rating</span>
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-slate-900">
                                    {assessment.risk_rating?.toFixed(2)}
                                  </span>
                                  {previousAssessment && getScoreChangeIndicator(assessment.risk_rating, previousAssessment.risk_rating)}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500">Impact</span>
                                <p className="font-semibold text-slate-900">{assessment.impact_score?.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Likelihood</span>
                                <p className="font-semibold text-slate-900">{assessment.likelihood_score?.toFixed(2)}</p>
                              </div>
                            </div>

                            {tierChanged && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <div className="flex items-center text-sm">
                                  <span className="text-slate-500 mr-2">Tier Change:</span>
                                  {previousTierInfo && (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${previousTierInfo.bgClass}`}>
                                      {previousTierInfo.label}
                                    </span>
                                  )}
                                  <ArrowUpRight className="w-4 h-4 mx-2 text-slate-400" />
                                  {tierInfo && (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${tierInfo.bgClass}`}>
                                      {tierInfo.label}
                                    </span>
                                  )}
                                </div>
                                {(assessment as TieringAssessment & { tier_change_justification?: string }).tier_change_justification && (
                                  <p className="text-sm text-slate-600 mt-2 italic">
                                    "{(assessment as TieringAssessment & { tier_change_justification?: string }).tier_change_justification}"
                                  </p>
                                )}
                              </div>
                            )}

                            {assessment.assessor_name && (
                              <div className="mt-3 pt-3 border-t border-slate-200 text-sm text-slate-500">
                                Assessed by {assessment.assessor_name}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Audit Trail</h3>
              {vendorAuditLogs.length > 0 ? (
                <div className="space-y-2">
                  {vendorAuditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                      <History className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">{log.action}</p>
                          <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        {log.user_name && <p className="text-xs text-slate-500">By: {log.user_name}</p>}
                        {log.notes && <p className="text-sm text-slate-600 mt-1 truncate">{log.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No audit trail entries for this vendor</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'offboarding' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Offboarding Checklist</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Complete all required tasks to terminate this vendor relationship.
                </p>

                {offboardingTasks.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Progress</span>
                      <span className="text-sm text-slate-600">
                        {calculateOffboardingProgress().completed} of {calculateOffboardingProgress().total} required tasks
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          calculateOffboardingProgress().percentage === 100
                            ? 'bg-green-600'
                            : calculateOffboardingProgress().percentage > 66
                            ? 'bg-blue-600'
                            : calculateOffboardingProgress().percentage > 33
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${calculateOffboardingProgress().percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {loadingTasks ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full mx-auto" />
                  <p className="text-slate-600 mt-4">Loading tasks...</p>
                </div>
              ) : offboardingTasks.length === 0 ? (
                <div className="text-center py-12">
                  <LogOut className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No offboarding tasks found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(
                    offboardingTasks.reduce((acc, task) => {
                      if (!acc[task.task_category]) acc[task.task_category] = [];
                      acc[task.task_category].push(task);
                      return acc;
                    }, {} as Record<string, OffboardingTask[]>)
                  ).map(([category, tasks]) => (
                    <div key={category} className="border border-slate-200 rounded-lg">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-900">{CATEGORY_LABELS[category]}</h4>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {tasks.map((task) => {
                          const statusInfo = STATUS_COLORS[task.status];
                          const isCompleted = task.status === 'completed';
                          const isReadOnly = vendor.status === 'terminated';

                          return (
                            <div key={task.id} className="p-4">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isCompleted}
                                  disabled={isReadOnly || updatingTaskId === task.id}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      handleTaskStatusChange(task.id, 'completed', taskCompletionNotes[task.id]);
                                    } else {
                                      handleTaskStatusChange(task.id, 'pending');
                                    }
                                  }}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-1">
                                    <div className="flex-1">
                                      <p className="font-medium text-slate-900">{task.task_name}</p>
                                      {task.description && (
                                        <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                                      )}
                                    </div>
                                    <span className={`ml-3 px-2 py-1 text-xs font-medium rounded ${statusInfo.bg} ${statusInfo.text}`}>
                                      {statusInfo.label}
                                    </span>
                                  </div>

                                  {!isReadOnly && task.status !== 'completed' && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <select
                                        value={task.status}
                                        onChange={(e) => handleTaskStatusChange(task.id, e.target.value)}
                                        disabled={updatingTaskId === task.id}
                                        className="text-sm border border-slate-300 rounded px-2 py-1"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                        <option value="not_applicable">Not Applicable</option>
                                      </select>
                                      {task.status === 'pending' || task.status === 'in_progress' ? (
                                        <input
                                          type="text"
                                          placeholder="Add notes (optional)"
                                          value={taskCompletionNotes[task.id] || ''}
                                          onChange={(e) => setTaskCompletionNotes({ ...taskCompletionNotes, [task.id]: e.target.value })}
                                          className="text-sm border border-slate-300 rounded px-2 py-1 flex-1"
                                        />
                                      ) : null}
                                    </div>
                                  )}

                                  {task.completed_at && (
                                    <div className="mt-2 text-xs text-slate-500">
                                      Completed {formatDate(task.completed_at)}
                                      {task.completed_by_user && ` by ${task.completed_by_user.full_name}`}
                                      {task.completion_notes && (
                                        <p className="mt-1 text-slate-600">{task.completion_notes}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {vendor.status === 'offboarding' && offboardingTasks.length > 0 && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowTerminationModal(true)}
                    disabled={!canCompleteOffboarding() || completingOffboarding}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      canCompleteOffboarding()
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {canCompleteOffboarding() ? 'Complete Offboarding' : 'Complete All Required Tasks First'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showRequestReassessmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Request Reassessment</h3>
                <button
                  onClick={() => setShowRequestReassessmentModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Request a reassessment for {vendor.legal_name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reassessment Type
                </label>
                <select
                  value={reassessmentType}
                  onChange={(e) => setReassessmentType(e.target.value as 'material_change' | 'contract_renewal')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="material_change">Material Change</option>
                  <option value="contract_renewal">Contract Renewal</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {reassessmentType === 'material_change'
                    ? 'Use when vendor circumstances have significantly changed'
                    : 'Use when contract is up for renewal'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Urgency
                </label>
                <div className="flex gap-2">
                  {(['normal', 'high', 'urgent'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setReassessmentUrgency(level)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        reassessmentUrgency === level
                          ? level === 'urgent'
                            ? 'bg-red-100 border-red-300 text-red-800'
                            : level === 'high'
                              ? 'bg-orange-100 border-orange-300 text-orange-800'
                              : 'bg-slate-100 border-slate-300 text-slate-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {reassessmentUrgency === 'urgent'
                    ? 'Due in 3 days'
                    : reassessmentUrgency === 'high'
                      ? 'Due in 7 days'
                      : 'Due in 14 days'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason / Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reassessmentReason}
                  onChange={(e) => setReassessmentReason(e.target.value)}
                  rows={3}
                  placeholder="Describe why this reassessment is needed..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRequestReassessmentModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestReassessment}
                disabled={!reassessmentReason.trim() || requestingReassessment}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {requestingReassessment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Request Reassessment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Change Vendor Status</h3>
                <button
                  onClick={() => {
                    setShowStatusChange(false);
                    setNewStatus('');
                    setStatusChangeReason('');
                    setShowOffboardingConfirm(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Change the status of {vendor.legal_name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Status
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(vendor.status)}-100 text-${getStatusColor(vendor.status)}-800`}>
                    {VENDOR_STATUSES.find((s) => s.value === vendor.status)?.label}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => {
                    setNewStatus(e.target.value);
                    setShowOffboardingConfirm(false);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">Select new status...</option>
                  {getAvailableTransitions(vendor.status).map((status) => (
                    <option key={status} value={status}>
                      {VENDOR_STATUSES.find((s) => s.value === status)?.label}
                    </option>
                  ))}
                </select>
                {newStatus && STATUS_TRANSITION_DESCRIPTIONS[newStatus] && (
                  <p className="text-xs text-slate-500 mt-1">
                    {STATUS_TRANSITION_DESCRIPTIONS[newStatus]}
                  </p>
                )}
              </div>

              {showOffboardingConfirm && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900 mb-1">Exit Process Will Be Initiated</p>
                      <p className="text-amber-700">
                        Changing status to "Offboarding" will initiate the vendor exit strategy process.
                        This should only be done when the relationship is being formally terminated.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Status Change <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={statusChangeReason}
                  onChange={(e) => setStatusChangeReason(e.target.value)}
                  rows={3}
                  placeholder="Describe the reason for this status change..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowStatusChange(false);
                  setNewStatus('');
                  setStatusChangeReason('');
                  setShowOffboardingConfirm(false);
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={!newStatus || !statusChangeReason.trim() || changingStatus}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {changingStatus ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {showOffboardingConfirm ? 'Confirm & Change Status' : 'Change Status'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTerminationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Confirm Vendor Termination</h3>
                </div>
                <button
                  onClick={() => setShowTerminationModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This will permanently terminate the vendor relationship. This action cannot be undone.
                </p>
              </div>
              <p className="text-sm text-slate-600">
                All required offboarding tasks have been completed. Proceeding will:
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>Change vendor status to "Terminated"</li>
                <li>Record the termination date</li>
                <li>Create an audit log entry</li>
                <li>Make the offboarding checklist read-only</li>
              </ul>
              <p className="text-sm font-medium text-slate-900">
                Are you sure you want to terminate {vendor.legal_name}?
              </p>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTerminationModal(false)}
                disabled={completingOffboarding}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteOffboarding}
                disabled={completingOffboarding}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {completingOffboarding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Terminating...
                  </>
                ) : (
                  'Confirm Termination'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

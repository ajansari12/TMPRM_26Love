import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { AssessmentTask, Vendor } from '../types';
import { tierConfig } from '../lib/riskCalculations';
import { formatDate } from '../lib/utils';
import {
  RefreshCw,
  Filter,
  Search,
  Building2,
  Calendar,
  AlertTriangle,
  Clock,
  Play,
  UserPlus,
  Pause,
  X,
  ChevronDown,
  FileText,
  ArrowRight,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

interface AssessmentTaskWithVendor extends AssessmentTask {
  vendor: Vendor;
}

const REASSESSMENT_TASK_TYPES = [
  'periodic_reassessment',
  'material_change',
  'contract_renewal',
  'bulk_import_assessment',
  'incident_triggered',
];

const taskTypeLabels: Record<string, string> = {
  periodic_reassessment: 'Periodic Review',
  material_change: 'Material Change',
  contract_renewal: 'Contract Renewal',
  bulk_import_assessment: 'Bulk Import',
  reassessment_validation: 'Validation',
  incident_triggered: 'Incident Triggered',
};

const taskTypeColors: Record<string, string> = {
  periodic_reassessment: 'bg-blue-100 text-blue-800',
  material_change: 'bg-amber-100 text-amber-800',
  contract_renewal: 'bg-emerald-100 text-emerald-800',
  bulk_import_assessment: 'bg-slate-100 text-slate-800',
  reassessment_validation: 'bg-purple-100 text-purple-800',
  incident_triggered: 'bg-red-100 text-red-800',
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-700' },
  low: { label: 'Low', color: 'bg-slate-50 text-slate-600' },
};

export default function PendingReassessments() {
  const { currentOrganization, currentMembership } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AssessmentTaskWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pendingCancelTask, setPendingCancelTask] = useState<AssessmentTaskWithVendor | null>(null);

  const canInitiateReassessment = () => {
    if (!currentMembership) return false;
    const allowedLines = ['1b', '2nd', 'admin'];
    return allowedLines.includes(currentMembership.defense_line);
  };

  const canCompleteReassessment = (task: AssessmentTaskWithVendor) => {
    if (!currentMembership) return false;

    const isAssignedLine = task.assigned_defense_line === currentMembership.defense_line;
    const isAdmin = currentMembership.defense_line === 'admin';
    const is1a = currentMembership.defense_line === '1a';
    const is1b = currentMembership.defense_line === '1b';

    if (task.task_type === 'reassessment_validation') {
      return currentMembership.defense_line === '2nd' || isAdmin;
    }

    return isAssignedLine || isAdmin || is1a || is1b;
  };

  const canValidateReassessment = () => {
    if (!currentMembership) return false;
    return currentMembership.defense_line === '2nd' || currentMembership.defense_line === 'admin';
  };

  const canSnoozeTask = () => {
    if (!currentMembership) return false;
    const allowedLines = ['1b', '2nd', 'admin'];
    return allowedLines.includes(currentMembership.defense_line);
  };

  const canCancelTask = () => {
    if (!currentMembership) return false;
    return currentMembership.defense_line === '2nd' || currentMembership.defense_line === 'admin';
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterTaskType, setFilterTaskType] = useState('all');
  const [filterDue, setFilterDue] = useState('all');
  const [snoozeModalTask, setSnoozeModalTask] = useState<AssessmentTaskWithVendor | null>(null);
  const [snoozeDate, setSnoozeDate] = useState('');
  const [snoozeReason, setSnoozeReason] = useState('');
  const [snoozeSaving, setSnoozeSaving] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      fetchTasks();
    }
  }, [currentOrganization]);

  const fetchTasks = async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const { data: tasksData, error: tasksError } = await supabase
        .from('assessment_tasks')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .in('task_type', [...REASSESSMENT_TASK_TYPES, 'reassessment_validation'])
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false });

      if (tasksError) throw tasksError;

      const vendorIds = [...new Set(tasksData?.map((t) => t.vendor_id))];
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .in('id', vendorIds.length > 0 ? vendorIds : ['']);

      if (vendorsError) throw vendorsError;

      const vendorMap = new Map(vendorsData?.map((v) => [v.id, v]));
      const enrichedTasks = tasksData
        ?.map((task) => ({
          ...task,
          vendor: vendorMap.get(task.vendor_id),
        }))
        .filter((t) => t.vendor) as AssessmentTaskWithVendor[];

      setTasks(enrichedTasks || []);
    } catch (error) {
      logger.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilDue = (dueDate: string | undefined): number | null => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (dueDate: string | undefined): boolean => {
    const days = getDaysUntilDue(dueDate);
    return days !== null && days < 0;
  };

  const isDueThisWeek = (dueDate: string | undefined): boolean => {
    const days = getDaysUntilDue(dueDate);
    return days !== null && days >= 0 && days <= 7;
  };

  const isDueThisMonth = (dueDate: string | undefined): boolean => {
    const days = getDaysUntilDue(dueDate);
    return days !== null && days >= 0 && days <= 30;
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      !searchTerm ||
      task.vendor?.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.vendor?.vendor_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesTaskType = filterTaskType === 'all' || task.task_type === filterTaskType;

    let matchesDue = true;
    if (filterDue === 'overdue') {
      matchesDue = isOverdue(task.due_date);
    } else if (filterDue === 'this_week') {
      matchesDue = isDueThisWeek(task.due_date);
    } else if (filterDue === 'this_month') {
      matchesDue = isDueThisMonth(task.due_date);
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesTaskType && matchesDue;
  });

  const stats = {
    total: tasks.length,
    overdue: tasks.filter((t) => isOverdue(t.due_date)).length,
    dueThisWeek: tasks.filter((t) => isDueThisWeek(t.due_date) && !isOverdue(t.due_date)).length,
    dueThisMonth: tasks.filter(
      (t) => isDueThisMonth(t.due_date) && !isDueThisWeek(t.due_date)
    ).length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
  };

  const handleStartReassessment = async (task: AssessmentTaskWithVendor) => {
    if (task.status === 'pending') {
      await supabase
        .from('assessment_tasks')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', task.id);
    }

    const { data: latestAssessment } = await supabase
      .from('tiering_assessments')
      .select('id')
      .eq('vendor_id', task.vendor_id)
      .eq('organization_id', currentOrganization?.id)
      .order('assessment_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const queryParams = new URLSearchParams();
    queryParams.set(
      'type',
      task.task_type === 'bulk_import_assessment' ? 'initial' : 'periodic_review'
    );
    queryParams.set('taskId', task.id);

    if (latestAssessment?.id) {
      queryParams.set('previousAssessmentId', latestAssessment.id);
    }

    navigate(`/vendors/${task.vendor_id}/assess?${queryParams.toString()}`);
  };

  const handleSnooze = async () => {
    if (!snoozeModalTask || !snoozeDate || !snoozeReason) return;
    setSnoozeSaving(true);
    try {
      const { error } = await supabase
        .from('assessment_tasks')
        .update({
          snooze_until: snoozeDate,
          snooze_reason: snoozeReason,
          snooze_count: (snoozeModalTask.snooze_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', snoozeModalTask.id);

      if (error) throw error;
      setSnoozeModalTask(null);
      setSnoozeDate('');
      setSnoozeReason('');
      fetchTasks();
    } catch (error) {
      logger.error('Error snoozing task:', error);
    } finally {
      setSnoozeSaving(false);
    }
  };

  const handleCancelTask = (task: AssessmentTaskWithVendor) => {
    setPendingCancelTask(task);
    setShowCancelConfirm(true);
  };

  const confirmCancelTask = async () => {
    if (!pendingCancelTask) return;
    try {
      await supabase
        .from('assessment_tasks')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingCancelTask.id);
      fetchTasks();
    } catch (error) {
      logger.error('Error cancelling task:', error);
    } finally {
      setShowCancelConfirm(false);
      setPendingCancelTask(null);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">
            Please select an organization to view reassessments
          </p>
        </div>
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Pending Reassessments</h1>
        <p className="text-slate-600 mt-1">Manage and track vendor reassessment tasks</p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div
          className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${filterDue === 'overdue' ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
          onClick={() => setFilterDue(filterDue === 'overdue' ? 'all' : 'overdue')}
        >
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            {stats.overdue > 0 && (
              <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                Action Required
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
        </div>

        <div
          className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${filterDue === 'this_week' ? 'ring-2 ring-amber-500' : 'hover:shadow-md'}`}
          onClick={() => setFilterDue(filterDue === 'this_week' ? 'all' : 'this_week')}
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm text-slate-600">Due This Week</p>
          <p className="text-2xl font-bold text-amber-600">{stats.dueThisWeek}</p>
        </div>

        <div
          className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${filterDue === 'this_month' ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
          onClick={() => setFilterDue(filterDue === 'this_month' ? 'all' : 'this_month')}
        >
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-slate-600">Due This Month</p>
          <p className="text-2xl font-bold text-blue-600">{stats.dueThisMonth}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Play className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm text-slate-600">In Progress</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.inProgress}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <RefreshCw className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-sm text-slate-600">Total Pending</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by vendor name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>

              <select
                value={filterTaskType}
                onChange={(e) => setFilterTaskType(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="periodic_reassessment">Periodic Review</option>
                <option value="material_change">Material Change</option>
                <option value="contract_renewal">Contract Renewal</option>
                <option value="bulk_import_assessment">Bulk Import</option>
              </select>

              {filterDue !== 'all' && (
                <button
                  onClick={() => setFilterDue('all')}
                  className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear Due Filter
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No reassessment tasks found</p>
              <p className="text-sm text-slate-500">
                {tasks.length > 0
                  ? 'Try adjusting your filters'
                  : 'Reassessment tasks will appear here when vendors are due for review'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                      Vendor
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                      Task Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                      Current Tier
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                      Due Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                      Priority
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const tierInfo = task.vendor?.tier && tierConfig[task.vendor.tier];
                    const daysUntil = getDaysUntilDue(task.due_date);
                    const taskIsOverdue = isOverdue(task.due_date);

                    return (
                      <tr
                        key={task.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${taskIsOverdue ? 'bg-red-50' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <Link
                            to={`/vendors/${task.vendor_id}`}
                            className="text-sm font-medium text-slate-900 hover:text-slate-600"
                          >
                            {task.vendor?.legal_name}
                          </Link>
                          <p className="text-xs text-slate-500">{task.vendor?.vendor_id}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded ${taskTypeColors[task.task_type] || 'bg-slate-100 text-slate-800'}`}
                          >
                            {taskTypeLabels[task.task_type] || task.task_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {tierInfo && (
                            <span
                              className={`inline-block px-2 py-1 text-xs font-medium rounded border ${tierInfo.bgClass}`}
                            >
                              {tierInfo.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {task.due_date ? (
                              <>
                                <span
                                  className={`text-sm ${taskIsOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}
                                >
                                  {formatDate(task.due_date)}
                                </span>
                                {daysUntil !== null && (
                                  <span
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      taskIsOverdue
                                        ? 'bg-red-100 text-red-700'
                                        : daysUntil <= 7
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {taskIsOverdue
                                      ? `${Math.abs(daysUntil)} days overdue`
                                      : `${daysUntil} days`}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">Not set</span>
                            )}
                          </div>
                          {task.snooze_until && (
                            <p className="text-xs text-amber-600 mt-1">
                              Snoozed until {formatDate(task.snooze_until)} (x
                              {task.snooze_count || 1})
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded ${priorityConfig[task.priority]?.color || 'bg-slate-100 text-slate-700'}`}
                          >
                            {priorityConfig[task.priority]?.label || task.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                              task.status === 'in_progress'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {canCompleteReassessment(task) ? (
                              <button
                                onClick={() => handleStartReassessment(task)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-sm rounded hover:bg-slate-800 transition-colors"
                              >
                                {task.status === 'in_progress' ? (
                                  <>
                                    Continue <ArrowRight className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    Start <Play className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Assigned to {task.assigned_defense_line?.toUpperCase() || '2nd Line'}
                              </span>
                            )}
                            {(canSnoozeTask() || canCancelTask()) && (
                              <div className="relative group">
                                <button className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded">
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                  {canSnoozeTask() && (
                                    <button
                                      onClick={() => {
                                        setSnoozeModalTask(task);
                                        const defaultSnooze = new Date();
                                        defaultSnooze.setDate(defaultSnooze.getDate() + 7);
                                        setSnoozeDate(defaultSnooze.toISOString().split('T')[0]);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Pause className="w-4 h-4" />
                                      Snooze
                                    </button>
                                  )}
                                  {canCancelTask() && (
                                    <button
                                      onClick={() => handleCancelTask(task)}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <X className="w-4 h-4" />
                                      Cancel Task
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {snoozeModalTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Snooze Reassessment</h3>
              <p className="text-sm text-slate-600 mt-1">
                Postpone the reassessment for {snoozeModalTask.vendor?.legal_name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Snooze Until
                </label>
                <input
                  type="date"
                  value={snoozeDate}
                  onChange={(e) => setSnoozeDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Snooze <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={snoozeReason}
                  onChange={(e) => setSnoozeReason(e.target.value)}
                  rows={3}
                  placeholder="Provide justification for postponing this reassessment..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              {(snoozeModalTask.snooze_count || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    This task has been snoozed {snoozeModalTask.snooze_count} time(s) before.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSnoozeModalTask(null);
                  setSnoozeDate('');
                  setSnoozeReason('');
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSnooze}
                disabled={!snoozeDate || !snoozeReason || snoozeSaving}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {snoozeSaving ? 'Saving...' : 'Snooze Task'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={showCancelConfirm}
        onConfirm={confirmCancelTask}
        onCancel={() => { setShowCancelConfirm(false); setPendingCancelTask(null); }}
        title="Cancel Reassessment"
        message="Are you sure you want to cancel this reassessment task?"
        confirmLabel="Cancel Task"
        variant="warning"
      />
    </div>
  );
}

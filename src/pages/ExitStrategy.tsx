import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { Vendor } from '../types';
import { formatDate } from '../lib/utils';
import {
  ArrowLeft,
  LogOut,
  Building2,
  Shield,
  Clock,
  Calendar,
  FileText,
  CheckCircle,
  AlertTriangle,
  Plus,
  X,
  Trash2,
  Save,
  ClipboardCheck,
  Users,
  Database,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

interface ExitStrategy {
  id: string;
  organization_id: string;
  vendor_id: string;
  status: 'not_started' | 'in_progress' | 'documented' | 'tested' | 'approved';
  exit_trigger_conditions: string[] | null;
  notice_period_days: number | null;
  data_return_process: string | null;
  data_destruction_process: string | null;
  alternative_vendors: AlternativeVendor[] | null;
  transition_timeline_weeks: number | null;
  last_test_date: string | null;
  test_results: string | null;
  next_test_date: string | null;
  exit_plan_document_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AlternativeVendor {
  name: string;
  assessment_status: 'not_assessed' | 'in_progress' | 'assessed';
  readiness: 'not_ready' | 'partial' | 'ready';
  notes?: string;
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-slate-100 text-slate-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
  documented: { label: 'Documented', color: 'bg-amber-100 text-amber-800', icon: FileText },
  tested: { label: 'Tested', color: 'bg-emerald-100 text-emerald-800', icon: ClipboardCheck },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

const TRIGGER_SUGGESTIONS = [
  'Vendor financial instability or bankruptcy',
  'Regulatory non-compliance or sanctions',
  'Material breach of contract',
  'Significant service level degradation',
  'Security incident or data breach',
  'Strategic business decision to change providers',
  'Contract expiration without renewal',
  'Vendor acquisition by competitor',
  'Loss of critical certifications (SOC 2, ISO 27001)',
  'Concentration risk threshold exceeded',
];

export default function ExitStrategy() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [exitStrategy, setExitStrategy] = useState<ExitStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    status: 'not_started' as ExitStrategy['status'],
    exit_trigger_conditions: [] as string[],
    notice_period_days: '',
    data_return_process: '',
    data_destruction_process: '',
    alternative_vendors: [] as AlternativeVendor[],
    transition_timeline_weeks: '',
    last_test_date: '',
    test_results: '',
    next_test_date: '',
    notes: '',
  });

  const [newTrigger, setNewTrigger] = useState('');
  const [showTriggerSuggestions, setShowTriggerSuggestions] = useState(false);

  useEffect(() => {
    if (vendorId && currentOrganization?.id) {
      fetchData();
    } else if (!currentOrganization?.id) {
      setLoading(false);
    }
  }, [vendorId, currentOrganization?.id]);

  const fetchData = async () => {
    if (!currentOrganization?.id || !vendorId) return;

    try {
      setLoading(true);
      const [vendorRes, strategyRes] = await Promise.all([
        supabase
          .from('vendors')
          .select('*')
          .eq('id', vendorId)
          .eq('organization_id', currentOrganization.id)
          .maybeSingle(),
        supabase
          .from('exit_strategies')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('organization_id', currentOrganization.id)
          .maybeSingle(),
      ]);

      if (vendorRes.error) throw vendorRes.error;
      setVendor(vendorRes.data);

      if (strategyRes.data) {
        setExitStrategy(strategyRes.data);
        setFormData({
          status: strategyRes.data.status,
          exit_trigger_conditions: strategyRes.data.exit_trigger_conditions || [],
          notice_period_days: strategyRes.data.notice_period_days?.toString() || '',
          data_return_process: strategyRes.data.data_return_process || '',
          data_destruction_process: strategyRes.data.data_destruction_process || '',
          alternative_vendors: strategyRes.data.alternative_vendors || [],
          transition_timeline_weeks: strategyRes.data.transition_timeline_weeks?.toString() || '',
          last_test_date: strategyRes.data.last_test_date || '',
          test_results: strategyRes.data.test_results || '',
          next_test_date: strategyRes.data.next_test_date || '',
          notes: strategyRes.data.notes || '',
        });
      }
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrganization?.id || !vendorId) return;

    try {
      setSaving(true);
      const payload = {
        organization_id: currentOrganization.id,
        vendor_id: vendorId,
        status: formData.status,
        exit_trigger_conditions: formData.exit_trigger_conditions.length > 0 ? formData.exit_trigger_conditions : null,
        notice_period_days: formData.notice_period_days ? parseInt(formData.notice_period_days) : null,
        data_return_process: formData.data_return_process || null,
        data_destruction_process: formData.data_destruction_process || null,
        alternative_vendors: formData.alternative_vendors.length > 0 ? formData.alternative_vendors : null,
        transition_timeline_weeks: formData.transition_timeline_weeks ? parseInt(formData.transition_timeline_weeks) : null,
        last_test_date: formData.last_test_date || null,
        test_results: formData.test_results || null,
        next_test_date: formData.next_test_date || null,
        notes: formData.notes || null,
      };

      if (exitStrategy) {
        const { error } = await supabase
          .from('exit_strategies')
          .update(payload)
          .eq('id', exitStrategy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exit_strategies').insert(payload);
        if (error) throw error;
      }

      toast.success('Exit strategy saved successfully');
      fetchData();
    } catch (error) {
      logger.error('Error saving exit strategy:', error);
      toast.error('Failed to save exit strategy');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!exitStrategy || !user) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('exit_strategies')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', exitStrategy.id);

      if (error) throw error;
      toast.success('Exit strategy approved');
      fetchData();
    } catch (error) {
      logger.error('Error approving exit strategy:', error);
      toast.error('Failed to approve exit strategy');
    } finally {
      setSaving(false);
    }
  };

  const addTrigger = (trigger: string) => {
    if (trigger && !formData.exit_trigger_conditions.includes(trigger)) {
      setFormData({
        ...formData,
        exit_trigger_conditions: [...formData.exit_trigger_conditions, trigger],
      });
    }
    setNewTrigger('');
    setShowTriggerSuggestions(false);
  };

  const removeTrigger = (index: number) => {
    setFormData({
      ...formData,
      exit_trigger_conditions: formData.exit_trigger_conditions.filter((_, i) => i !== index),
    });
  };

  const addAlternativeVendor = () => {
    setFormData({
      ...formData,
      alternative_vendors: [
        ...formData.alternative_vendors,
        { name: '', assessment_status: 'not_assessed', readiness: 'not_ready' },
      ],
    });
  };

  const updateAlternativeVendor = (index: number, field: keyof AlternativeVendor, value: string) => {
    const updated = [...formData.alternative_vendors];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, alternative_vendors: updated });
  };

  const removeAlternativeVendor = (index: number) => {
    setFormData({
      ...formData,
      alternative_vendors: formData.alternative_vendors.filter((_, i) => i !== index),
    });
  };

  const statusConfig = STATUS_CONFIG[formData.status];
  const StatusIcon = statusConfig.icon;

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

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Vendor not found</p>
        <Link to="/vendors" className="text-slate-900 hover:underline mt-4 inline-block">
          Back to Vendors
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(`/vendors/${vendorId}`)}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {vendor.legal_name}
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <LogOut className="w-8 h-8 mr-3" />
              Exit Strategy Planning
            </h1>
            <p className="text-slate-600 mt-1">
              Document and manage exit plan for <span className="font-medium">{vendor.legal_name}</span>
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center ${statusConfig.color}`}>
              <StatusIcon className="w-4 h-4 mr-1.5" />
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
              Exit Trigger Conditions
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Define conditions that would trigger the exit plan execution
            </p>

            <div className="space-y-2 mb-4">
              {formData.exit_trigger_conditions.map((trigger, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <span className="text-sm text-slate-700">{trigger}</span>
                  <button
                    onClick={() => removeTrigger(index)}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="relative">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  onFocus={() => setShowTriggerSuggestions(true)}
                  onKeyDown={(e) => e.key === 'Enter' && addTrigger(newTrigger)}
                  placeholder="Add custom trigger condition..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
                <button
                  onClick={() => addTrigger(newTrigger)}
                  disabled={!newTrigger}
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {showTriggerSuggestions && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  <div className="p-2 text-xs font-medium text-slate-500 border-b border-slate-100">
                    Suggested Triggers
                  </div>
                  {TRIGGER_SUGGESTIONS.filter(
                    (s) => !formData.exit_trigger_conditions.includes(s)
                  ).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => addTrigger(suggestion)}
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowTriggerSuggestions(false)}
                    className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 border-t border-slate-100"
                  >
                    Close suggestions
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-blue-500" />
              Data Handling Procedures
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notice Period (Days)
                </label>
                <input
                  type="number"
                  value={formData.notice_period_days}
                  onChange={(e) => setFormData({ ...formData, notice_period_days: e.target.value })}
                  placeholder="e.g., 90"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Transition Timeline (Weeks)
                </label>
                <input
                  type="number"
                  value={formData.transition_timeline_weeks}
                  onChange={(e) => setFormData({ ...formData, transition_timeline_weeks: e.target.value })}
                  placeholder="e.g., 12"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data Return Process
              </label>
              <textarea
                rows={3}
                value={formData.data_return_process}
                onChange={(e) => setFormData({ ...formData, data_return_process: e.target.value })}
                placeholder="Describe how data will be returned to your organization..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data Destruction Process
              </label>
              <textarea
                rows={3}
                value={formData.data_destruction_process}
                onChange={(e) => setFormData({ ...formData, data_destruction_process: e.target.value })}
                placeholder="Describe how vendor will destroy remaining data after transfer..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-emerald-500" />
                Alternative Vendors
              </h2>
              <button
                onClick={addAlternativeVendor}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Alternative
              </button>
            </div>

            {formData.alternative_vendors.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No alternative vendors identified</p>
                <button
                  onClick={addAlternativeVendor}
                  className="mt-2 text-sm text-slate-900 hover:underline"
                >
                  Add your first alternative
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.alternative_vendors.map((alt, index) => (
                  <div key={index} className="p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <input
                        type="text"
                        value={alt.name}
                        onChange={(e) => updateAlternativeVendor(index, 'name', e.target.value)}
                        placeholder="Vendor name"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      />
                      <button
                        onClick={() => removeAlternativeVendor(index)}
                        className="ml-2 p-2 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Assessment Status
                        </label>
                        <select
                          value={alt.assessment_status}
                          onChange={(e) => updateAlternativeVendor(index, 'assessment_status', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        >
                          <option value="not_assessed">Not Assessed</option>
                          <option value="in_progress">In Progress</option>
                          <option value="assessed">Assessed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Readiness
                        </label>
                        <select
                          value={alt.readiness}
                          onChange={(e) => updateAlternativeVendor(index, 'readiness', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        >
                          <option value="not_ready">Not Ready</option>
                          <option value="partial">Partially Ready</option>
                          <option value="ready">Ready</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <ClipboardCheck className="w-5 h-5 mr-2 text-teal-500" />
              Testing & Validation
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Last Test Date
                </label>
                <input
                  type="date"
                  value={formData.last_test_date}
                  onChange={(e) => setFormData({ ...formData, last_test_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Next Scheduled Test
                </label>
                <input
                  type="date"
                  value={formData.next_test_date}
                  onChange={(e) => setFormData({ ...formData, next_test_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Test Results & Findings
              </label>
              <textarea
                rows={4}
                value={formData.test_results}
                onChange={(e) => setFormData({ ...formData, test_results: e.target.value })}
                placeholder="Document findings from the most recent exit plan test..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Additional Notes</h2>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes or considerations..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Plan Status</h3>

            <div className="space-y-2">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                const isActive = formData.status === key;
                const isApproved = key === 'approved';

                return (
                  <button
                    key={key}
                    onClick={() => !isApproved && setFormData({ ...formData, status: key as ExitStrategy['status'] })}
                    disabled={isApproved}
                    className={`w-full flex items-center p-3 rounded-lg border-2 transition-colors ${
                      isActive
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-transparent hover:bg-slate-50'
                    } ${isApproved ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                    <span className={`font-medium ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                      {config.label}
                    </span>
                    {isActive && (
                      <CheckCircle className="w-4 h-4 ml-auto text-slate-900" />
                    )}
                  </button>
                );
              })}
            </div>

            {formData.status === 'tested' && !exitStrategy?.approved_at && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Exit Plan
                </button>
              </div>
            )}

            {exitStrategy?.approved_at && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center text-sm text-emerald-600">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span>Approved on {formatDate(exitStrategy.approved_at)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Summary</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Trigger Conditions</span>
                <span className="font-medium">{formData.exit_trigger_conditions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Alternative Vendors</span>
                <span className="font-medium">{formData.alternative_vendors.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Notice Period</span>
                <span className="font-medium">
                  {formData.notice_period_days ? `${formData.notice_period_days} days` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Transition Time</span>
                <span className="font-medium">
                  {formData.transition_timeline_weeks ? `${formData.transition_timeline_weeks} weeks` : '-'}
                </span>
              </div>
              {formData.next_test_date && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Next Test</span>
                  <span className="font-medium">{formatDate(formData.next_test_date)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Completeness Check</h3>

            <div className="space-y-2">
              {[
                { label: 'Trigger conditions defined', done: formData.exit_trigger_conditions.length > 0 },
                { label: 'Notice period specified', done: !!formData.notice_period_days },
                { label: 'Data return process documented', done: !!formData.data_return_process },
                { label: 'Data destruction process documented', done: !!formData.data_destruction_process },
                { label: 'Alternative vendors identified', done: formData.alternative_vendors.length > 0 },
                { label: 'Transition timeline estimated', done: !!formData.transition_timeline_weeks },
                { label: 'Exit plan tested', done: !!formData.last_test_date },
              ].map((item, index) => (
                <div key={index} className="flex items-center text-sm">
                  {item.done ? (
                    <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                  ) : (
                    <div className="w-4 h-4 mr-2 rounded-full border-2 border-slate-300" />
                  )}
                  <span className={item.done ? 'text-slate-700' : 'text-slate-500'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Exit Strategy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

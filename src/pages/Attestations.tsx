import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { logger } from '../lib/logger';
import { toast } from 'sonner';
import {
  AttestationPeriod,
  AttestationRequirement,
  AttestationSubmission,
  AttestationResponseRecord,
} from '../types';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';
import {
  ClipboardCheck,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Plus,
  ChevronRight,
  Shield,
  User,
  X,
  Loader2,
  Building2,
} from 'lucide-react';

export default function Attestations() {
  const { user, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const [periods, setPeriods] = useState<AttestationPeriod[]>([]);
  const [submissions, setSubmissions] = useState<AttestationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AttestationPeriod | null>(null);

  const isRiskManager = profile?.role === 'risk_manager';

  useEffect(() => {
    if (currentOrganization) {
      fetchData();
    }
  }, [currentOrganization]);

  async function fetchData() {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [periodsRes, submissionsRes] = await Promise.all([
        supabase
          .from('attestation_periods')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('due_date', { ascending: false }),
        supabase
          .from('attestation_submissions')
          .select('*')
          .eq('submitted_by_user_id', user?.id),
      ]);

      setPeriods(periodsRes.data || []);
      setSubmissions(submissionsRes.data || []);
    } catch (error) {
      logger.error('Error fetching attestations:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(period: AttestationPeriod) {
    const submission = submissions.find((s) => s.period_id === period.id);

    if (submission?.status === 'accepted') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
          Completed
        </span>
      );
    }
    if (submission?.status === 'submitted') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          Pending Review
        </span>
      );
    }
    if (submission?.status === 'draft') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
          In Progress
        </span>
      );
    }
    if (isPast(new Date(period.due_date))) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
          Overdue
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
        Not Started
      </span>
    );
  }

  function getPeriodTypeBadge(type: string) {
    const styles: Record<string, string> = {
      annual_b10: 'bg-blue-100 text-blue-700',
      quarterly_critical: 'bg-teal-100 text-teal-700',
      ad_hoc: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      annual_b10: 'Annual B-10',
      quarterly_critical: 'Quarterly',
      ad_hoc: 'Ad-Hoc',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[type] || styles.ad_hoc}`}>
        {labels[type] || type}
      </span>
    );
  }

  const openPeriods = periods.filter((p) => p.status === 'open' && isFuture(new Date(p.due_date)));
  const overduePeriods = periods.filter(
    (p) =>
      p.status === 'open' &&
      isPast(new Date(p.due_date)) &&
      !submissions.find((s) => s.period_id === p.id && s.status === 'accepted')
  );
  const completedPeriods = periods.filter((p) =>
    submissions.find((s) => s.period_id === p.id && s.status === 'accepted')
  );

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view attestations</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Management Attestations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Complete periodic attestations for OSFI B-10 compliance
          </p>
        </div>
        {isRiskManager && (
          <button
            onClick={() => setShowNewPeriodModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Attestation Period
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Open Periods</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{openPeriods.length}</p>
          <p className="text-xs text-gray-500 mt-1">Requiring attestation</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Overdue</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{overduePeriods.length}</p>
          <p className="text-xs text-gray-500 mt-1">Past due date</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Completed</span>
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{completedPeriods.length}</p>
          <p className="text-xs text-gray-500 mt-1">Accepted attestations</p>
        </div>
      </div>

      {overduePeriods.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Overdue Attestations</h3>
              <p className="text-sm text-red-700 mt-1">
                You have {overduePeriods.length} attestation period(s) past the due date. Please
                complete these immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Attestation Periods</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {periods.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No attestation periods configured</p>
              {isRiskManager && (
                <button
                  onClick={() => setShowNewPeriodModal(true)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800"
                >
                  Create the first attestation period
                </button>
              )}
            </div>
          ) : (
            periods.map((period) => {
              const submission = submissions.find((s) => s.period_id === period.id);
              const isOverdue = isPast(new Date(period.due_date)) && !submission?.attestation_confirmed;

              return (
                <div
                  key={period.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    isOverdue ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-medium text-gray-900">{period.period_name}</h3>
                        {getPeriodTypeBadge(period.period_type)}
                        {getStatusBadge(period)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{period.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(period.period_start), 'MMM d, yyyy')} -{' '}
                            {format(new Date(period.period_end), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span
                            className={
                              isOverdue ? 'text-red-600 font-medium' : ''
                            }
                          >
                            Due {formatDistanceToNow(new Date(period.due_date), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {submission?.attestation_confirmed ? (
                        <div className="text-right">
                          <p className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Attested
                          </p>
                          <p className="text-xs text-gray-500">
                            {submission.attested_at &&
                              format(new Date(submission.attested_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedPeriod(period);
                            setShowAttestationModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          {submission ? 'Continue' : 'Start'} Attestation
                        </button>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showNewPeriodModal && (
        <NewPeriodModal
          onClose={() => setShowNewPeriodModal(false)}
          onSuccess={() => {
            setShowNewPeriodModal(false);
            fetchData();
          }}
        />
      )}

      {showAttestationModal && selectedPeriod && (
        <AttestationFormModal
          period={selectedPeriod}
          existingSubmission={submissions.find((s) => s.period_id === selectedPeriod.id)}
          onClose={() => {
            setShowAttestationModal(false);
            setSelectedPeriod(null);
          }}
          onSuccess={() => {
            setShowAttestationModal(false);
            setSelectedPeriod(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function NewPeriodModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    period_type: 'annual_b10',
    period_name: '',
    description: '',
    period_start: '',
    period_end: '',
    due_date: '',
  });

  const defaultRequirements = [
    { code: 'REQ_01', text: 'All third-party relationships are documented in the vendor inventory' },
    { code: 'REQ_02', text: 'Risk assessments are current for all Tier 1 and Tier 2 vendors' },
    { code: 'REQ_03', text: 'Due diligence has been completed for all material arrangements' },
    { code: 'REQ_04', text: 'Contracts contain required OSFI provisions (Annex 2)' },
    { code: 'REQ_05', text: 'Performance monitoring is conducted per tier requirements' },
    { code: 'REQ_06', text: 'Incident management procedures are in place and tested' },
    { code: 'REQ_07', text: 'Business continuity plans exist for critical third parties' },
    { code: 'REQ_08', text: 'Concentration risk is within approved appetite' },
    { code: 'REQ_09', text: 'Fourth-party risks have been identified and assessed' },
    { code: 'REQ_10', text: 'Exit strategies exist for critical third-party arrangements' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.period_name || !formData.period_start || !formData.period_end || !formData.due_date || !currentOrganization) {
      return;
    }

    setLoading(true);
    try {
      const { data: period, error: periodError } = await supabase
        .from('attestation_periods')
        .insert({
          period_type: formData.period_type,
          period_name: formData.period_name,
          description: formData.description,
          period_start: formData.period_start,
          period_end: formData.period_end,
          due_date: formData.due_date,
          status: 'open',
          created_by: user?.id,
          organization_id: currentOrganization.id,
        })
        .select()
        .single();

      if (periodError) throw periodError;

      const requirements = defaultRequirements.map((req, idx) => ({
        period_id: period.id,
        requirement_code: req.code,
        requirement_text: req.text,
        is_mandatory: true,
        sort_order: idx + 1,
      }));

      const { error: reqError } = await supabase
        .from('attestation_requirements')
        .insert(requirements);

      if (reqError) throw reqError;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        user_name: profile?.full_name,
        action: 'create',
        entity_type: 'attestation_period',
        entity_id: period.id,
        entity_name: formData.period_name,
      });

      onSuccess();
    } catch (error) {
      logger.error('Error creating attestation period:', error);
      toast.error('Failed to create attestation period');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">New Attestation Period</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
            <select
              value={formData.period_type}
              onChange={(e) => setFormData({ ...formData, period_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="annual_b10">Annual B-10 Attestation</option>
              <option value="quarterly_critical">Quarterly Critical Vendor Review</option>
              <option value="ad_hoc">Ad-Hoc Attestation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Name *</label>
            <input
              type="text"
              value={formData.period_name}
              onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
              placeholder="e.g., 2025 Annual B-10 Attestation"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start *</label>
              <input
                type="date"
                value={formData.period_start}
                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End *</label>
              <input
                type="date"
                value={formData.period_end}
                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Default Requirements</p>
            <p className="text-xs text-gray-500">
              {defaultRequirements.length} standard B-10 attestation requirements will be added
              automatically. You can customize these after creation.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttestationFormModal({
  period,
  existingSubmission,
  onClose,
  onSuccess,
}: {
  period: AttestationPeriod;
  existingSubmission?: AttestationSubmission;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user, profile } = useAuth();
  const [requirements, setRequirements] = useState<AttestationRequirement[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [evidenceNotes, setEvidenceNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attestationConfirmed, setAttestationConfirmed] = useState(false);

  useEffect(() => {
    fetchRequirements();
  }, [period.id]);

  async function fetchRequirements() {
    setLoading(true);
    try {
      const { data: reqs } = await supabase
        .from('attestation_requirements')
        .select('*')
        .eq('period_id', period.id)
        .order('sort_order');

      setRequirements(reqs || []);

      if (existingSubmission) {
        const { data: existingResponses } = await supabase
          .from('attestation_responses')
          .select('*')
          .eq('submission_id', existingSubmission.id);

        const responseMap: Record<string, string> = {};
        const notesMap: Record<string, string> = {};
        existingResponses?.forEach((r) => {
          responseMap[r.requirement_id] = r.response;
          notesMap[r.requirement_id] = r.evidence_notes || '';
        });
        setResponses(responseMap);
        setEvidenceNotes(notesMap);
      }
    } catch (error) {
      logger.error('Error fetching requirements:', error);
    } finally {
      setLoading(false);
    }
  }

  const allMandatoryAnswered = requirements
    .filter((r) => r.is_mandatory)
    .every((r) => responses[r.id]);

  async function handleSubmit() {
    if (!allMandatoryAnswered || !attestationConfirmed) return;

    setSubmitting(true);
    try {
      let submissionId = existingSubmission?.id;

      if (!submissionId) {
        const { data: newSubmission, error: subError } = await supabase
          .from('attestation_submissions')
          .insert({
            period_id: period.id,
            submitted_by_user_id: user?.id,
            submitted_by_name: profile?.full_name,
            business_unit: profile?.department,
            status: 'submitted',
            attestation_confirmed: true,
            attested_at: new Date().toISOString(),
            submission_date: new Date().toISOString(),
          })
          .select()
          .single();

        if (subError) throw subError;
        submissionId = newSubmission.id;
      } else {
        await supabase
          .from('attestation_submissions')
          .update({
            status: 'submitted',
            attestation_confirmed: true,
            attested_at: new Date().toISOString(),
            submission_date: new Date().toISOString(),
          })
          .eq('id', submissionId);

        await supabase
          .from('attestation_responses')
          .delete()
          .eq('submission_id', submissionId);
      }

      const responseRecords = requirements.map((req) => ({
        submission_id: submissionId,
        requirement_id: req.id,
        response: responses[req.id] || 'not_applicable',
        evidence_notes: evidenceNotes[req.id] || null,
        evidence_document_ids: [],
        linked_vendor_ids: [],
      }));

      const { error: respError } = await supabase
        .from('attestation_responses')
        .insert(responseRecords);

      if (respError) throw respError;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        user_name: profile?.full_name,
        action: 'attestation_submitted',
        entity_type: 'attestation_submission',
        entity_id: submissionId,
        entity_name: period.period_name,
        notes: `Attestation submitted for period: ${period.period_name}`,
      });

      onSuccess();
    } catch (error) {
      logger.error('Error submitting attestation:', error);
      toast.error('Failed to submit attestation');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{period.period_name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Complete all requirements and confirm your attestation
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {requirements.map((req, idx) => (
              <div key={req.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{req.requirement_text}</p>
                    {req.is_mandatory && (
                      <span className="text-xs text-red-600 mt-1">* Required</span>
                    )}

                    <div className="flex gap-3 mt-3">
                      {['compliant', 'non_compliant', 'not_applicable'].map((option) => (
                        <label
                          key={option}
                          className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                            responses[req.id] === option
                              ? option === 'compliant'
                                ? 'border-emerald-500 bg-emerald-50'
                                : option === 'non_compliant'
                                ? 'border-red-500 bg-red-50'
                                : 'border-gray-500 bg-gray-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`response-${req.id}`}
                            value={option}
                            checked={responses[req.id] === option}
                            onChange={(e) =>
                              setResponses({ ...responses, [req.id]: e.target.value })
                            }
                            className="sr-only"
                          />
                          <span
                            className={`text-sm font-medium ${
                              responses[req.id] === option
                                ? option === 'compliant'
                                  ? 'text-emerald-700'
                                  : option === 'non_compliant'
                                  ? 'text-red-700'
                                  : 'text-gray-700'
                                : 'text-gray-600'
                            }`}
                          >
                            {option === 'compliant'
                              ? 'Compliant'
                              : option === 'non_compliant'
                              ? 'Non-Compliant'
                              : 'N/A'}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-3">
                      <input
                        type="text"
                        placeholder="Evidence notes (optional)"
                        value={evidenceNotes[req.id] || ''}
                        onChange={(e) =>
                          setEvidenceNotes({ ...evidenceNotes, [req.id]: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={attestationConfirmed}
                onChange={(e) => setAttestationConfirmed(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-blue-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-blue-900">Attestation Confirmation</p>
                <p className="text-sm text-blue-700 mt-1">
                  I attest that the above responses are accurate and complete to the best of my
                  knowledge. I understand this attestation will be logged with my user ID,
                  timestamp, and will serve as official documentation of compliance status.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>
                Attesting as: <strong>{profile?.full_name}</strong>
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Save Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={!allMandatoryAnswered || !attestationConfirmed || submitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Shield className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Attestation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

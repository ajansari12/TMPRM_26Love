import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import {
  Save,
  GitBranch,
  Loader2,
  Info,
  Users,
  Clock,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import type {
  TierRoutingRules,
  ReassessmentFrequencies,
} from '../settings/types';
import {
  DEFAULT_TIER_ROUTING,
  DEFAULT_REASSESSMENT_FREQUENCIES,
} from '../settings/types';
import type { SeniorApprovalConfig, SeniorApprover } from '../../types/workflow';

export default function WorkflowTab() {
  const { user } = useAuth();
  const { currentOrganization, isAdmin, isPlatformAdmin, updateOrganization, currentMembership } = useOrganization();

  const [tierRoutingRules, setTierRoutingRules] = useState<TierRoutingRules>(DEFAULT_TIER_ROUTING);
  const [reassessmentFrequencies, setReassessmentFrequencies] = useState<ReassessmentFrequencies>(DEFAULT_REASSESSMENT_FREQUENCIES);
  const [enableFastTrackApproval, setEnableFastTrackApproval] = useState(true);

  const [seniorApprovalConfig, setSeniorApprovalConfig] = useState<SeniorApprovalConfig | null>(null);
  const [seniorApprovers, setSeniorApprovers] = useState<SeniorApprover[]>([]);
  const [orgUsers, setOrgUsers] = useState<{ id: string; email: string; full_name?: string }[]>([]);
  const [newApproverUserId, setNewApproverUserId] = useState('');
  const [seniorApprovalTiers, setSeniorApprovalTiers] = useState<string[]>(['tier_5_critical']);
  const [saving, setSaving] = useState(false);

  const canConfigureAssessment = () => {
    if (!currentMembership) return false;
    return currentMembership.defense_line === '2nd' ||
           currentMembership.defense_line === 'admin' ||
           isAdmin ||
           isPlatformAdmin;
  };

  useEffect(() => {
    if (currentOrganization) {
      const settings = currentOrganization.settings as Record<string, unknown> | undefined;
      if (settings?.tier_routing_rules) {
        setTierRoutingRules(settings.tier_routing_rules as TierRoutingRules);
      }
      if (settings?.reassessment_frequencies) {
        setReassessmentFrequencies(settings.reassessment_frequencies as ReassessmentFrequencies);
      }
      if (typeof settings?.enable_fast_track_approval === 'boolean') {
        setEnableFastTrackApproval(settings.enable_fast_track_approval);
      }
    }
  }, [currentOrganization]);

  useEffect(() => {
    if (currentOrganization && canConfigureAssessment()) {
      loadSeniorApprovalConfig();
      loadSeniorApprovers();
      loadOrgUsers();
    }
  }, [currentOrganization]);

  async function loadSeniorApprovalConfig() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('senior_approval_config')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error && !error.message?.includes('does not exist')) {
        logger.error('Error loading senior approval config:', error);
        return;
      }

      if (data) {
        setSeniorApprovalConfig(data as SeniorApprovalConfig);
        setSeniorApprovalTiers(data.tiers_requiring_approval || ['tier_5_critical']);
      }
    } catch (error) {
      logger.error('Error loading senior approval config:', error);
    }
  }

  async function loadSeniorApprovers() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('senior_approvers')
        .select(`
          *,
          user:profiles!senior_approvers_user_id_fkey(id, email, full_name)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('created_at');

      if (error && !error.message?.includes('does not exist')) {
        logger.error('Error loading senior approvers:', error);
        return;
      }

      setSeniorApprovers((data as SeniorApprover[]) || []);
    } catch (error) {
      logger.error('Error loading senior approvers:', error);
    }
  }

  async function loadOrgUsers() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          user_id,
          profiles:profiles!organization_users_user_id_fkey(id, email, full_name)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true);

      if (error) {
        logger.error('Error loading org users:', error);
        return;
      }

      const users = (data || [])
        .map((ou) => ou.profiles as { id: string; email: string; full_name?: string } | null)
        .filter((p): p is { id: string; email: string; full_name?: string } => p !== null);

      setOrgUsers(users);
    } catch (error) {
      logger.error('Error loading org users:', error);
    }
  }

  async function handleSaveWorkflowConfig() {
    if (!currentOrganization || !canConfigureAssessment()) return;

    setSaving(true);
    try {
      const updatedSettings = {
        ...currentOrganization.settings,
        tier_routing_rules: tierRoutingRules,
        reassessment_frequencies: reassessmentFrequencies,
        enable_fast_track_approval: enableFastTrackApproval,
      };

      const success = await updateOrganization({
        settings: updatedSettings,
      });

      if (!success) {
        throw new Error('Failed to update workflow configuration');
      }

      toast.success('Workflow configuration saved');
    } catch (error) {
      logger.error('Error saving workflow configuration:', error);
      toast.error('Failed to save workflow configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSeniorApprovalConfig() {
    if (!currentOrganization || !canConfigureAssessment()) return;

    setSaving(true);
    try {
      const configData = {
        organization_id: currentOrganization.id,
        tiers_requiring_approval: seniorApprovalTiers,
        contract_value_threshold_cad: seniorApprovalConfig?.contract_value_threshold_cad || null,
        require_for_outsourcing: seniorApprovalConfig?.require_for_outsourcing ?? true,
        auto_escalate_after_days: seniorApprovalConfig?.auto_escalate_after_days || 3,
        reminder_after_days: seniorApprovalConfig?.reminder_after_days || 1,
        notify_on_assignment: seniorApprovalConfig?.notify_on_assignment ?? true,
        notify_on_completion: seniorApprovalConfig?.notify_on_completion ?? true,
        updated_at: new Date().toISOString(),
        created_by: user?.id,
      };

      const { error } = await supabase
        .from('senior_approval_config')
        .upsert(configData, { onConflict: 'organization_id' });

      if (error) throw error;

      toast.success('Senior approval configuration saved');
      await loadSeniorApprovalConfig();
    } catch (error) {
      logger.error('Error saving senior approval config:', error);
      toast.error('Failed to save senior approval configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSeniorApprover() {
    if (!currentOrganization || !newApproverUserId) return;

    const existingApprover = seniorApprovers.find(a => a.user_id === newApproverUserId);
    if (existingApprover) {
      toast.error('This user is already a senior approver');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('senior_approvers')
        .insert({
          organization_id: currentOrganization.id,
          user_id: newApproverUserId,
          approval_authority_level: 1,
          can_approve_tiers: seniorApprovalTiers,
          is_delegate: false,
          is_available: true,
          receive_notifications: true,
          is_active: true,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success('Senior approver added');
      setNewApproverUserId('');
      await loadSeniorApprovers();
    } catch (error) {
      logger.error('Error adding senior approver:', error);
      toast.error('Failed to add senior approver');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSeniorApprover(approverId: string) {
    if (!currentOrganization) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('senior_approvers')
        .update({ is_active: false })
        .eq('id', approverId)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      toast.success('Senior approver removed');
      await loadSeniorApprovers();
    } catch (error) {
      logger.error('Error removing senior approver:', error);
      toast.error('Failed to remove senior approver');
    } finally {
      setSaving(false);
    }
  }

  if (!canConfigureAssessment() || !currentOrganization) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          Workflow Configuration - {currentOrganization.name}
        </h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">Tier-Based Workflow Routing</p>
            <p className="mt-1">
              Configure how onboarding requests are routed based on vendor risk tier.
              Higher risk tiers typically require 2nd Line review, while lower risk
              tiers can be fast-tracked through 1B approval.
            </p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Fast-Track Approval</h3>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enableFastTrackApproval}
            onChange={(e) => setEnableFastTrackApproval(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">Enable Fast-Track Approval</span>
            <p className="text-xs text-gray-500">
              Allow 1B coordinators to approve low-risk vendors (Tier 1-2) without 2nd Line review
            </p>
          </div>
        </label>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Tier-Based Routing Rules</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure review requirements for each risk tier
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Tier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Require 2nd Line</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default Reviewer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auto-Approve Eligible</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(['tier_5', 'tier_4', 'tier_3', 'tier_2', 'tier_1'] as const).map((tier) => {
                const tierLabels: Record<string, { label: string; color: string }> = {
                  tier_5: { label: 'Tier 5 - Critical', color: 'bg-red-100 text-red-800' },
                  tier_4: { label: 'Tier 4 - High', color: 'bg-orange-100 text-orange-800' },
                  tier_3: { label: 'Tier 3 - Moderate', color: 'bg-amber-100 text-amber-800' },
                  tier_2: { label: 'Tier 2 - Low', color: 'bg-emerald-100 text-emerald-800' },
                  tier_1: { label: 'Tier 1 - Informational', color: 'bg-slate-100 text-slate-600' },
                };
                const tierInfo = tierLabels[tier];
                const rule = tierRoutingRules[tier];

                return (
                  <tr key={tier} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${tierInfo.color}`}>
                        {tierInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={rule.require_2nd_line}
                        onChange={(e) => setTierRoutingRules(prev => ({
                          ...prev,
                          [tier]: { ...prev[tier], require_2nd_line: e.target.checked }
                        }))}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={rule.default_reviewer}
                        onChange={(e) => setTierRoutingRules(prev => ({
                          ...prev,
                          [tier]: { ...prev[tier], default_reviewer: e.target.value }
                        }))}
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1b">1B Coordinator</option>
                        <option value="2nd">2nd Line Risk</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={rule.auto_approve_eligible}
                        onChange={(e) => setTierRoutingRules(prev => ({
                          ...prev,
                          [tier]: { ...prev[tier], auto_approve_eligible: e.target.checked }
                        }))}
                        disabled={rule.require_2nd_line}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Reassessment Frequencies</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure how often vendors in each tier require periodic reassessment (in months)
          </p>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(['tier_5', 'tier_4', 'tier_3', 'tier_2', 'tier_1'] as const).map((tier) => {
              const tierLabels: Record<string, string> = {
                tier_5: 'Critical',
                tier_4: 'High',
                tier_3: 'Moderate',
                tier_2: 'Low',
                tier_1: 'Informational',
              };

              return (
                <div key={tier} className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tierLabels[tier]}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={reassessmentFrequencies[tier]}
                      onChange={(e) => setReassessmentFrequencies(prev => ({
                        ...prev,
                        [tier]: parseInt(e.target.value) || 12
                      }))}
                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">months</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSaveWorkflowConfig}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Workflow Configuration'}
        </button>
      </div>

      <div className="border-t border-gray-200 pt-8 mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-rose-600" />
          <h3 className="text-lg font-semibold text-gray-900">Senior Management Approval</h3>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
            <div className="text-sm text-rose-700">
              <p className="font-medium">OSFI B-10 Section 2.1.2 Compliance</p>
              <p className="mt-1">
                Critical and high-risk vendor engagements require approval at an appropriate
                level of management. Configure which tiers require senior management sign-off
                and designate authorized approvers.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-5">
            <h4 className="font-medium text-gray-900 mb-4">Tiers Requiring Senior Approval</h4>
            <p className="text-sm text-gray-500 mb-4">
              Select which risk tiers require senior management approval before vendor onboarding can proceed.
            </p>

            <div className="space-y-3">
              {[
                { value: 'tier_5_critical', label: 'Tier 5 - Critical', color: 'bg-red-100 text-red-800' },
                { value: 'tier_4_high', label: 'Tier 4 - High', color: 'bg-orange-100 text-orange-800' },
                { value: 'tier_3_moderate', label: 'Tier 3 - Moderate', color: 'bg-amber-100 text-amber-800' },
              ].map((tier) => (
                <label key={tier.value} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={seniorApprovalTiers.includes(tier.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSeniorApprovalTiers(prev => [...prev, tier.value]);
                      } else {
                        setSeniorApprovalTiers(prev => prev.filter(t => t !== tier.value));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tier.color}`}>
                    {tier.label}
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={seniorApprovalConfig?.require_for_outsourcing ?? true}
                  onChange={(e) => setSeniorApprovalConfig(prev => ({
                    ...prev!,
                    require_for_outsourcing: e.target.checked,
                  }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Require for Outsourcing</span>
                  <p className="text-xs text-gray-500">Always require senior approval for outsourcing arrangements</p>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Value Threshold (CAD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={seniorApprovalConfig?.contract_value_threshold_cad || ''}
                  onChange={(e) => setSeniorApprovalConfig(prev => ({
                    ...prev!,
                    contract_value_threshold_cad: parseInt(e.target.value) || undefined,
                  }))}
                  placeholder="e.g., 1000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Require senior approval for contracts above this value (optional)
                </p>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5">
            <h4 className="font-medium text-gray-900 mb-4">Designated Senior Approvers</h4>
            <p className="text-sm text-gray-500 mb-4">
              Add users who are authorized to provide senior management approval for vendor onboarding.
            </p>

            {seniorApprovers.length > 0 ? (
              <div className="space-y-2 mb-4">
                {seniorApprovers.map((approver) => (
                  <div
                    key={approver.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {approver.user?.full_name || approver.user?.email || 'Unknown User'}
                      </p>
                      {approver.user?.email && approver.user?.full_name && (
                        <p className="text-xs text-gray-500">{approver.user.email}</p>
                      )}
                      {approver.title && (
                        <p className="text-xs text-gray-500 mt-0.5">{approver.title}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSeniorApprover(approver.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg mb-4">
                <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No senior approvers configured</p>
              </div>
            )}

            <div className="flex gap-2">
              <select
                value={newApproverUserId}
                onChange={(e) => setNewApproverUserId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a user...</option>
                {orgUsers
                  .filter(u => !seniorApprovers.some(a => a.user_id === u.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddSeniorApprover}
                disabled={saving || !newApproverUserId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                Add
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reminder After (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={seniorApprovalConfig?.reminder_after_days || 1}
                    onChange={(e) => setSeniorApprovalConfig(prev => ({
                      ...prev!,
                      reminder_after_days: parseInt(e.target.value) || 1,
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto-Escalate After (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={seniorApprovalConfig?.auto_escalate_after_days || 3}
                    onChange={(e) => setSeniorApprovalConfig(prev => ({
                      ...prev!,
                      auto_escalate_after_days: parseInt(e.target.value) || 3,
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={seniorApprovalConfig?.notify_on_assignment ?? true}
                  onChange={(e) => setSeniorApprovalConfig(prev => ({
                    ...prev!,
                    notify_on_assignment: e.target.checked,
                  }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Email approvers when assigned</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={seniorApprovalConfig?.notify_on_completion ?? true}
                  onChange={(e) => setSeniorApprovalConfig(prev => ({
                    ...prev!,
                    notify_on_completion: e.target.checked,
                  }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Notify requestor on approval/rejection</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 mt-6 border-t border-gray-200">
          <button
            onClick={handleSaveSeniorApprovalConfig}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:bg-gray-400"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Senior Approval Config'}
          </button>
        </div>
      </div>
    </div>
  );
}

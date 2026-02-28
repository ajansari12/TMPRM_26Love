import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import {
  Save,
  Building2,
  Clock,
  Info,
  Mail,
  TrendingUp,
  Layers,
} from 'lucide-react';
import type { OrganizationSettings } from '../../types/organization';
import { DEFAULT_ORG_SETTINGS } from './types';

export default function OrganizationTab() {
  const { currentOrganization, isAdmin, isPlatformAdmin, updateOrganization } = useOrganization();

  const canManageOrgSettings = isAdmin || isPlatformAdmin;

  const [saving, setSaving] = useState(false);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings>(DEFAULT_ORG_SETTINGS);
  const [riskThresholds, setRiskThresholds] = useState({
    max_critical_vendors: 50,
    max_single_vendor_concentration_pct: 25,
    risk_appetite_statement: '',
  });
  const [escalationEmails, setEscalationEmails] = useState({
    '1b': '',
    '2nd': '',
  });
  const [concentrationThresholds, setConcentrationThresholds] = useState<Record<string, unknown>[]>([]);
  const [editingConcentrationThreshold, setEditingConcentrationThreshold] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      setOrgSettings(currentOrganization.settings || DEFAULT_ORG_SETTINGS);
      setRiskThresholds({
        max_critical_vendors: currentOrganization.max_critical_vendors || 50,
        max_single_vendor_concentration_pct: currentOrganization.max_single_vendor_concentration_pct || 25,
        risk_appetite_statement: currentOrganization.risk_appetite_statement || '',
      });
    }
  }, [currentOrganization]);

  useEffect(() => {
    if (currentOrganization) {
      loadEscalationEmails();
      fetchConcentrationThresholds();
    }
  }, [currentOrganization]);

  async function loadEscalationEmails() {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('defense_line_configs')
        .select('defense_line, escalation_email')
        .eq('organization_id', currentOrganization.id);

      if (error) {
        if (!error.message?.includes('does not exist')) {
          logger.error('Error loading escalation emails:', error);
        }
        return;
      }

      const emails: Record<string, string> = { '1b': '', '2nd': '' };
      data?.forEach((config) => {
        if (config.defense_line === '1b' || config.defense_line === '2nd') {
          emails[config.defense_line] = config.escalation_email || '';
        }
      });
      setEscalationEmails(emails);
    } catch (error) {
      logger.error('Error loading escalation emails:', error);
    }
  }

  async function fetchConcentrationThresholds() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('concentration_thresholds')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('threshold_type');

      if (error) throw error;
      setConcentrationThresholds(data || []);
    } catch (error) {
      logger.error('Error fetching concentration thresholds:', error);
    }
  }

  async function saveEscalationEmails() {
    if (!currentOrganization) return;

    for (const [defenseLine, email] of Object.entries(escalationEmails)) {
      try {
        const { error } = await supabase
          .from('defense_line_configs')
          .upsert({
            organization_id: currentOrganization.id,
            defense_line: defenseLine,
            escalation_email: email || null,
            display_name: defenseLine === '1b' ? '1st Line Coordinator' : '2nd Line Risk',
            is_required_in_workflow: true,
            review_sla_hours: 48,
            escalation_after_hours: 72,
            notify_on_new_request: true,
            notify_on_overdue: true,
          }, {
            onConflict: 'organization_id,defense_line',
          });

        if (error && !error.message?.includes('does not exist')) {
          logger.error(`Error saving ${defenseLine} escalation email:`, error);
        }
      } catch (error) {
        logger.error(`Error saving ${defenseLine} escalation email:`, error);
      }
    }
  }

  async function handleSaveOrgSettings() {
    if (!currentOrganization || !canManageOrgSettings) return;

    if (orgSettings.onboarding_sla_days < 1) {
      toast.error('Onboarding SLA must be at least 1 day');
      return;
    }

    if (riskThresholds.max_critical_vendors < 1) {
      toast.error('Max critical vendors must be at least 1');
      return;
    }

    if (riskThresholds.max_single_vendor_concentration_pct < 1 || riskThresholds.max_single_vendor_concentration_pct > 100) {
      toast.error('Concentration limit must be between 1% and 100%');
      return;
    }

    setSaving(true);
    try {
      const success = await updateOrganization({
        settings: orgSettings,
        max_critical_vendors: riskThresholds.max_critical_vendors,
        max_single_vendor_concentration_pct: riskThresholds.max_single_vendor_concentration_pct,
        risk_appetite_statement: riskThresholds.risk_appetite_statement,
      });

      if (!success) {
        throw new Error('Failed to update organization');
      }

      await saveEscalationEmails();

      toast.success('Organization settings saved');
    } catch (error) {
      logger.error('Error saving organization settings:', error);
      toast.error('Failed to save organization settings');
    } finally {
      setSaving(false);
    }
  }

  function handleReminderDaysChange(value: string) {
    const days = value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0);
    setOrgSettings(prev => ({ ...prev, due_diligence_reminder_days: days }));
  }

  async function handleSaveConcentrationThreshold(thresholdId: string) {
    if (!currentOrganization) return;

    const threshold = concentrationThresholds.find((t) => t.id === thresholdId);
    if (!threshold) return;

    const warningLevel = parseFloat(String(threshold.warning_level)) || 0;
    const criticalLevel = parseFloat(String(threshold.critical_level)) || 0;

    if (warningLevel <= 0 || criticalLevel <= 0) {
      toast.error('Threshold levels must be greater than 0');
      return;
    }

    if (warningLevel >= criticalLevel) {
      toast.error('Warning level must be less than critical level');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('concentration_thresholds')
        .update({
          warning_level: warningLevel,
          critical_level: criticalLevel,
          is_active: threshold.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', thresholdId)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      setEditingConcentrationThreshold(null);
      toast.success('Concentration threshold saved');
      await fetchConcentrationThresholds();
    } catch (error) {
      logger.error('Error saving concentration threshold:', error);
      toast.error('Failed to save concentration threshold');
    } finally {
      setSaving(false);
    }
  }

  function updateConcentrationThreshold(thresholdId: string, field: string, value: unknown) {
    setConcentrationThresholds((prev) =>
      prev.map((t) =>
        t.id === thresholdId ? { ...t, [field]: value } : t
      )
    );
  }

  if (!canManageOrgSettings || !currentOrganization) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          Organization Settings - {currentOrganization.name}
        </h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">Configuration Overview</p>
            <p className="mt-1">
              These settings control workflow behavior, notification timing, and risk thresholds
              for your organization. Changes apply immediately to all new requests.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Workflow Settings</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Onboarding SLA (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={orgSettings.onboarding_sla_days}
                onChange={(e) => setOrgSettings(prev => ({ ...prev, onboarding_sla_days: parseInt(e.target.value) || 30 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Target days to complete vendor onboarding</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Review Frequency (Days)
              </label>
              <input
                type="number"
                min="30"
                max="730"
                value={orgSettings.default_review_frequency_days}
                onChange={(e) => setOrgSettings(prev => ({ ...prev, default_review_frequency_days: parseInt(e.target.value) || 365 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">How often vendors should be reviewed</p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={orgSettings.require_1b_review}
                  onChange={(e) => setOrgSettings(prev => ({ ...prev, require_1b_review: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Require 1B Coordinator Review</span>
                  <p className="text-xs text-gray-500">All requests must pass through 1st line coordinator</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={orgSettings.require_2nd_line_for_critical}
                  onChange={(e) => setOrgSettings(prev => ({ ...prev, require_2nd_line_for_critical: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Require 2nd Line for Critical</span>
                  <p className="text-xs text-gray-500">Critical/high-risk vendors require 2nd line approval</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={orgSettings.auto_approve_low_risk}
                  onChange={(e) => setOrgSettings(prev => ({ ...prev, auto_approve_low_risk: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Auto-Approve Low Risk</span>
                  <p className="text-xs text-gray-500">Low-risk vendors can be auto-approved after 1B review</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Notification Settings</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Diligence Reminder Days
              </label>
              <input
                type="text"
                value={orgSettings.due_diligence_reminder_days.join(', ')}
                onChange={(e) => handleReminderDaysChange(e.target.value)}
                placeholder="30, 14, 7"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Days before due date to send reminders (comma-separated)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                1B Coordinator Escalation Email
              </label>
              <input
                type="email"
                value={escalationEmails['1b']}
                onChange={(e) => setEscalationEmails(prev => ({ ...prev, '1b': e.target.value }))}
                placeholder="coordinator-escalation@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Email for 1B review escalations</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                2nd Line Escalation Email
              </label>
              <input
                type="email"
                value={escalationEmails['2nd']}
                onChange={(e) => setEscalationEmails(prev => ({ ...prev, '2nd': e.target.value }))}
                placeholder="risk-escalation@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Email for 2nd line review escalations</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Risk Thresholds</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Critical Vendors
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={riskThresholds.max_critical_vendors}
                onChange={(e) => setRiskThresholds(prev => ({ ...prev, max_critical_vendors: parseInt(e.target.value) || 50 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Alert when critical vendor count exceeds this threshold</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Single Vendor Concentration Limit (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={riskThresholds.max_single_vendor_concentration_pct}
                onChange={(e) => setRiskThresholds(prev => ({ ...prev, max_single_vendor_concentration_pct: parseInt(e.target.value) || 25 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Maximum spend concentration with a single vendor</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk Appetite Statement
              </label>
              <textarea
                value={riskThresholds.risk_appetite_statement}
                onChange={(e) => setRiskThresholds(prev => ({ ...prev, risk_appetite_statement: e.target.value }))}
                rows={3}
                placeholder="Describe your organization's third-party risk appetite..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Optional statement displayed on risk dashboards and reports</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Concentration Thresholds</h3>
          </div>
          <div className="text-xs text-gray-500">
            Used in Concentration Dashboard
          </div>
        </div>

        <div className="space-y-4">
          {concentrationThresholds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No concentration thresholds configured</p>
              <p className="text-xs mt-1">Thresholds will be created automatically</p>
            </div>
          ) : (
            concentrationThresholds.map((threshold) => (
              <div key={String(threshold.id)} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{String(threshold.threshold_name)}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{String(threshold.description)}</p>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(threshold.is_active)}
                      onChange={(e) =>
                        updateConcentrationThreshold(
                          String(threshold.id),
                          'is_active',
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600">Active</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Warning Level (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={String(threshold.warning_level)}
                      onChange={(e) =>
                        updateConcentrationThreshold(
                          String(threshold.id),
                          'warning_level',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      disabled={editingConcentrationThreshold !== String(threshold.id)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Critical Level (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={String(threshold.critical_level)}
                      onChange={(e) =>
                        updateConcentrationThreshold(
                          String(threshold.id),
                          'critical_level',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      disabled={editingConcentrationThreshold !== String(threshold.id)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-200">
                  {editingConcentrationThreshold === String(threshold.id) ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingConcentrationThreshold(null);
                          fetchConcentrationThresholds();
                        }}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveConcentrationThreshold(String(threshold.id))}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingConcentrationThreshold(String(threshold.id))}
                      className="px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-start gap-2 text-xs text-gray-600">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">About Concentration Thresholds</p>
              <p className="mt-1">
                These thresholds are used to detect concentration risk in the Concentration Dashboard.
                Warning levels trigger alerts when exceeded, and critical levels indicate severe risk exposure.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSaveOrgSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Organization Settings'}
        </button>
      </div>
    </div>
  );
}

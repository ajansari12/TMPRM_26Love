import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import {
  Save,
  Layers,
  RefreshCw,
  Info,
  Shield,
} from 'lucide-react';
import type { TierConfigItem, OSFIWeights } from './types';
import { DEFAULT_OSFI_WEIGHTS, TIER_COLORS } from './types';

export default function TiersTab() {
  const { profile } = useAuth();
  const { currentOrganization, isAdmin, isPlatformAdmin } = useOrganization();

  const canManageOrgSettings = isAdmin || isPlatformAdmin;
  const isRiskManager = profile?.role === 'risk_manager';

  const [tierConfig, setTierConfig] = useState<TierConfigItem[]>([]);
  const [osfiWeights, setOsfiWeights] = useState<OSFIWeights>(DEFAULT_OSFI_WEIGHTS);
  const [vendorPreviewData, setVendorPreviewData] = useState<{ tier: string; count: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOrganization && (isRiskManager || canManageOrgSettings)) {
      fetchTierConfig();
      fetchOsfiWeights();
      fetchVendorPreview();
    }
  }, [currentOrganization]);

  async function fetchTierConfig() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('organization_tier_config')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('display_order');

      if (error) throw error;
      setTierConfig(data || []);
    } catch (error) {
      logger.error('Error fetching tier config:', error);
    }
  }

  async function fetchOsfiWeights() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('organization_osfi_weights')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setOsfiWeights(data);
      }
    } catch (error) {
      logger.error('Error fetching OSFI weights:', error);
    }
  }

  async function fetchVendorPreview() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('tier, id')
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      const counts = (data || []).reduce((acc: Record<string, number>, v) => {
        const tier = v.tier || 'unassessed';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {});

      setVendorPreviewData(
        Object.entries(counts).map(([tier, count]) => ({ tier, count }))
      );
    } catch (error) {
      logger.error('Error fetching vendor preview:', error);
    }
  }

  function validateTierThresholds(): boolean {
    const sortedTiers = [...tierConfig].sort((a, b) => a.display_order - b.display_order);
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      if (sortedTiers[i].min_risk_score <= sortedTiers[i + 1].min_risk_score) {
        toast.error(`${sortedTiers[i].tier_label} threshold must be higher than ${sortedTiers[i + 1].tier_label}`);
        return false;
      }
    }
    return true;
  }

  async function handleSaveTierConfig() {
    if (!currentOrganization || !canManageOrgSettings) return;

    if (!validateTierThresholds()) return;

    setSaving(true);
    try {
      for (const tier of tierConfig) {
        const { error } = await supabase
          .from('organization_tier_config')
          .update({
            min_risk_score: tier.min_risk_score,
            review_frequency_days: tier.review_frequency_days,
            tier_label: tier.tier_label,
            tier_description: tier.tier_description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tier.id);

        if (error) throw error;
      }
      toast.success('Tier configuration saved');
    } catch (error) {
      logger.error('Error saving tier config:', error);
      toast.error('Failed to save tier configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOsfiWeights() {
    if (!currentOrganization || !canManageOrgSettings) return;

    const totalWeight =
      osfiWeights.exit_strategy_weight +
      osfiWeights.bcp_weight +
      osfiWeights.incident_response_weight +
      osfiWeights.audit_rights_weight +
      osfiWeights.financial_viability_weight +
      osfiWeights.insurance_weight;

    if (totalWeight < 0.01) {
      toast.error('At least one OSFI weight must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organization_osfi_weights')
        .upsert({
          organization_id: currentOrganization.id,
          ...osfiWeights,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });

      if (error) throw error;
      toast.success('OSFI weights saved');
    } catch (error) {
      logger.error('Error saving OSFI weights:', error);
      toast.error('Failed to save OSFI weights');
    } finally {
      setSaving(false);
    }
  }

  function handleResetTierConfig() {
    setTierConfig(prev => prev.map(tier => {
      const defaults: Record<string, { score: number; days: number | null }> = {
        tier_5_critical: { score: 15, days: 90 },
        tier_4_high: { score: 10, days: 180 },
        tier_3_moderate: { score: 5, days: 365 },
        tier_2_low: { score: 2, days: 730 },
        tier_1_informational: { score: 0, days: null },
      };
      const def = defaults[tier.tier_level];
      return def ? { ...tier, min_risk_score: def.score, review_frequency_days: def.days } : tier;
    }));
  }

  function handleResetOsfiWeights() {
    setOsfiWeights(DEFAULT_OSFI_WEIGHTS);
  }

  function updateTierConfig(tierLevel: string, field: string, value: unknown) {
    setTierConfig(prev =>
      prev.map(t =>
        t.tier_level === tierLevel ? { ...t, [field]: value } : t
      )
    );
  }

  if (!currentOrganization || !(isRiskManager || canManageOrgSettings)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Tier Configuration</h2>
        </div>
        <button
          onClick={handleResetTierConfig}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">Tier Threshold Configuration</p>
            <p className="mt-1">
              Configure the risk score thresholds that determine vendor tier assignments.
              Higher tiers should have higher minimum scores. Review frequency determines
              how often vendors in each tier require reassessment.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Risk Score Scale</h3>
        <div className="relative h-12 bg-gradient-to-r from-emerald-100 via-amber-100 to-red-100 rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex">
            {tierConfig.map((tier, idx) => {
              const colors = TIER_COLORS[tier.tier_color] || TIER_COLORS.slate;
              const nextTier = tierConfig[idx - 1];
              const width = nextTier
                ? ((nextTier.min_risk_score - tier.min_risk_score) / 25) * 100
                : ((25 - tier.min_risk_score) / 25) * 100;
              const left = (tier.min_risk_score / 25) * 100;

              return (
                <div
                  key={tier.tier_level}
                  className={`absolute h-full flex items-center justify-center text-xs font-medium ${colors.text} border-r border-white/50`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="truncate px-1">{tier.tier_label}</span>
                </div>
              );
            })}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[10px] text-gray-600">
            <span>0</span>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20</span>
            <span>25</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Risk Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Review Frequency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Vendors</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tierConfig.map((tier) => {
              const colors = TIER_COLORS[tier.tier_color] || TIER_COLORS.slate;
              const vendorCount = vendorPreviewData.find(v => v.tier === tier.tier_level)?.count || 0;

              return (
                <tr key={tier.tier_level} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                        {tier.tier_label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">&ge;</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="25"
                        value={tier.min_risk_score}
                        onChange={(e) => updateTierConfig(tier.tier_level, 'min_risk_score', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="1095"
                        value={tier.review_frequency_days || ''}
                        onChange={(e) => updateTierConfig(tier.tier_level, 'review_frequency_days', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="N/A"
                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-500">days</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={tier.tier_description || ''}
                      onChange={(e) => updateTierConfig(tier.tier_level, 'tier_description', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      vendorCount > 0 ? colors.bg + ' ' + colors.text : 'bg-gray-100 text-gray-500'
                    }`}>
                      {vendorCount} vendor{vendorCount !== 1 ? 's' : ''}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveTierConfig}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Tier Configuration'}
        </button>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-900">OSFI B-10 Adjustment Weights</h3>
          </div>
          <button
            onClick={handleResetOsfiWeights}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="text-sm text-emerald-700">
              <p className="font-medium">OSFI Compliance Factors</p>
              <p className="mt-1">
                These weights determine how much OSFI B-10 compliance factors adjust the
                likelihood score in risk assessments. Higher weights mean greater impact
                on the final tier calculation.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: 'exit_strategy_weight', label: 'Exit Strategy', description: 'Documented transition and exit plans' },
            { key: 'bcp_weight', label: 'Business Continuity', description: 'BCP documentation and testing' },
            { key: 'incident_response_weight', label: 'Incident Response', description: 'Incident management capability' },
            { key: 'audit_rights_weight', label: 'Audit Rights', description: 'Contractual audit provisions' },
            { key: 'financial_viability_weight', label: 'Financial Viability', description: 'Financial stability assessment' },
            { key: 'insurance_weight', label: 'Insurance Coverage', description: 'Liability and cyber insurance' },
          ].map((factor) => (
            <div key={factor.key} className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{factor.label}</label>
              <p className="text-xs text-gray-500 mb-2">{factor.description}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={osfiWeights[factor.key as keyof OSFIWeights] || 0}
                  onChange={(e) => setOsfiWeights(prev => ({
                    ...prev,
                    [factor.key]: parseFloat(e.target.value) || 0
                  }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">weight</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveOsfiWeights}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save OSFI Weights'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import { Scale, RefreshCw, Info, AlertTriangle, Save } from 'lucide-react';
import { IMPACT_FACTORS, LIKELIHOOD_FACTORS } from './types';

export default function WeightsTab() {
  const { user } = useAuth();

  const [categoryWeights, setCategoryWeights] = useState<Record<string, unknown>[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategoryWeights();
  }, []);

  async function fetchCategoryWeights() {
    try {
      const { data, error } = await supabase
        .from('category_weights')
        .select('*')
        .order('category');

      if (error) {
        logger.error('Error fetching category weights:', error);
        toast.error('Failed to load category weights');
        setCategoryWeights([]);
      } else if (data && data.length > 0) {
        setCategoryWeights(data);
        setSelectedCategory(data[0].category as string);
      } else {
        setCategoryWeights([]);
      }
    } catch (error) {
      logger.error('Error fetching category weights:', error);
      setCategoryWeights([]);
    }
  }

  async function handleSaveWeights() {
    const category = categoryWeights.find((c) => c.category === selectedCategory);
    if (!category) return;

    const impactSum = IMPACT_FACTORS.reduce((sum, f) => sum + (parseFloat(String(category[f.key])) || 0), 0);
    const likelihoodSum = LIKELIHOOD_FACTORS.reduce((sum, f) => sum + (parseFloat(String(category[f.key])) || 0), 0);

    if (Math.abs(impactSum - 1) > 0.001 || Math.abs(likelihoodSum - 1) > 0.001) {
      toast.error('Impact weights must sum to 1.0 and Likelihood weights must sum to 1.0');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('category_weights')
        .update({
          ...IMPACT_FACTORS.reduce((acc, f) => ({ ...acc, [f.key]: category[f.key] }), {}),
          ...LIKELIHOOD_FACTORS.reduce((acc, f) => ({ ...acc, [f.key]: category[f.key] }), {}),
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('category', selectedCategory);

      if (error) throw error;
      toast.success('Weights saved successfully');
    } catch (error) {
      logger.error('Error saving weights:', error);
      toast.error('Failed to save weights');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetWeights() {
    const defaultWeights = {
      weight_criticality: 0.2,
      weight_product_type: 0.15,
      weight_dependency: 0.2,
      weight_financial_resilience: 0.15,
      weight_strategic_reputational: 0.15,
      weight_data_sensitivity: 0.15,
      weight_concentration: 0.15,
      weight_access_level: 0.2,
      weight_subcontractor: 0.15,
      weight_legal_regulatory: 0.2,
      weight_operational_maturity: 0.15,
      weight_other_risks: 0.15,
    };

    setCategoryWeights((prev) =>
      prev.map((c) =>
        c.category === selectedCategory ? { ...c, ...defaultWeights } : c
      )
    );
  }

  function updateWeight(factor: string, value: string) {
    setCategoryWeights((prev) =>
      prev.map((c) =>
        c.category === selectedCategory
          ? { ...c, [factor]: parseFloat(value) || 0 }
          : c
      )
    );
  }

  const selectedCategoryData = categoryWeights.find((c) => c.category === selectedCategory);
  const impactSum = selectedCategoryData
    ? IMPACT_FACTORS.reduce((sum, f) => sum + (parseFloat(String(selectedCategoryData[f.key])) || 0), 0)
    : 0;
  const likelihoodSum = selectedCategoryData
    ? LIKELIHOOD_FACTORS.reduce((sum, f) => sum + (parseFloat(String(selectedCategoryData[f.key])) || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Category Risk Weights</h2>
        </div>
        <button
          onClick={handleResetWeights}
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
            <p className="font-medium">Weight Configuration</p>
            <p className="mt-1">
              Impact weights and Likelihood weights must each sum to 1.0. These weights determine
              how different factors contribute to the overall risk score for each service category.
            </p>
          </div>
        </div>
      </div>

      {categoryWeights.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">No Categories Available</p>
              <p className="mt-1">
                Category weights could not be loaded. This may be a configuration issue.
                Please contact your system administrator or try refreshing the page.
              </p>
              <button
                onClick={fetchCategoryWeights}
                className="mt-2 flex items-center gap-1 text-amber-800 hover:text-amber-900 font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {categoryWeights.map((cat) => (
              <option key={String(cat.category)} value={String(cat.category)}>
                {String(cat.category_display_name)}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedCategoryData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Impact Factors</h3>
              <span className={`text-sm font-medium ${Math.abs(impactSum - 1) < 0.001 ? 'text-emerald-600' : 'text-red-600'}`}>
                Sum: {impactSum.toFixed(3)}
              </span>
            </div>
            <div className="space-y-4">
              {IMPACT_FACTORS.map((factor) => (
                <div key={factor.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">{factor.label}</label>
                    <span className="text-xs text-gray-500">{factor.description}</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={Number(selectedCategoryData[factor.key]) || 0}
                    onChange={(e) => updateWeight(factor.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Likelihood Factors</h3>
              <span className={`text-sm font-medium ${Math.abs(likelihoodSum - 1) < 0.001 ? 'text-emerald-600' : 'text-red-600'}`}>
                Sum: {likelihoodSum.toFixed(3)}
              </span>
            </div>
            <div className="space-y-4">
              {LIKELIHOOD_FACTORS.map((factor) => (
                <div key={factor.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">{factor.label}</label>
                    <span className="text-xs text-gray-500">{factor.description}</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={Number(selectedCategoryData[factor.key]) || 0}
                    onChange={(e) => updateWeight(factor.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSaveWeights}
          disabled={saving || Math.abs(impactSum - 1) > 0.001 || Math.abs(likelihoodSum - 1) > 0.001}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Weights'}
        </button>
      </div>
    </div>
  );
}

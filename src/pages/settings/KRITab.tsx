import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import { Activity, AlertTriangle } from 'lucide-react';

export default function KRITab() {
  const { user } = useAuth();

  const [kriThresholds, setKriThresholds] = useState<Record<string, unknown>[]>([]);
  const [editingKRI, setEditingKRI] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchKRIThresholds() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('kri_thresholds')
          .select('*')
          .order('display_order');

        if (error) {
          logger.error('Error fetching KRI thresholds:', error);
          toast.error('Failed to load KRI thresholds');
          return;
        }
        setKriThresholds(data || []);
      } catch (error) {
        logger.error('Error fetching KRI thresholds:', error);
      }
    }
    fetchKRIThresholds();
  }, [user]);

  function updateKRI(kriCode: string, field: string, value: unknown) {
    setKriThresholds((prev) =>
      prev.map((k) =>
        k.kri_code === kriCode ? { ...k, [field]: value } : k
      )
    );
  }

  async function handleSaveKRI(kriCode: string) {
    const kri = kriThresholds.find((k) => k.kri_code === kriCode);
    if (!kri) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('kri_thresholds')
        .update({
          green_min: kri.green_min,
          green_max: kri.green_max,
          amber_min: kri.amber_min,
          amber_max: kri.amber_max,
          red_min: kri.red_min,
          red_max: kri.red_max,
          is_enabled: kri.is_enabled,
          notify_on_amber: kri.notify_on_amber,
          notify_on_red: kri.notify_on_red,
          updated_at: new Date().toISOString(),
        })
        .eq('kri_code', kriCode);

      if (error) throw error;
      setEditingKRI(null);
      toast.success('KRI threshold saved');
    } catch (error) {
      logger.error('Error saving KRI:', error);
      toast.error('Failed to save KRI threshold');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">KRI Threshold Configuration</h2>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-medium">Threshold Guidelines</p>
            <p className="mt-1">
              For indicators where higher is better (e.g., compliance rates), Green should have the highest values.
              For indicators where lower is better (e.g., incident counts), Green should have the lowest values.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {kriThresholds.map((kri) => (
          <div key={String(kri.kri_code)} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{String(kri.kri_name)}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    kri.is_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {kri.is_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{String(kri.description)}</p>
              </div>
              <div className="flex items-center gap-2">
                {editingKRI === kri.kri_code ? (
                  <>
                    <button
                      onClick={() => handleSaveKRI(String(kri.kri_code))}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingKRI(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingKRI(String(kri.kri_code))}
                    className="px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-emerald-700">Green Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={kri.green_min ?? ''}
                    onChange={(e) => updateKRI(String(kri.kri_code), 'green_min', parseFloat(e.target.value))}
                    disabled={editingKRI !== kri.kri_code}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                    placeholder="Min"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    value={kri.green_max ?? ''}
                    onChange={(e) => updateKRI(String(kri.kri_code), 'green_max', parseFloat(e.target.value))}
                    disabled={editingKRI !== kri.kri_code}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-amber-700">Amber Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={kri.amber_min ?? ''}
                    onChange={(e) => updateKRI(String(kri.kri_code), 'amber_min', parseFloat(e.target.value))}
                    disabled={editingKRI !== kri.kri_code}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                    placeholder="Min"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    value={kri.amber_max ?? ''}
                    onChange={(e) => updateKRI(String(kri.kri_code), 'amber_max', parseFloat(e.target.value))}
                    disabled={editingKRI !== kri.kri_code}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-red-700">Red Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={kri.red_min ?? ''}
                    onChange={(e) => updateKRI(String(kri.kri_code), 'red_min', parseFloat(e.target.value))}
                    disabled={editingKRI !== kri.kri_code}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                    placeholder="Min"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    value={kri.red_max ?? ''}
                    onChange={(e) => updateKRI(String(kri.kri_code), 'red_max', parseFloat(e.target.value))}
                    disabled={editingKRI !== kri.kri_code}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">Options</label>
                <div className="space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(kri.is_enabled)}
                      onChange={(e) => updateKRI(String(kri.kri_code), 'is_enabled', e.target.checked)}
                      disabled={editingKRI !== kri.kri_code}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs text-gray-600">Enabled</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(kri.notify_on_red)}
                      onChange={(e) => updateKRI(String(kri.kri_code), 'notify_on_red', e.target.checked)}
                      disabled={editingKRI !== kri.kri_code}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs text-gray-600">Notify on Red</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

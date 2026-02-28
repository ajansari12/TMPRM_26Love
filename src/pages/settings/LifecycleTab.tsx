import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import { GitBranch } from 'lucide-react';

export default function LifecycleTab() {
  const { user } = useAuth();

  const [lifecycleConfig, setLifecycleConfig] = useState<Record<string, unknown>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchLifecycleConfig() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('lifecycle_config')
          .select('*')
          .order('display_order');

        if (error) {
          logger.error('Error fetching lifecycle config:', error);
          toast.error('Failed to load lifecycle configuration');
          return;
        }
        setLifecycleConfig(data || []);
      } catch (error) {
        logger.error('Error fetching lifecycle config:', error);
      }
    }
    fetchLifecycleConfig();
  }, [user]);

  function updateLifecycle(stageCode: string, field: string, value: unknown) {
    setLifecycleConfig((prev) =>
      prev.map((s) =>
        s.stage_code === stageCode ? { ...s, [field]: value } : s
      )
    );
  }

  async function handleSaveLifecycle(stageCode: string) {
    const stage = lifecycleConfig.find((s) => s.stage_code === stageCode);
    if (!stage) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('lifecycle_config')
        .update({
          stage_name: stage.stage_name,
          description: stage.description,
          is_active: stage.is_active,
          notification_on_enter: stage.notification_on_enter,
          days_until_escalation: stage.days_until_escalation,
          updated_at: new Date().toISOString(),
        })
        .eq('stage_code', stageCode);

      if (error) throw error;
      toast.success('Lifecycle stage saved');
    } catch (error) {
      logger.error('Error saving lifecycle:', error);
      toast.error('Failed to save lifecycle stage');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Lifecycle Stage Configuration</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notify</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escalation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lifecycleConfig.map((stage) => (
              <tr key={String(stage.stage_code)} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{String(stage.display_order)}</td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={String(stage.stage_name)}
                    onChange={(e) => updateLifecycle(String(stage.stage_code), 'stage_name', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={String(stage.description || '')}
                    onChange={(e) => updateLifecycle(String(stage.stage_code), 'description', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(stage.notification_on_enter)}
                    onChange={(e) => updateLifecycle(String(stage.stage_code), 'notification_on_enter', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={stage.days_until_escalation || ''}
                    onChange={(e) => updateLifecycle(String(stage.stage_code), 'days_until_escalation', parseInt(e.target.value) || null)}
                    placeholder="Days"
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    stage.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {stage.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleSaveLifecycle(String(stage.stage_code))}
                    disabled={saving}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

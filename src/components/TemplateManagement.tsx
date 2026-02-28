import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Edit2, Save, X, Sparkles, AlertCircle } from 'lucide-react';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { SERVICE_CATEGORIES, PROVIDER_TYPES, BUSINESS_UNITS } from '../lib/constants';
import ConfirmModal from './ConfirmModal';

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_system_template: boolean;
  template_data: Record<string, unknown>;
  created_at: string;
}

interface TemplateManagementProps {
  organizationId: string;
}

export default function TemplateManagement({ organizationId }: TemplateManagementProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    service_category: '',
    provider_type: '',
    business_unit: '',
    is_critical: false,
    handles_sensitive_data: false,
    has_system_access: false,
    uses_subcontractors: false,
  });

  useEffect(() => {
    loadTemplates();
  }, [organizationId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('onboarding_request_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      logger.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setCreating(true);
    setEditForm({
      name: '',
      description: '',
      service_category: '',
      provider_type: '',
      business_unit: '',
      is_critical: false,
      handles_sensitive_data: false,
      has_system_access: false,
      uses_subcontractors: false,
    });
  };

  const handleEdit = (template: Template) => {
    setEditing(template.id);
    setEditForm({
      name: template.name,
      description: template.description || '',
      service_category: (template.template_data.service_category as string) || '',
      provider_type: (template.template_data.provider_type as string) || '',
      business_unit: (template.template_data.business_unit as string) || '',
      is_critical: (template.template_data.is_critical as boolean) || false,
      handles_sensitive_data: (template.template_data.handles_sensitive_data as boolean) || false,
      has_system_access: (template.template_data.has_system_access as boolean) || false,
      uses_subcontractors: (template.template_data.uses_subcontractors as boolean) || false,
    });
  };

  const handleSave = async () => {
    try {
      const templateData = {
        service_category: editForm.service_category,
        provider_type: editForm.provider_type,
        business_unit: editForm.business_unit,
        is_critical: editForm.is_critical,
        handles_sensitive_data: editForm.handles_sensitive_data,
        has_system_access: editForm.has_system_access,
        uses_subcontractors: editForm.uses_subcontractors,
      };

      if (creating) {
        const { error } = await supabase.from('onboarding_request_templates').insert({
          organization_id: organizationId,
          name: editForm.name,
          description: editForm.description,
          template_data: templateData,
          is_system_template: false,
        });

        if (error) throw error;
        toast.success('Template created successfully');
      } else if (editing) {
        const { error } = await supabase
          .from('onboarding_request_templates')
          .update({
            name: editForm.name,
            description: editForm.description,
            template_data: templateData,
          })
          .eq('id', editing);

        if (error) throw error;
        toast.success('Template updated successfully');
      }

      setCreating(false);
      setEditing(null);
      loadTemplates();
    } catch (error) {
      logger.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleDelete = async (templateId: string) => {
    setPendingDeleteId(templateId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;

    try {
      const { error } = await supabase
        .from('onboarding_request_templates')
        .delete()
        .eq('id', pendingDeleteId);

      if (error) throw error;
      toast.success('Template deleted successfully');
      loadTemplates();
    } catch (error) {
      logger.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    } finally {
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  };

  const handleCancel = () => {
    setCreating(false);
    setEditing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Onboarding Request Templates</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create reusable templates to speed up common vendor onboarding scenarios
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">
                {creating ? 'Create New Template' : 'Edit Template'}
              </h4>
            </div>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Cloud Service Provider"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Describe when to use this template"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Category
                </label>
                <select
                  value={editForm.service_category}
                  onChange={(e) => setEditForm({ ...editForm, service_category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select category...</option>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider Type
                </label>
                <select
                  value={editForm.provider_type}
                  onChange={(e) => setEditForm({ ...editForm, provider_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select type...</option>
                  {PROVIDER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Unit
                </label>
                <select
                  value={editForm.business_unit}
                  onChange={(e) => setEditForm({ ...editForm, business_unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select business unit...</option>
                  {BUSINESS_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Default Flags</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editForm.is_critical}
                    onChange={(e) => setEditForm({ ...editForm, is_critical: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Critical Service</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editForm.handles_sensitive_data}
                    onChange={(e) =>
                      setEditForm({ ...editForm, handles_sensitive_data: e.target.checked })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Handles Sensitive Data</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editForm.has_system_access}
                    onChange={(e) =>
                      setEditForm({ ...editForm, has_system_access: e.target.checked })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Has System Access</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editForm.uses_subcontractors}
                    onChange={(e) =>
                      setEditForm({ ...editForm, uses_subcontractors: e.target.checked })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Uses Subcontractors</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-200">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editForm.name}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {creating ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No custom templates yet</h3>
          <p className="text-gray-600 mb-4">
            Create templates to streamline onboarding for similar vendors
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-1 text-gray-500 hover:text-blue-600 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1 text-gray-500 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {template.description && (
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              )}

              <div className="space-y-1 text-xs text-gray-500">
                {template.template_data.service_category && (
                  <div>Category: {template.template_data.service_category}</div>
                )}
                {template.template_data.provider_type && (
                  <div>Type: {template.template_data.provider_type}</div>
                )}
                {template.template_data.business_unit && (
                  <div>Business Unit: {template.template_data.business_unit}</div>
                )}
              </div>

              {(template.template_data.is_critical ||
                template.template_data.handles_sensitive_data ||
                template.template_data.has_system_access) && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {template.template_data.is_critical && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                      Critical
                    </span>
                  )}
                  {template.template_data.handles_sensitive_data && (
                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded">
                      Sensitive Data
                    </span>
                  )}
                  {template.template_data.has_system_access && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      System Access
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">About Templates</p>
            <p>
              Templates pre-fill common fields in onboarding requests, saving time for repetitive
              vendor types. Users can still modify all fields after applying a template.
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setPendingDeleteId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

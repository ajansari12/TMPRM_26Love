import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../lib/logger';
import {
  Settings,
  Plus,
  Edit2,
  Copy,
  Clock,
  CheckCircle,
  ArrowRight,
  Save,
  X,
  Info,
  Layers,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  WorkflowTemplate,
  WorkflowStepDefinition,
  WorkflowConditions,
  WorkflowSLAConfig,
  WORKFLOW_ACTION_LABELS,
} from '../types/platform';
import { DEFENSE_LINE_LABELS, DEFENSE_LINE_COLORS } from '../types/organization';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface DBWorkflowTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  code: string;
  description: string | null;
  version: number;
  is_active: boolean;
  is_default: boolean;
  steps: WorkflowStepDefinition[];
  conditions: WorkflowConditions;
  sla_config: WorkflowSLAConfig;
  notification_config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapDBTemplateToWorkflowTemplate(db: DBWorkflowTemplate): WorkflowTemplate {
  return {
    id: db.id,
    organization_id: db.organization_id ?? undefined,
    name: db.name,
    code: db.code,
    description: db.description ?? undefined,
    version: db.version,
    is_active: db.is_active,
    is_default: db.is_default,
    steps: db.steps || [],
    conditions: db.conditions || {},
    sla_config: db.sla_config || {
      warning_threshold_percent: 75,
      escalation_enabled: true,
      escalation_recipients: [],
    },
    notification_config: db.notification_config || {},
    created_by: db.created_by ?? undefined,
    created_at: db.created_at,
    updated_at: db.updated_at,
  };
}

export default function WorkflowConfiguration() {
  const { currentOrganization, currentMembership, isPlatformAdmin } = useOrganization();

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editedConditions, setEditedConditions] = useState<WorkflowConditions>({});
  const [editedSLA, setEditedSLA] = useState<WorkflowSLAConfig>({
    warning_threshold_percent: 75,
    escalation_enabled: true,
    escalation_recipients: [],
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (currentOrganization?.id) {
        query = query.or(`organization_id.is.null,organization_id.eq.${currentOrganization.id}`);
      } else {
        query = query.is('organization_id', null);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const mapped = (data || []).map(mapDBTemplateToWorkflowTemplate);
      setTemplates(mapped);
    } catch (err) {
      logger.error('Error fetching workflow templates:', err);
      setError('Failed to load workflow templates');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const canEditWorkflows = () => {
    return isPlatformAdmin || currentMembership?.defense_line === 'admin';
  };

  const handleSelectTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setEditedConditions(template.conditions);
    setEditedSLA(template.sla_config);
    setEditMode(false);
  };

  const handleSaveChanges = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('workflow_templates')
        .update({
          conditions: editedConditions,
          sla_config: editedSLA,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTemplate.id);

      if (updateError) throw updateError;

      const updated = {
        ...selectedTemplate,
        conditions: editedConditions,
        sla_config: editedSLA,
        updated_at: new Date().toISOString(),
      };

      setTemplates(templates.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTemplate(updated);
      setEditMode(false);
      toast.success('Workflow template updated successfully');
    } catch (err) {
      logger.error('Error saving workflow template:', err);
      toast.error('Failed to save workflow template');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateTemplate = async (template: WorkflowTemplate) => {
    if (!currentOrganization?.id) {
      toast.error('Please select an organization first');
      return;
    }

    setSaving(true);
    try {
      const newTemplateData = {
        organization_id: currentOrganization.id,
        name: `${template.name} (Custom)`,
        code: `${template.code}_custom_${Date.now()}`,
        description: template.description,
        version: 1,
        is_active: true,
        is_default: false,
        steps: template.steps,
        conditions: template.conditions,
        sla_config: template.sla_config,
        notification_config: template.notification_config,
      };

      const { data, error: insertError } = await supabase
        .from('workflow_templates')
        .insert(newTemplateData)
        .select()
        .single();

      if (insertError) throw insertError;

      const newTemplate = mapDBTemplateToWorkflowTemplate(data);
      setTemplates([...templates, newTemplate]);
      setSelectedTemplate(newTemplate);
      toast.success('Custom workflow template created');
    } catch (err) {
      logger.error('Error duplicating workflow template:', err);
      toast.error('Failed to create custom template');
    } finally {
      setSaving(false);
    }
  };

  const renderStepFlow = (steps: WorkflowStepDefinition[]) => {
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    
    return (
      <div className="flex items-center flex-wrap gap-2">
        {sortedSteps.map((step, index) => {
          const defenseColor = step.defense_line 
            ? DEFENSE_LINE_COLORS[step.defense_line] 
            : 'gray';
          
          return (
            <React.Fragment key={step.id}>
              <div className={`
                flex items-center px-3 py-2 rounded-lg border-2
                ${step.is_terminal 
                  ? step.id === 'approved' 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-red-300 bg-red-50'
                  : `border-${defenseColor}-300 bg-${defenseColor}-50`}
              `}>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-500">
                    {step.defense_line ? DEFENSE_LINE_LABELS[step.defense_line] : 'System'}
                  </p>
                  <p className="font-medium text-gray-900">{step.name}</p>
                  {step.sla_hours && (
                    <p className="text-xs text-gray-500 flex items-center justify-center mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {step.sla_hours}h SLA
                    </p>
                  )}
                </div>
              </div>
              {index < sortedSteps.length - 1 && !sortedSteps[index + 1]?.is_terminal && (
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Workflows</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchTemplates}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Settings className="w-6 h-6 mr-2" />
          Workflow Configuration
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure approval workflows and business rules for your organization.
          {isPlatformAdmin && (
            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
              Platform Admin Mode
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-medium text-gray-900">Workflow Templates</h2>
              {canEditWorkflows() && (
                <button className="text-blue-600 hover:text-blue-800">
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <div className="divide-y divide-gray-200">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`
                    w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                    ${selectedTemplate?.id === template.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {template.steps.length} steps • v{template.version}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      {template.organization_id === null && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          Platform Default
                        </span>
                      )}
                      {template.is_default && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{template.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template Detail */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="bg-white rounded-lg shadow">
              {/* Template Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">{selectedTemplate.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedTemplate.description}</p>
                  </div>
                  {canEditWorkflows() && (
                    <div className="flex items-center space-x-2">
                      {selectedTemplate.organization_id === null && (
                        <button
                          onClick={() => handleDuplicateTemplate(selectedTemplate)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Customize
                        </button>
                      )}
                      {!editMode ? (
                        <button
                          onClick={() => setEditMode(true)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditMode(false)}
                            disabled={saving}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveChanges}
                            disabled={saving}
                            className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            {saving ? (
                              <div className="w-4 h-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-1" />
                            )}
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-8">
                {/* Workflow Flow */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                    <Layers className="w-4 h-4 mr-2" />
                    Workflow Steps
                  </h3>
                  <div className="overflow-x-auto pb-4">
                    {renderStepFlow(selectedTemplate.steps)}
                  </div>
                </div>

                {/* Step Details */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Step Configuration</h3>
                  <div className="space-y-3">
                    {selectedTemplate.steps.map((step) => (
                      <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{step.name}</span>
                            {step.defense_line && (
                              <span className={`px-2 py-0.5 rounded text-xs bg-${DEFENSE_LINE_COLORS[step.defense_line]}-100 text-${DEFENSE_LINE_COLORS[step.defense_line]}-700`}>
                                {DEFENSE_LINE_LABELS[step.defense_line]}
                              </span>
                            )}
                          </div>
                          {step.sla_hours && (
                            <span className="text-sm text-gray-500 flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {step.sla_hours} hours SLA
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {step.actions.map((action) => (
                            <span key={action} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              {WORKFLOW_ACTION_LABELS[action] || action}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Workflow Conditions
                  </h3>
                  
                  {editMode ? (
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Skip 1B review for low-risk vendors</span>
                        <input
                          type="checkbox"
                          checked={editedConditions.skip_1b_for_low_risk || false}
                          onChange={(e) => setEditedConditions({
                            ...editedConditions,
                            skip_1b_for_low_risk: e.target.checked,
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                      
                      <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Require 2nd line review for all requests</span>
                        <input
                          type="checkbox"
                          checked={editedConditions.require_2nd_line_for_all ?? true}
                          onChange={(e) => setEditedConditions({
                            ...editedConditions,
                            require_2nd_line_for_all: e.target.checked,
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                      
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <label className="block text-sm text-gray-700 mb-2">
                          Require additional approval for contracts above (CAD)
                        </label>
                        <input
                          type="number"
                          value={editedConditions.require_additional_approval_above || ''}
                          onChange={(e) => setEditedConditions({
                            ...editedConditions,
                            require_additional_approval_above: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          placeholder="e.g., 5000000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <label className="block text-sm text-gray-700 mb-2">
                          Maximum contract value for expedited workflow (CAD)
                        </label>
                        <input
                          type="number"
                          value={editedConditions.max_contract_value || ''}
                          onChange={(e) => setEditedConditions({
                            ...editedConditions,
                            max_contract_value: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          placeholder="e.g., 50000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(selectedTemplate.conditions).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {typeof value === 'boolean' 
                              ? (value ? <CheckCircle className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-gray-400" />)
                              : typeof value === 'number'
                              ? `$${value.toLocaleString()}`
                              : Array.isArray(value)
                              ? value.join(', ')
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SLA Configuration */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    SLA Configuration
                  </h3>
                  
                  {editMode ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <label className="block text-sm text-gray-700 mb-2">
                          Warning threshold (% of SLA)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={editedSLA.warning_threshold_percent}
                          onChange={(e) => setEditedSLA({
                            ...editedSLA,
                            warning_threshold_percent: parseInt(e.target.value),
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      
                      <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Enable automatic escalation</span>
                        <input
                          type="checkbox"
                          checked={editedSLA.escalation_enabled}
                          onChange={(e) => setEditedSLA({
                            ...editedSLA,
                            escalation_enabled: e.target.checked,
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Warning Threshold</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedTemplate.sla_config.warning_threshold_percent}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Auto-Escalation</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedTemplate.sla_config.escalation_enabled 
                            ? <CheckCircle className="w-5 h-5 text-green-500" />
                            : <X className="w-5 h-5 text-gray-400" />}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Escalation Recipients</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedTemplate.sla_config.escalation_recipients.join(', ') || 'None'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-800">OSFI B-10 Compliance Note</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        This workflow follows OSFI B-10 Third-Party Risk Management guidelines, ensuring 
                        appropriate oversight through the three lines of defense model. Critical and 
                        high-risk vendors require enhanced due diligence and senior management approval.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Settings className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Select a Workflow Template</h3>
              <p className="mt-2 text-sm text-gray-500">
                Choose a workflow template from the list to view and configure its settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Understanding Workflow Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Platform Defaults vs Custom</h4>
            <p className="text-sm text-gray-600">
              Platform default templates are created by system administrators and provide 
              OSFI-compliant baseline workflows. You can customize these for your organization 
              by clicking "Customize" to create an organization-specific copy.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Workflow Conditions</h4>
            <p className="text-sm text-gray-600">
              Conditions allow you to create exceptions to the standard workflow. For example, 
              you can skip 1B review for low-risk vendors or require additional approvals 
              for high-value contracts.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">SLA Management</h4>
            <p className="text-sm text-gray-600">
              Configure service level agreements for each review step. The system will 
              automatically send warnings when approaching SLA deadlines and can escalate 
              to managers when SLAs are breached.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

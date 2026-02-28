import { useState, useEffect } from 'react';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  AutoCriticalRule,
  AutoCriticalCondition,
} from '../lib/riskCalculations';
import ConfirmModal from './ConfirmModal';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

const FIELD_OPTIONS = [
  { value: 'contract_value_cad', label: 'Contract Value (CAD)', type: 'number' },
  { value: 'handles_sensitive_data', label: 'Handles Sensitive Data', type: 'boolean' },
  { value: 'is_critical', label: 'Marked as Critical', type: 'boolean' },
  { value: 'service_category', label: 'Service Category', type: 'select' },
  { value: 'provider_type', label: 'Provider Type', type: 'select' },
  { value: 'has_system_access', label: 'Has System Access', type: 'boolean' },
  { value: 'q14_customer_facing', label: 'Customer Facing Impact (Q14)', type: 'number' },
  { value: 'q15_operational_impact', label: 'Operational Impact (Q15)', type: 'number' },
  { value: 'q22_substitutability', label: 'Substitutability Score (Q22)', type: 'number' },
  { value: 'q31_data_sensitivity', label: 'Data Sensitivity (Q31)', type: 'number' },
  { value: 'q32_cybersecurity_risk', label: 'Cybersecurity Risk (Q32)', type: 'number' },
];

const OPERATOR_OPTIONS: Record<string, { value: AutoCriticalCondition['operator']; label: string }[]> = {
  number: [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '>', label: 'greater than' },
    { value: '>=', label: 'at least' },
    { value: '<', label: 'less than' },
    { value: '<=', label: 'at most' },
  ],
  boolean: [
    { value: '=', label: 'is' },
  ],
  select: [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: 'in', label: 'is one of' },
  ],
  string: [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: 'contains', label: 'contains' },
  ],
};

const SERVICE_CATEGORY_OPTIONS = [
  { value: 'it_telecom', label: 'IT & Telecom Services' },
  { value: 'cloud_infrastructure', label: 'Cloud Infrastructure' },
  { value: 'payment_processing', label: 'Payment Processing' },
  { value: 'custody_services', label: 'Custody Services' },
  { value: 'data_analytics', label: 'Data Analytics' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'core_banking', label: 'Core Banking' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'facilities', label: 'Facilities Management' },
  { value: 'marketing', label: 'Marketing & Communications' },
  { value: 'hr_services', label: 'HR Services' },
  { value: 'legal_services', label: 'Legal Services' },
  { value: 'audit_services', label: 'Audit Services' },
  { value: 'other', label: 'Other' },
];

interface RuleEditorProps {
  rule: Partial<AutoCriticalRule>;
  onSave: (rule: Partial<AutoCriticalRule>) => void;
  onCancel: () => void;
  isNew: boolean;
}

function RuleEditor({ rule, onSave, onCancel, isNew }: RuleEditorProps) {
  const [editedRule, setEditedRule] = useState<Partial<AutoCriticalRule>>(rule);
  const [conditions, setConditions] = useState<AutoCriticalCondition[]>(
    rule.conditions || []
  );

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      { field: 'contract_value_cad', operator: '>=', value: 0 },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (
    index: number,
    field: keyof AutoCriticalCondition,
    value: unknown
  ) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'field') {
      const fieldOption = FIELD_OPTIONS.find(f => f.value === value);
      if (fieldOption) {
        if (fieldOption.type === 'boolean') {
          updated[index].operator = '=';
          updated[index].value = true;
        } else if (fieldOption.type === 'number') {
          updated[index].operator = '>=';
          updated[index].value = 0;
        } else {
          updated[index].operator = '=';
          updated[index].value = '';
        }
      }
    }

    setConditions(updated);
  };

  const handleSave = () => {
    if (!editedRule.rule_name?.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (conditions.length === 0) {
      toast.error('At least one condition is required');
      return;
    }
    onSave({ ...editedRule, conditions });
  };

  const getFieldType = (fieldValue: string): string => {
    const field = FIELD_OPTIONS.find(f => f.value === fieldValue);
    return field?.type || 'string';
  };

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-900">
          {isNew ? 'New Auto-Critical Rule' : 'Edit Rule'}
        </h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Rule Name
          </label>
          <input
            type="text"
            value={editedRule.rule_name || ''}
            onChange={(e) => setEditedRule({ ...editedRule, rule_name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., High Contract Value"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Priority (lower = higher priority)
          </label>
          <input
            type="number"
            min="1"
            value={editedRule.priority || 1}
            onChange={(e) => setEditedRule({ ...editedRule, priority: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          value={editedRule.rule_description || ''}
          onChange={(e) => setEditedRule({ ...editedRule, rule_description: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe when this rule should trigger auto-critical classification..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Conditions (ALL must be met)
          </label>
          <button
            onClick={handleAddCondition}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Condition
          </button>
        </div>

        {conditions.length === 0 && (
          <div className="text-sm text-slate-500 italic py-2">
            No conditions defined. Add at least one condition.
          </div>
        )}

        <div className="space-y-2">
          {conditions.map((condition, index) => {
            const fieldType = getFieldType(condition.field);
            const operators = OPERATOR_OPTIONS[fieldType] || OPERATOR_OPTIONS.string;

            return (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200"
              >
                <select
                  value={condition.field}
                  onChange={(e) => handleConditionChange(index, 'field', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FIELD_OPTIONS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => handleConditionChange(index, 'operator', e.target.value)}
                  className="w-32 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {fieldType === 'boolean' ? (
                  <select
                    value={condition.value === true ? 'true' : 'false'}
                    onChange={(e) => handleConditionChange(index, 'value', e.target.value === 'true')}
                    className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : fieldType === 'number' ? (
                  <input
                    type="number"
                    value={condition.value as number}
                    onChange={(e) => handleConditionChange(index, 'value', parseFloat(e.target.value) || 0)}
                    className="w-32 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : fieldType === 'select' && condition.field === 'service_category' ? (
                  <select
                    value={condition.value as string}
                    onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {SERVICE_CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={condition.value as string}
                    onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Value"
                  />
                )}

                <button
                  onClick={() => handleRemoveCondition(index)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AutoCriticalRulesSettings() {
  const { currentOrganization } = useOrganization();
  const [rules, setRules] = useState<AutoCriticalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<AutoCriticalRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchRules();
    }
  }, [currentOrganization?.id]);

  const fetchRules = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auto_critical_rules')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('priority', { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      logger.error('Error fetching rules:', error);
      toast.error('Failed to load auto-critical rules');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (rule: AutoCriticalRule) => {
    try {
      const { error } = await supabase
        .from('auto_critical_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;

      setRules(rules.map(r =>
        r.id === rule.id ? { ...r, is_active: !r.is_active } : r
      ));
      toast.success(rule.is_active ? 'Rule deactivated' : 'Rule activated');
    } catch (error) {
      logger.error('Error toggling rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleSaveRule = async (ruleData: Partial<AutoCriticalRule>) => {
    if (!currentOrganization?.id) return;

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('auto_critical_rules')
          .update({
            rule_name: ruleData.rule_name,
            rule_description: ruleData.rule_description,
            conditions: ruleData.conditions,
            priority: ruleData.priority,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success('Rule updated');
      } else {
        const { error } = await supabase
          .from('auto_critical_rules')
          .insert({
            organization_id: currentOrganization.id,
            rule_name: ruleData.rule_name,
            rule_description: ruleData.rule_description,
            conditions: ruleData.conditions,
            priority: ruleData.priority || rules.length + 1,
            is_active: true,
          });

        if (error) throw error;
        toast.success('Rule created');
      }

      setEditingRule(null);
      setIsCreating(false);
      fetchRules();
    } catch (error) {
      logger.error('Error saving rule:', error);
      toast.error('Failed to save rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setPendingDeleteId(ruleId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;

    try {
      const { error } = await supabase
        .from('auto_critical_rules')
        .delete()
        .eq('id', pendingDeleteId);

      if (error) throw error;

      setRules(rules.filter(r => r.id !== pendingDeleteId));
      toast.success('Rule deleted');
    } catch (error) {
      logger.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    } finally {
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  };

  const toggleExpanded = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const formatConditionSummary = (conditions: AutoCriticalCondition[]): string => {
    if (!conditions || conditions.length === 0) return 'No conditions';
    if (conditions.length === 1) {
      const c = conditions[0];
      const field = FIELD_OPTIONS.find(f => f.value === c.field)?.label || c.field;
      return `${field} ${c.operator} ${c.value}`;
    }
    return `${conditions.length} conditions (all must match)`;
  };

  if (!currentOrganization) {
    return (
      <div className="text-center py-8 text-slate-500">
        No organization selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Auto-Critical Rules</h3>
          <p className="text-sm text-slate-600 mt-1">
            Define rules that automatically classify vendors as Critical (Tier 5) when specific criteria are met.
          </p>
        </div>
        {!isCreating && !editingRule && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">How Auto-Critical Rules Work</p>
            <p>
              When a vendor assessment is completed, these rules are evaluated in priority order.
              If all conditions in a rule are met, the vendor is automatically classified as Critical (Tier 5).
              Users can override auto-critical with proper justification and 2nd line approval.
            </p>
          </div>
        </div>
      </div>

      {isCreating && (
        <RuleEditor
          rule={{ priority: rules.length + 1 }}
          onSave={handleSaveRule}
          onCancel={() => setIsCreating(false)}
          isNew={true}
        />
      )}

      {editingRule && (
        <RuleEditor
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => setEditingRule(null)}
          isNew={false}
        />
      )}

      <div className="space-y-3">
        {rules.length === 0 && !isCreating && (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No auto-critical rules configured.</p>
            <p className="text-sm text-slate-500 mt-1">
              Create rules to automatically classify high-risk vendors.
            </p>
          </div>
        )}

        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`border rounded-lg transition-all ${
              rule.is_active
                ? 'border-slate-200 bg-white'
                : 'border-slate-200 bg-slate-50 opacity-75'
            }`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        #{rule.priority}
                      </span>
                      <h4 className="font-medium text-slate-900">{rule.rule_name}</h4>
                      {!rule.is_active && (
                        <span className="text-xs font-medium text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {rule.rule_description && (
                      <p className="text-sm text-slate-600 mt-1">{rule.rule_description}</p>
                    )}
                    <p className="text-sm text-slate-500 mt-2">
                      {formatConditionSummary(rule.conditions)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpanded(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    title={expandedRules.has(rule.id) ? 'Collapse' : 'Expand'}
                  >
                    {expandedRules.has(rule.id) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className={`p-1.5 transition-colors ${
                      rule.is_active
                        ? 'text-emerald-600 hover:text-emerald-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title={rule.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {rule.is_active ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedRules.has(rule.id) && rule.conditions && rule.conditions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-2">Conditions:</p>
                  <div className="space-y-1">
                    {rule.conditions.map((condition, idx) => {
                      const field = FIELD_OPTIONS.find(f => f.value === condition.field);
                      return (
                        <div
                          key={idx}
                          className="text-sm text-slate-600 flex items-center gap-2"
                        >
                          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                            {idx + 1}
                          </span>
                          <span className="font-medium">{field?.label || condition.field}</span>
                          <span className="text-slate-400">{condition.operator}</span>
                          <span className="font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded">
                            {Array.isArray(condition.value)
                              ? condition.value.join(', ')
                              : String(condition.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-600">
            <p className="font-medium mb-1">Built-in Auto-Critical Triggers</p>
            <p>
              In addition to these configurable rules, the system automatically classifies vendors as Critical when:
            </p>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              <li>Q15 indicates disruption would stop essential operations</li>
              <li>Combined criticality score (Q15+Q16+Q17) is 4.5 or higher</li>
            </ul>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPendingDeleteId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Rule"
        message="Are you sure you want to delete this rule? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

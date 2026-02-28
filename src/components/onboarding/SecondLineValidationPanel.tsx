import { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  FileCheck,
  Info,
} from 'lucide-react';
import {
  OnboardingAssessmentData,
  TIER_DISPLAY_CONFIG,
  DUE_DILIGENCE_OPTIONS,
  getDefaultDueDiligence,
} from '../../lib/assessmentValidation';

interface SecondLineValidationPanelProps {
  assessmentData: OnboardingAssessmentData;
  onValidationChange: (validation: ValidationData) => void;
  disabled?: boolean;
}

export interface ValidationData {
  validationMode: 'agree' | 'adjust';
  validatedTier: string;
  tierAdjustmentReason: string;
  conductIndependentAssessment: boolean;
  selectedDueDiligence: string[];
  additionalRequirements: string;
}

const TIER_OPTIONS = [
  { value: 'tier_5_critical', label: 'Critical (Tier 5)' },
  { value: 'tier_4_high', label: 'High (Tier 4)' },
  { value: 'tier_3_moderate', label: 'Moderate (Tier 3)' },
  { value: 'tier_2_low', label: 'Low (Tier 2)' },
  { value: 'tier_1_informational', label: 'Informational (Tier 1)' },
];

export function SecondLineValidationPanel({
  assessmentData,
  onValidationChange,
  disabled = false,
}: SecondLineValidationPanelProps) {
  const calculatedTier = assessmentData.calculated_tier || 'tier_3_moderate';
  const tierConfig = TIER_DISPLAY_CONFIG[calculatedTier];

  const [validationMode, setValidationMode] = useState<'agree' | 'adjust'>('agree');
  const [validatedTier, setValidatedTier] = useState(calculatedTier);
  const [tierAdjustmentReason, setTierAdjustmentReason] = useState('');
  const [conductIndependentAssessment, setConductIndependentAssessment] = useState(false);
  const [selectedDueDiligence, setSelectedDueDiligence] = useState<string[]>(
    getDefaultDueDiligence(calculatedTier)
  );
  const [additionalRequirements, setAdditionalRequirements] = useState('');

  useEffect(() => {
    onValidationChange({
      validationMode,
      validatedTier: validationMode === 'agree' ? calculatedTier : validatedTier,
      tierAdjustmentReason,
      conductIndependentAssessment,
      selectedDueDiligence,
      additionalRequirements,
    });
  }, [
    validationMode,
    validatedTier,
    tierAdjustmentReason,
    conductIndependentAssessment,
    selectedDueDiligence,
    additionalRequirements,
    calculatedTier,
    onValidationChange,
  ]);

  useEffect(() => {
    const effectiveTier = validationMode === 'agree' ? calculatedTier : validatedTier;
    setSelectedDueDiligence(getDefaultDueDiligence(effectiveTier));
  }, [validatedTier, validationMode, calculatedTier]);

  const toggleDueDiligence = (id: string) => {
    if (disabled) return;
    setSelectedDueDiligence((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const effectiveTier = validationMode === 'agree' ? calculatedTier : validatedTier;
  const effectiveTierConfig = TIER_DISPLAY_CONFIG[effectiveTier];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">2nd Line Assessment Validation</h3>
            <p className="text-sm text-blue-700">Review and validate the risk assessment completed by 1st line</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-blue-100 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Preliminary Tier (from 1st Line)</p>
              <span className={`inline-flex mt-1 px-3 py-1 rounded-full text-sm font-medium ${tierConfig?.bgClass}`}>
                {tierConfig?.label || 'Unknown'}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Risk Rating</p>
              <p className="text-xl font-bold text-slate-900">
                {assessmentData.calculated_risk_rating?.toFixed(1) || '-'}
              </p>
            </div>
          </div>
        </div>

        <fieldset disabled={disabled} className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              name="validationMode"
              value="agree"
              checked={validationMode === 'agree'}
              onChange={() => setValidationMode('agree')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <span className="font-medium text-slate-900">Agree with assessment</span>
                <p className="text-sm text-slate-500">Tier is appropriate based on the risk assessment</p>
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              name="validationMode"
              value="adjust"
              checked={validationMode === 'adjust'}
              onChange={() => setValidationMode('adjust')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <span className="font-medium text-slate-900">Adjust tier (requires justification)</span>
                <p className="text-sm text-slate-500">Override the calculated tier based on additional factors</p>
              </div>
            </div>
          </label>

          {validationMode === 'adjust' && (
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Validated Tier <span className="text-red-500">*</span>
                </label>
                <select
                  value={validatedTier}
                  onChange={(e) => setValidatedTier(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {TIER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Adjustment Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={tierAdjustmentReason}
                  onChange={(e) => setTierAdjustmentReason(e.target.value)}
                  rows={4}
                  placeholder="Based on review of vendor's SOC 2 report and financial statements, the actual risk is lower/higher than indicated because..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Minimum 50 characters required for audit trail. Currently: {tierAdjustmentReason.length}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={conductIndependentAssessment}
                onChange={(e) => setConductIndependentAssessment(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
              />
              <div>
                <span className="font-medium text-slate-900">Conduct independent assessment</span>
                <p className="text-sm text-slate-500">
                  Override 1st line answers and perform a fresh assessment (opens assessment wizard)
                </p>
              </div>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Due Diligence Requirements</h3>
            <p className="text-sm text-slate-500">
              Based on validated tier ({effectiveTierConfig?.label}), specify required due diligence
            </p>
          </div>
        </div>

        {assessmentData.is_auto_critical && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">
              This vendor is auto-critical. Comprehensive due diligence is mandatory.
            </p>
          </div>
        )}

        <fieldset disabled={disabled} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DUE_DILIGENCE_OPTIONS.map((option) => {
              const isDefault = option.tier.includes(effectiveTier);
              const isSelected = selectedDueDiligence.includes(option.id);

              return (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDueDiligence(option.id)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                  />
                  <div className="flex-1">
                    <span className={`text-sm ${isSelected ? 'font-medium text-emerald-900' : 'text-slate-700'}`}>
                      {option.label}
                    </span>
                    {isDefault && (
                      <span className="ml-2 text-xs text-emerald-600 font-medium">
                        (Recommended)
                      </span>
                    )}
                  </div>
                  {isSelected && <FileCheck className="w-4 h-4 text-emerald-600" />}
                </label>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Additional Requirements
            </label>
            <textarea
              value={additionalRequirements}
              onChange={(e) => setAdditionalRequirements(e.target.value)}
              rows={3}
              placeholder="Specify any additional due diligence requirements not listed above..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </fieldset>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600">
            <strong>{selectedDueDiligence.length}</strong> due diligence items selected.
            {selectedDueDiligence.length === 0 && (
              <span className="text-amber-600 ml-2">At least one item is recommended.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

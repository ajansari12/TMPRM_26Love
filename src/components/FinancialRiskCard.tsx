import { useMemo, useState } from 'react';
import { DollarSign, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, Shield } from 'lucide-react';
import { calculateALE, formatCAD, type FinancialRiskEstimate } from '../lib/financialRiskCalculations';
import type { TierLevel, ServiceCategory } from '../types';

interface FinancialRiskCardProps {
  vendor: {
    tier?: TierLevel;
    contract_value_cad?: number;
    service_category: ServiceCategory;
    handles_sensitive_data: boolean;
    is_critical: boolean;
    has_system_access: boolean;
    data_access_level?: string;
  };
  incidentCount?: number;
}

export default function FinancialRiskCard({ vendor, incidentCount = 0 }: FinancialRiskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const estimate: FinancialRiskEstimate | null = useMemo(() => {
    if (!vendor.tier) return null;
    return calculateALE({
      tier: vendor.tier,
      contractValueCAD: vendor.contract_value_cad || 0,
      serviceCategory: vendor.service_category,
      handlesSensitiveData: vendor.handles_sensitive_data,
      isCritical: vendor.is_critical,
      hasSystemAccess: vendor.has_system_access,
      dataSensitivityLevel: vendor.data_access_level,
      incidentCount,
    });
  }, [vendor, incidentCount]);

  if (!estimate) return null;

  const aleColor = estimate.ale >= 1000000 ? 'text-red-600' :
    estimate.ale >= 500000 ? 'text-orange-600' :
    estimate.ale >= 100000 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-slate-700">Financial Risk Estimate</h4>
            <p className="text-xs text-slate-400">FAIR-inspired Annual Loss Exposure</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-lg font-bold ${aleColor}`}>{formatCAD(estimate.ale)}</p>
            <p className="text-xs text-slate-400">Est. ALE</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Loss Range Bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Loss Range (5th–95th percentile)</span>
            </div>
            <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-gradient-to-r from-amber-200 to-red-300 rounded-full"
                style={{
                  left: `${Math.min((estimate.lossRangeLow / estimate.lossRangeHigh) * 100, 10)}%`,
                  width: `${100 - Math.min((estimate.lossRangeLow / estimate.lossRangeHigh) * 100, 10)}%`,
                }}
              />
              <div
                className="absolute h-full w-0.5 bg-slate-800"
                style={{ left: `${Math.min((estimate.ale / estimate.lossRangeHigh) * 100, 95)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>{formatCAD(estimate.lossRangeLow)}</span>
              <span className="font-medium text-slate-700">Expected: {formatCAD(estimate.ale)}</span>
              <span>{formatCAD(estimate.lossRangeHigh)}</span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">Event Frequency</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{estimate.lossEventFrequency} / year</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">Loss Magnitude</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatCAD(estimate.lossMagnitude)}</p>
            </div>
          </div>

          {/* Loss Drivers */}
          <div>
            <h5 className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Key Loss Drivers
            </h5>
            <div className="space-y-2">
              {estimate.drivers.map((driver, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-slate-700 font-medium">{driver.factor}</span>
                      <span className="text-slate-500">{driver.contribution}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(driver.contribution, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 italic">
            Estimates based on FAIR methodology. Actual losses may vary. Values in CAD.
          </p>
        </div>
      )}
    </div>
  );
}

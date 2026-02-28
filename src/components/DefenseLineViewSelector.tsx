import { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { DEFENSE_LINE_LABELS, DefenseLine } from '../types/organization';
import {
  Eye,
  ChevronDown,
  Users,
  FileSearch,
  Shield,
  Search,
  Settings,
  X,
  Clock,
  RefreshCw,
  Briefcase,
} from 'lucide-react';

const DEFENSE_LINE_CONFIG: Record<
  Exclude<DefenseLine, 'admin' | 'senior_management'>,
  { icon: typeof Users; description: string; color: string }
> = {
  '1a': {
    icon: Briefcase,
    description: 'Creates and owns vendor relationships',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  '1b': {
    icon: FileSearch,
    description: 'Performs initial due diligence reviews',
    color: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  '2nd': {
    icon: Shield,
    description: 'Independent oversight and approval',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  '3rd': {
    icon: Search,
    description: 'Audit and assurance activities',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
};

const TESTABLE_DEFENSE_LINES: Array<Exclude<DefenseLine, 'admin' | 'senior_management'>> = [
  '1a',
  '1b',
  '2nd',
  '3rd',
];

export default function DefenseLineViewSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    isAdmin,
    defenseLineImpersonation,
    impersonateDefenseLine,
    stopDefenseLineImpersonation,
    extendDefenseLineImpersonation,
  } = useOrganization();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAdmin) return null;

  const handleSelectDefenseLine = async (line: DefenseLine) => {
    const success = await impersonateDefenseLine(line);
    if (success) {
      setIsOpen(false);
    }
  };

  const handleStopImpersonation = async () => {
    await stopDefenseLineImpersonation();
    setIsOpen(false);
  };

  const handleExtendSession = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await extendDefenseLineImpersonation();
  };

  const currentConfig = defenseLineImpersonation.targetDefenseLine
    ? DEFENSE_LINE_CONFIG[defenseLineImpersonation.targetDefenseLine as keyof typeof DEFENSE_LINE_CONFIG]
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
          defenseLineImpersonation.isActive
            ? `${currentConfig?.color || 'bg-teal-100 text-teal-700 border-teal-200'}`
            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
        }`}
        aria-label="View as different defense line role"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Eye className="w-4 h-4" />
        <span className="text-sm font-medium">
          {defenseLineImpersonation.isActive
            ? `Testing as: ${DEFENSE_LINE_LABELS[defenseLineImpersonation.targetDefenseLine!]}`
            : 'View as Role'}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Test Workflow as Role</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Experience the system from different perspectives
            </p>
          </div>

          {defenseLineImpersonation.isActive && (
            <div className="px-4 py-3 bg-teal-50 border-b border-teal-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-800">
                    {defenseLineImpersonation.minutesRemaining} min remaining
                  </span>
                </div>
                <button
                  onClick={handleExtendSession}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-100 rounded hover:bg-teal-200 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Extend
                </button>
              </div>
              <button
                onClick={handleStopImpersonation}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-teal-200 rounded-lg text-sm font-medium text-teal-700 hover:bg-teal-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Exit Role View
              </button>
            </div>
          )}

          <div className="py-2">
            {TESTABLE_DEFENSE_LINES.map((line) => {
              const config = DEFENSE_LINE_CONFIG[line];
              const Icon = config.icon;
              const isActive = defenseLineImpersonation.targetDefenseLine === line;

              return (
                <button
                  key={line}
                  onClick={() => handleSelectDefenseLine(line)}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                    isActive ? 'bg-slate-50' : ''
                  }`}
                >
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {DEFENSE_LINE_LABELS[line]}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
            <div className="flex items-start gap-2">
              <Settings className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-600">
                  All actions during role testing are flagged as <strong>test mode</strong> in the
                  audit log.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

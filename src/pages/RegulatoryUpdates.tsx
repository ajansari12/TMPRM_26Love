import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Shield,
  Globe,
  AlertTriangle,
  Calendar,
  RefreshCw,
  FileText,
  Zap,
  Leaf,
  Lock,
  ExternalLink,
  Tag,
} from 'lucide-react';

interface RegulatoryUpdate {
  id?: string;
  source: string;
  title: string;
  summary: string;
  impact_analysis: string;
  affected_areas: string[];
  severity: 'low' | 'medium' | 'high';
  effective_date?: string;
  created_at: string;
}

const SOURCE_CONFIG: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  OSFI: { icon: Shield, color: 'text-blue-700', bg: 'bg-blue-50' },
  DORA: { icon: Globe, color: 'text-purple-700', bg: 'bg-purple-50' },
  OCC: { icon: FileText, color: 'text-slate-700', bg: 'bg-slate-50' },
  Privacy: { icon: Lock, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Cyber: { icon: Zap, color: 'text-red-700', bg: 'bg-red-50' },
  ESG: { icon: Leaf, color: 'text-green-700', bg: 'bg-green-50' },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  low: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const AREA_LABELS: Record<string, string> = {
  assessment: 'Assessment',
  monitoring: 'Monitoring',
  contracts: 'Contracts',
  reporting: 'Reporting',
  exit_strategy: 'Exit Strategy',
};

export default function RegulatoryUpdates() {
  const { currentOrganization } = useOrganization();
  const [updates, setUpdates] = useState<RegulatoryUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterSource, setFilterSource] = useState<string>('all');

  useEffect(() => {
    if (currentOrganization?.id) fetchUpdates();
  }, [currentOrganization?.id]);

  async function fetchUpdates() {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('regulatory_updates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setUpdates(data || []);
    } catch {
      // Table may not exist yet; run scan to populate
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    if (!currentOrganization?.id || scanning) return;
    setScanning(true);
    try {
      await supabase.functions.invoke('regulatory-monitor', {
        body: { organization_id: currentOrganization.id },
      });
      await fetchUpdates();
    } catch {
      // Function may not be deployed
    } finally {
      setScanning(false);
    }
  }

  const filteredUpdates = filterSource === 'all'
    ? updates
    : updates.filter(u => u.source === filterSource);

  const sources = [...new Set(updates.map(u => u.source))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Regulatory Updates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor regulatory changes affecting third-party risk management
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan for Updates'}
        </button>
      </div>

      {/* Source Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterSource('all')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filterSource === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          All ({updates.length})
        </button>
        {sources.map(source => {
          const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.OSFI;
          const Icon = config.icon;
          const count = updates.filter(u => u.source === source).length;
          return (
            <button
              key={source}
              onClick={() => setFilterSource(source)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filterSource === source
                  ? `${config.bg} ${config.color} border-current`
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {source} ({count})
            </button>
          );
        })}
      </div>

      {/* Updates List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Regulatory Updates</h3>
          <p className="text-sm text-slate-500 mb-4">
            Run a scan to check for regulatory changes affecting your TPRM program
          </p>
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Run First Scan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUpdates.map((update, index) => {
            const config = SOURCE_CONFIG[update.source] || SOURCE_CONFIG.OSFI;
            const Icon = config.icon;
            const severityStyle = SEVERITY_STYLES[update.severity] || SEVERITY_STYLES.medium;

            return (
              <div
                key={update.id || index}
                className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.bg} ${config.color}`}>
                          {update.source}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${severityStyle.bg} ${severityStyle.text}`}>
                          {update.severity.charAt(0).toUpperCase() + update.severity.slice(1)} Impact
                        </span>
                        {update.effective_date && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            Effective: {new Date(update.effective_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mb-1">{update.title}</h3>
                      <p className="text-sm text-slate-600 mb-3">{update.summary}</p>

                      {/* Impact Analysis */}
                      <div className="bg-slate-50 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-semibold text-slate-700">Impact on Your TPRM Program</span>
                        </div>
                        <p className="text-xs text-slate-600">{update.impact_analysis}</p>
                      </div>

                      {/* Affected Areas */}
                      {update.affected_areas && update.affected_areas.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {update.affected_areas.map(area => (
                            <span
                              key={area}
                              className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                            >
                              {AREA_LABELS[area] || area}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

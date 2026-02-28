import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Radio,
  Shield,
  Globe,
  Zap,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useAI } from '../hooks/useAI';

interface Signal {
  id: string;
  signal_type: 'news' | 'regulatory' | 'financial' | 'cyber';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  summary: string;
  source_url?: string;
  ai_confidence: number;
  created_at: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

interface MonitoringSignalsProps {
  vendorId: string;
  vendorName: string;
}

const SIGNAL_ICONS: Record<string, typeof Radio> = {
  news: Radio,
  regulatory: Shield,
  financial: Globe,
  cyber: Zap,
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
};

export default function MonitoringSignals({ vendorId, vendorName }: MonitoringSignalsProps) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    fetchSignals();
  }, [vendorId, currentOrganization?.id]);

  async function fetchSignals() {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('monitoring_signals')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setSignals(data || []);
    } catch {
      // signals table may not exist yet
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    if (!currentOrganization?.id || scanning) return;
    setScanning(true);
    try {
      await supabase.functions.invoke('monitoring-scanner', {
        body: {
          vendor_id: vendorId,
          organization_id: currentOrganization.id,
        },
      });
      // Refresh after scan
      await fetchSignals();
    } catch {
      // Scanner may not be deployed
    } finally {
      setScanning(false);
    }
  }

  async function acknowledgeSignal(signalId: string) {
    const { error } = await supabase
      .from('monitoring_signals')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: 'current_user',
      })
      .eq('id', signalId);

    if (!error) {
      setSignals(prev =>
        prev.map(s =>
          s.id === signalId
            ? { ...s, acknowledged_at: new Date().toISOString() }
            : s
        )
      );
    }
  }

  const criticalCount = signals.filter(s => s.severity === 'critical' && !s.acknowledged_at).length;
  const warningCount = signals.filter(s => s.severity === 'warning' && !s.acknowledged_at).length;
  const unacknowledgedCount = signals.filter(s => !s.acknowledged_at).length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Radio className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-slate-700">Monitoring Signals</h4>
            <p className="text-xs text-slate-400">
              {signals.length} signals
              {criticalCount > 0 && <span className="text-red-600 font-medium"> ({criticalCount} critical)</span>}
              {warningCount > 0 && <span className="text-amber-600 font-medium"> ({warningCount} warning)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unacknowledgedCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              {unacknowledgedCount} new
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          <div className="p-3 flex justify-end">
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Run Scan'}
            </button>
          </div>

          {loading ? (
            <div className="px-4 pb-4 text-center">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading signals...</p>
            </div>
          ) : signals.length === 0 ? (
            <div className="px-4 pb-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No monitoring signals</p>
              <p className="text-xs text-slate-400 mt-1">Run a scan to check for new signals</p>
            </div>
          ) : (
            <div className="px-3 pb-3 space-y-2 max-h-[400px] overflow-y-auto">
              {signals.map((signal) => {
                const Icon = SIGNAL_ICONS[signal.signal_type] || Info;
                const style = SEVERITY_STYLES[signal.severity] || SEVERITY_STYLES.info;
                const isAcknowledged = !!signal.acknowledged_at;

                return (
                  <div
                    key={signal.id}
                    className={`border rounded-lg p-3 ${isAcknowledged ? 'bg-slate-50 border-slate-200 opacity-60' : style.bg}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isAcknowledged ? 'bg-slate-300' : style.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon className={`w-3.5 h-3.5 ${isAcknowledged ? 'text-slate-400' : style.text}`} />
                          <span className={`text-xs font-medium uppercase ${isAcknowledged ? 'text-slate-400' : style.text}`}>
                            {signal.signal_type}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(signal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={`text-sm font-medium ${isAcknowledged ? 'text-slate-500' : 'text-slate-800'}`}>
                          {signal.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{signal.summary}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {signal.source_url && (
                            <a
                              href={signal.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Source
                            </a>
                          )}
                          {!isAcknowledged && (
                            <button
                              onClick={() => acknowledgeSignal(signal.id)}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Acknowledge
                            </button>
                          )}
                          <span className="text-xs text-slate-400">
                            Confidence: {Math.round(signal.ai_confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

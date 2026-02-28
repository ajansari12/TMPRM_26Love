import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { Vendor } from '../types';
import { formatDate } from '../lib/utils';
import {
  ArrowLeft,
  Gauge,
  Building2,
  Plus,
  X,
  Trash2,
  Save,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Target,
  AlertTriangle,
  BarChart3,
  Edit2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';

interface VendorSLA {
  id: string;
  organization_id: string;
  vendor_id: string;
  contract_id: string | null;
  sla_name: string;
  sla_category: 'availability' | 'response_time' | 'resolution_time' | 'quality' | 'other';
  target_value: number;
  target_unit: string;
  measurement_frequency: string;
  penalty_clause: string | null;
  credit_percentage: number | null;
  is_active: boolean;
  created_at: string;
}

interface SLAMeasurement {
  id: string;
  sla_id: string;
  measurement_period_start: string;
  measurement_period_end: string;
  actual_value: number;
  target_met: boolean;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

const CATEGORY_CONFIG = {
  availability: { label: 'Availability', color: 'bg-blue-100 text-blue-800', chartColor: '#3b82f6' },
  response_time: { label: 'Response Time', color: 'bg-emerald-100 text-emerald-800', chartColor: '#10b981' },
  resolution_time: { label: 'Resolution Time', color: 'bg-amber-100 text-amber-800', chartColor: '#f59e0b' },
  quality: { label: 'Quality', color: 'bg-purple-100 text-purple-800', chartColor: '#8b5cf6' },
  other: { label: 'Other', color: 'bg-slate-100 text-slate-800', chartColor: '#64748b' },
};

const UNIT_OPTIONS = [
  { value: 'percent', label: '%' },
  { value: 'hours', label: 'Hours' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'days', label: 'Days' },
  { value: 'count', label: 'Count' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

export default function SLATracking() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [slas, setSlas] = useState<VendorSLA[]>([]);
  const [measurements, setMeasurements] = useState<Record<string, SLAMeasurement[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showAddSLA, setShowAddSLA] = useState(false);
  const [editingSLA, setEditingSLA] = useState<VendorSLA | null>(null);
  const [selectedSLA, setSelectedSLA] = useState<string | null>(null);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);

  const [slaForm, setSlaForm] = useState({
    sla_name: '',
    sla_category: 'availability' as VendorSLA['sla_category'],
    target_value: '',
    target_unit: 'percent',
    measurement_frequency: 'monthly',
    penalty_clause: '',
    credit_percentage: '',
  });

  const [measurementForm, setMeasurementForm] = useState({
    measurement_period_start: '',
    measurement_period_end: '',
    actual_value: '',
    notes: '',
  });

  useEffect(() => {
    if (vendorId && currentOrganization?.id) {
      fetchData();
    } else if (!currentOrganization?.id) {
      setLoading(false);
    }
  }, [vendorId, currentOrganization?.id]);

  const fetchData = async () => {
    if (!currentOrganization?.id || !vendorId) return;

    try {
      setLoading(true);
      const [vendorRes, slasRes] = await Promise.all([
        supabase
          .from('vendors')
          .select('*')
          .eq('id', vendorId)
          .eq('organization_id', currentOrganization.id)
          .maybeSingle(),
        supabase
          .from('vendor_slas')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false }),
      ]);

      if (vendorRes.error) throw vendorRes.error;
      setVendor(vendorRes.data);

      if (slasRes.data) {
        setSlas(slasRes.data);
        if (slasRes.data.length > 0) {
          const measurementsRes = await supabase
            .from('sla_measurements')
            .select('*')
            .in('sla_id', slasRes.data.map((s) => s.id))
            .order('measurement_period_end', { ascending: false });

          if (measurementsRes.data) {
            const grouped = measurementsRes.data.reduce((acc, m) => {
              if (!acc[m.sla_id]) acc[m.sla_id] = [];
              acc[m.sla_id].push(m);
              return acc;
            }, {} as Record<string, SLAMeasurement[]>);
            setMeasurements(grouped);
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSLA = async () => {
    if (!currentOrganization?.id || !vendorId) return;
    if (!slaForm.sla_name || !slaForm.target_value) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        organization_id: currentOrganization.id,
        vendor_id: vendorId,
        sla_name: slaForm.sla_name,
        sla_category: slaForm.sla_category,
        target_value: parseFloat(slaForm.target_value),
        target_unit: slaForm.target_unit,
        measurement_frequency: slaForm.measurement_frequency,
        penalty_clause: slaForm.penalty_clause || null,
        credit_percentage: slaForm.credit_percentage ? parseFloat(slaForm.credit_percentage) : null,
      };

      if (editingSLA) {
        const { error } = await supabase
          .from('vendor_slas')
          .update(payload)
          .eq('id', editingSLA.id);
        if (error) throw error;
        toast.success('SLA updated successfully');
      } else {
        const { error } = await supabase.from('vendor_slas').insert(payload);
        if (error) throw error;
        toast.success('SLA created successfully');
      }

      setShowAddSLA(false);
      setEditingSLA(null);
      resetSLAForm();
      fetchData();
    } catch (error) {
      logger.error('Error saving SLA:', error);
      toast.error('Failed to save SLA');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSLA = (slaId: string) => {
    setPendingDeleteId(slaId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSLA = async () => {
    if (!pendingDeleteId) return;
    try {
      const { error } = await supabase.from('vendor_slas').delete().eq('id', pendingDeleteId);
      if (error) throw error;
      toast.success('SLA deleted successfully');
      setSelectedSLA(null);
      fetchData();
    } catch (error) {
      logger.error('Error deleting SLA:', error);
      toast.error('Failed to delete SLA');
    } finally {
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  };

  const handleSaveMeasurement = async () => {
    if (!selectedSLA || !user) return;
    if (!measurementForm.measurement_period_start || !measurementForm.measurement_period_end || !measurementForm.actual_value) {
      toast.error('Please fill in required fields');
      return;
    }

    const sla = slas.find((s) => s.id === selectedSLA);
    if (!sla) return;

    const actualValue = parseFloat(measurementForm.actual_value);
    const targetMet = sla.target_unit === 'hours' || sla.target_unit === 'minutes' || sla.target_unit === 'days'
      ? actualValue <= sla.target_value
      : actualValue >= sla.target_value;

    try {
      setSaving(true);
      const { error } = await supabase.from('sla_measurements').insert({
        sla_id: selectedSLA,
        measurement_period_start: measurementForm.measurement_period_start,
        measurement_period_end: measurementForm.measurement_period_end,
        actual_value: actualValue,
        target_met: targetMet,
        notes: measurementForm.notes || null,
        recorded_by: user.id,
      });

      if (error) throw error;
      toast.success('Measurement recorded successfully');
      setShowAddMeasurement(false);
      resetMeasurementForm();
      fetchData();
    } catch (error) {
      logger.error('Error saving measurement:', error);
      toast.error('Failed to save measurement');
    } finally {
      setSaving(false);
    }
  };

  const resetSLAForm = () => {
    setSlaForm({
      sla_name: '',
      sla_category: 'availability',
      target_value: '',
      target_unit: 'percent',
      measurement_frequency: 'monthly',
      penalty_clause: '',
      credit_percentage: '',
    });
  };

  const resetMeasurementForm = () => {
    setMeasurementForm({
      measurement_period_start: '',
      measurement_period_end: '',
      actual_value: '',
      notes: '',
    });
  };

  const openEditSLA = (sla: VendorSLA) => {
    setEditingSLA(sla);
    setSlaForm({
      sla_name: sla.sla_name,
      sla_category: sla.sla_category,
      target_value: sla.target_value.toString(),
      target_unit: sla.target_unit,
      measurement_frequency: sla.measurement_frequency,
      penalty_clause: sla.penalty_clause || '',
      credit_percentage: sla.credit_percentage?.toString() || '',
    });
    setShowAddSLA(true);
  };

  const getComplianceRate = (slaId: string) => {
    const slaMeasurements = measurements[slaId] || [];
    if (slaMeasurements.length === 0) return null;
    const metCount = slaMeasurements.filter((m) => m.target_met).length;
    return (metCount / slaMeasurements.length) * 100;
  };

  const getTrend = (slaId: string) => {
    const slaMeasurements = measurements[slaId] || [];
    if (slaMeasurements.length < 2) return 'stable';
    const sorted = [...slaMeasurements].sort(
      (a, b) => new Date(a.measurement_period_end).getTime() - new Date(b.measurement_period_end).getTime()
    );
    const recent = sorted.slice(-3);
    const earlier = sorted.slice(-6, -3);
    if (recent.length === 0 || earlier.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, m) => sum + m.actual_value, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, m) => sum + m.actual_value, 0) / earlier.length;

    const diff = recentAvg - earlierAvg;
    if (Math.abs(diff) < 1) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  };

  const getChartData = (slaId: string) => {
    const slaMeasurements = measurements[slaId] || [];
    const sla = slas.find((s) => s.id === slaId);
    if (!sla) return [];

    return [...slaMeasurements]
      .sort((a, b) => new Date(a.measurement_period_end).getTime() - new Date(b.measurement_period_end).getTime())
      .slice(-12)
      .map((m) => ({
        period: formatDate(m.measurement_period_end),
        actual: m.actual_value,
        target: sla.target_value,
        met: m.target_met,
      }));
  };

  const overallCompliance = slas.length > 0
    ? slas.reduce((sum, sla) => sum + (getComplianceRate(sla.id) || 0), 0) / slas.filter((s) => (measurements[s.id] || []).length > 0).length || 0
    : 0;

  const recentMisses = slas.flatMap((sla) =>
    (measurements[sla.id] || [])
      .filter((m) => !m.target_met)
      .slice(0, 2)
      .map((m) => ({ ...m, sla }))
  ).slice(0, 5);

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No Organization Selected</h2>
        <p className="text-slate-600">Please select or register an organization</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Vendor not found</p>
        <Link to="/vendors" className="text-slate-900 hover:underline mt-4 inline-block">
          Back to Vendors
        </Link>
      </div>
    );
  }

  const selectedSLAData = selectedSLA ? slas.find((s) => s.id === selectedSLA) : null;

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(`/vendors/${vendorId}`)}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {vendor.legal_name}
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Gauge className="w-8 h-8 mr-3" />
              SLA Performance Tracking
            </h1>
            <p className="text-slate-600 mt-1">
              Monitor service level agreements for <span className="font-medium">{vendor.legal_name}</span>
            </p>
          </div>
          <button
            onClick={() => {
              resetSLAForm();
              setEditingSLA(null);
              setShowAddSLA(true);
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add SLA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Total SLAs</p>
          <p className="text-2xl font-bold text-slate-900">{slas.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Overall Compliance</p>
          <p className={`text-2xl font-bold ${overallCompliance >= 95 ? 'text-emerald-600' : overallCompliance >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
            {overallCompliance.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Active SLAs</p>
          <p className="text-2xl font-bold text-blue-600">{slas.filter((s) => s.is_active).length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Recent Misses</p>
          <p className="text-2xl font-bold text-red-600">{recentMisses.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">SLA Definitions</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
              {slas.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <Target className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No SLAs defined yet</p>
                </div>
              ) : (
                slas.map((sla) => {
                  const compliance = getComplianceRate(sla.id);
                  const trend = getTrend(sla.id);
                  const categoryConfig = CATEGORY_CONFIG[sla.sla_category];

                  return (
                    <button
                      key={sla.id}
                      onClick={() => setSelectedSLA(sla.id)}
                      className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                        selectedSLA === sla.id ? 'bg-slate-50 border-l-4 border-slate-900' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-slate-900">{sla.sla_name}</span>
                        {!sla.is_active && (
                          <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">Inactive</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${categoryConfig.color}`}>
                          {categoryConfig.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          Target: {sla.target_value}{sla.target_unit === 'percent' ? '%' : ` ${sla.target_unit}`}
                        </span>
                      </div>
                      {compliance !== null && (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${compliance >= 95 ? 'text-emerald-600' : compliance >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
                            {compliance.toFixed(0)}% compliance
                          </span>
                          {trend === 'improving' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                          {trend === 'declining' && <TrendingDown className="w-4 h-4 text-red-500" />}
                          {trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          {selectedSLAData ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{selectedSLAData.sla_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_CONFIG[selectedSLAData.sla_category].color}`}>
                        {CATEGORY_CONFIG[selectedSLAData.sla_category].label}
                      </span>
                      <span className="text-sm text-slate-500">
                        Measured {selectedSLAData.measurement_frequency}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditSLA(selectedSLAData)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSLA(selectedSLAData.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Target</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {selectedSLAData.target_value}
                      {selectedSLAData.target_unit === 'percent' ? '%' : ` ${selectedSLAData.target_unit}`}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Compliance Rate</p>
                    <p className={`text-lg font-semibold ${
                      (getComplianceRate(selectedSLAData.id) || 0) >= 95 ? 'text-emerald-600' :
                      (getComplianceRate(selectedSLAData.id) || 0) >= 90 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {getComplianceRate(selectedSLAData.id)?.toFixed(1) || 'N/A'}%
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Measurements</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {(measurements[selectedSLAData.id] || []).length}
                    </p>
                  </div>
                </div>

                {selectedSLAData.penalty_clause && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">Penalty:</span> {selectedSLAData.penalty_clause}
                      {selectedSLAData.credit_percentage && ` (${selectedSLAData.credit_percentage}% credit)`}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowAddMeasurement(true)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Record Measurement
                </button>
              </div>

              {(measurements[selectedSLAData.id] || []).length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Performance Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={getChartData(selectedSLAData.id)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis domain={selectedSLAData.target_unit === 'percent' ? [0, 100] : ['auto', 'auto']} />
                      <Tooltip />
                      <ReferenceLine
                        y={selectedSLAData.target_value}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                        label={{ value: 'Target', position: 'right', fontSize: 11 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke={CATEGORY_CONFIG[selectedSLAData.sla_category].chartColor}
                        fill={CATEGORY_CONFIG[selectedSLAData.sla_category].chartColor}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Measurement History</h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-auto">
                  {(measurements[selectedSLAData.id] || []).length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No measurements recorded yet</p>
                    </div>
                  ) : (
                    (measurements[selectedSLAData.id] || []).map((m) => (
                      <div key={m.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {m.target_met ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {m.actual_value}
                              {selectedSLAData.target_unit === 'percent' ? '%' : ` ${selectedSLAData.target_unit}`}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formatDate(m.measurement_period_start)} - {formatDate(m.measurement_period_end)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${m.target_met ? 'text-emerald-600' : 'text-red-600'}`}>
                            {m.target_met ? 'Met' : 'Missed'}
                          </span>
                          {m.notes && (
                            <p className="text-xs text-slate-500 max-w-[200px] truncate">{m.notes}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Gauge className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Select an SLA</h3>
              <p className="text-slate-600">Choose an SLA from the list to view details and performance trends</p>
            </div>
          )}
        </div>
      </div>

      {recentMisses.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
            Recent SLA Misses
          </h3>
          <div className="space-y-3">
            {recentMisses.map((miss) => (
              <div key={miss.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">{(miss as any).sla.sla_name}</p>
                  <p className="text-sm text-slate-600">
                    Actual: {miss.actual_value}
                    {(miss as any).sla.target_unit === 'percent' ? '%' : ` ${(miss as any).sla.target_unit}`}
                    {' / '}
                    Target: {(miss as any).sla.target_value}
                    {(miss as any).sla.target_unit === 'percent' ? '%' : ` ${(miss as any).sla.target_unit}`}
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {formatDate(miss.measurement_period_end)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(showAddSLA || editingSLA) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {editingSLA ? 'Edit SLA' : 'Add New SLA'}
              </h3>
              <button
                onClick={() => {
                  setShowAddSLA(false);
                  setEditingSLA(null);
                  resetSLAForm();
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  SLA Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={slaForm.sla_name}
                  onChange={(e) => setSlaForm({ ...slaForm, sla_name: e.target.value })}
                  placeholder="e.g., System Uptime"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={slaForm.sla_category}
                    onChange={(e) => setSlaForm({ ...slaForm, sla_category: e.target.value as VendorSLA['sla_category'] })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                  <select
                    value={slaForm.measurement_frequency}
                    onChange={(e) => setSlaForm({ ...slaForm, measurement_frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={slaForm.target_value}
                    onChange={(e) => setSlaForm({ ...slaForm, target_value: e.target.value })}
                    placeholder="e.g., 99.9"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                  <select
                    value={slaForm.target_unit}
                    onChange={(e) => setSlaForm({ ...slaForm, target_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Penalty Clause</label>
                <textarea
                  rows={2}
                  value={slaForm.penalty_clause}
                  onChange={(e) => setSlaForm({ ...slaForm, penalty_clause: e.target.value })}
                  placeholder="Describe penalty for missed SLA..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Credit Percentage</label>
                <input
                  type="number"
                  value={slaForm.credit_percentage}
                  onChange={(e) => setSlaForm({ ...slaForm, credit_percentage: e.target.value })}
                  placeholder="e.g., 10"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddSLA(false);
                  setEditingSLA(null);
                  resetSLAForm();
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSLA}
                disabled={saving}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingSLA ? 'Update SLA' : 'Create SLA'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMeasurement && selectedSLA && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Record Measurement</h3>
              <button
                onClick={() => {
                  setShowAddMeasurement(false);
                  resetMeasurementForm();
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Period Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={measurementForm.measurement_period_start}
                    onChange={(e) => setMeasurementForm({ ...measurementForm, measurement_period_start: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Period End <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={measurementForm.measurement_period_end}
                    onChange={(e) => setMeasurementForm({ ...measurementForm, measurement_period_end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Actual Value <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={measurementForm.actual_value}
                    onChange={(e) => setMeasurementForm({ ...measurementForm, actual_value: e.target.value })}
                    placeholder="e.g., 99.5"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                  <span className="text-slate-500">
                    {selectedSLAData?.target_unit === 'percent' ? '%' : selectedSLAData?.target_unit}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Target: {selectedSLAData?.target_value}
                  {selectedSLAData?.target_unit === 'percent' ? '%' : ` ${selectedSLAData?.target_unit}`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={measurementForm.notes}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddMeasurement(false);
                  resetMeasurementForm();
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMeasurement}
                disabled={saving}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Measurement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={confirmDeleteSLA}
        onCancel={() => { setShowDeleteConfirm(false); setPendingDeleteId(null); }}
        title="Delete SLA"
        message="Are you sure you want to delete this SLA? All measurements will also be deleted."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

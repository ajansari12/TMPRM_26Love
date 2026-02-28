import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useOrganization } from '../contexts/OrganizationContext';
import { Vendor } from '../types';
import { formatDate } from '../lib/utils';
import {
  ArrowLeft,
  Plus,
  Users,
  Building2,
  Globe,
  AlertTriangle,
  Shield,
  Database,
  X,
  Pencil,
  Trash2,
  MapPin,
  CheckCircle,
} from 'lucide-react';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

interface FourthParty {
  id: string;
  organization_id: string;
  vendor_id: string;
  name: string;
  legal_name: string | null;
  country: string | null;
  service_description: string | null;
  criticality: 'critical' | 'high' | 'medium' | 'low' | null;
  data_access_level: 'none' | 'limited' | 'full' | null;
  is_offshore: boolean;
  risk_assessment_status: 'not_assessed' | 'in_progress' | 'assessed' | 'requires_review';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const CRITICALITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-800' },
  { value: 'low', label: 'Low', color: 'bg-emerald-100 text-emerald-800' },
];

const DATA_ACCESS_OPTIONS = [
  { value: 'none', label: 'No Access', icon: Shield },
  { value: 'limited', label: 'Limited Access', icon: Database },
  { value: 'full', label: 'Full Access', icon: AlertTriangle },
];

const ASSESSMENT_STATUS_OPTIONS = [
  { value: 'not_assessed', label: 'Not Assessed', color: 'bg-slate-100 text-slate-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'assessed', label: 'Assessed', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'requires_review', label: 'Requires Review', color: 'bg-amber-100 text-amber-800' },
];

const COUNTRY_OPTIONS = [
  'Canada',
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Netherlands',
  'India',
  'Philippines',
  'Singapore',
  'Australia',
  'Ireland',
  'Poland',
  'Brazil',
  'Mexico',
  'Other',
];

export default function FourthParties() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [fourthParties, setFourthParties] = useState<FourthParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<FourthParty | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    country: '',
    service_description: '',
    criticality: '',
    data_access_level: '',
    is_offshore: false,
    risk_assessment_status: 'not_assessed',
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
      const [vendorRes, partiesRes] = await Promise.all([
        supabase
          .from('vendors')
          .select('*')
          .eq('id', vendorId)
          .eq('organization_id', currentOrganization.id)
          .maybeSingle(),
        supabase
          .from('fourth_parties')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('organization_id', currentOrganization.id)
          .order('criticality', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (vendorRes.error) throw vendorRes.error;
      if (partiesRes.error) throw partiesRes.error;

      setVendor(vendorRes.data);
      setFourthParties(partiesRes.data || []);
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (party?: FourthParty) => {
    if (party) {
      setEditingParty(party);
      setFormData({
        name: party.name,
        legal_name: party.legal_name || '',
        country: party.country || '',
        service_description: party.service_description || '',
        criticality: party.criticality || '',
        data_access_level: party.data_access_level || '',
        is_offshore: party.is_offshore,
        risk_assessment_status: party.risk_assessment_status,
        notes: party.notes || '',
      });
    } else {
      setEditingParty(null);
      setFormData({
        name: '',
        legal_name: '',
        country: '',
        service_description: '',
        criticality: '',
        data_access_level: '',
        is_offshore: false,
        risk_assessment_status: 'not_assessed',
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingParty(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id || !vendorId) return;

    try {
      setSaving(true);
      const payload = {
        organization_id: currentOrganization.id,
        vendor_id: vendorId,
        name: formData.name,
        legal_name: formData.legal_name || null,
        country: formData.country || null,
        service_description: formData.service_description || null,
        criticality: formData.criticality || null,
        data_access_level: formData.data_access_level || null,
        is_offshore: formData.is_offshore,
        risk_assessment_status: formData.risk_assessment_status,
        notes: formData.notes || null,
      };

      if (editingParty) {
        const { error } = await supabase
          .from('fourth_parties')
          .update(payload)
          .eq('id', editingParty.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fourth_parties').insert(payload);
        if (error) throw error;
      }

      handleCloseModal();
      fetchData();
    } catch (error) {
      logger.error('Error saving fourth party:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('fourth_parties').delete().eq('id', id);
      if (error) throw error;
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      logger.error('Error deleting fourth party:', error);
    }
  };

  const getCriticalityConfig = (criticality: string | null) => {
    return CRITICALITY_OPTIONS.find((c) => c.value === criticality) || null;
  };

  const getDataAccessConfig = (level: string | null) => {
    return DATA_ACCESS_OPTIONS.find((d) => d.value === level) || null;
  };

  const getAssessmentStatusConfig = (status: string) => {
    return ASSESSMENT_STATUS_OPTIONS.find((s) => s.value === status) || ASSESSMENT_STATUS_OPTIONS[0];
  };

  const criticalCount = fourthParties.filter((p) => p.criticality === 'critical').length;
  const highCount = fourthParties.filter((p) => p.criticality === 'high').length;
  const offshoreCount = fourthParties.filter((p) => p.is_offshore).length;
  const fullAccessCount = fourthParties.filter((p) => p.data_access_level === 'full').length;

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
              <Users className="w-8 h-8 mr-3" />
              Fourth Parties / Subcontractors
            </h1>
            <p className="text-slate-600 mt-1">
              Managing subcontractors for <span className="font-medium">{vendor.legal_name}</span>
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Fourth Party</span>
          </button>
        </div>
      </div>

      {fourthParties.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600 mb-1">Total Fourth Parties</p>
            <p className="text-2xl font-bold text-slate-900">{fourthParties.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600 mb-1">Critical / High Risk</p>
            <p className="text-2xl font-bold text-red-600">
              {criticalCount + highCount}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600 mb-1">Offshore Locations</p>
            <div className="flex items-center">
              <Globe className="w-5 h-5 text-amber-500 mr-2" />
              <p className="text-2xl font-bold text-amber-600">{offshoreCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600 mb-1">Full Data Access</p>
            <div className="flex items-center">
              <Database className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-2xl font-bold text-red-600">{fullAccessCount}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {fourthParties.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Fourth Parties</h3>
            <p className="text-slate-600 mb-6">
              {vendor.uses_subcontractors
                ? 'Add subcontractors used by this vendor to track concentration risk'
                : 'This vendor is not marked as using subcontractors'}
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Fourth Party</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {fourthParties.map((party) => {
              const critConfig = getCriticalityConfig(party.criticality);
              const dataConfig = getDataAccessConfig(party.data_access_level);
              const statusConfig = getAssessmentStatusConfig(party.risk_assessment_status);
              const DataIcon = dataConfig?.icon || Shield;

              return (
                <div key={party.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{party.name}</h3>
                        {critConfig && (
                          <span className={`px-2 py-1 text-xs font-medium rounded ${critConfig.color}`}>
                            {critConfig.label}
                          </span>
                        )}
                        {party.is_offshore && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800 flex items-center">
                            <Globe className="w-3 h-3 mr-1" />
                            Offshore
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>

                      {party.legal_name && party.legal_name !== party.name && (
                        <p className="text-sm text-slate-500 mb-1">Legal: {party.legal_name}</p>
                      )}

                      <div className="flex items-center space-x-4 text-sm text-slate-600 mb-3">
                        {party.country && (
                          <span className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {party.country}
                          </span>
                        )}
                        {dataConfig && (
                          <span className={`flex items-center ${party.data_access_level === 'full' ? 'text-red-600' : ''}`}>
                            <DataIcon className="w-4 h-4 mr-1" />
                            {dataConfig.label}
                          </span>
                        )}
                      </div>

                      {party.service_description && (
                        <p className="text-sm text-slate-700">{party.service_description}</p>
                      )}

                      <p className="text-xs text-slate-400 mt-2">
                        Added {formatDate(party.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleOpenModal(party)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === party.id ? (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleDelete(party.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(party.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-900/50 transition-opacity" onClick={handleCloseModal} />

            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-auto z-10">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingParty ? 'Edit Fourth Party' : 'Add Fourth Party'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Legal Name
                      </label>
                      <input
                        type="text"
                        value={formData.legal_name}
                        onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        placeholder="Official legal name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                      <select
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      >
                        <option value="">Select country</option>
                        {COUNTRY_OPTIONS.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Criticality</label>
                      <select
                        value={formData.criticality}
                        onChange={(e) => setFormData({ ...formData, criticality: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      >
                        <option value="">Select criticality</option>
                        {CRITICALITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Data Access Level
                      </label>
                      <select
                        value={formData.data_access_level}
                        onChange={(e) => setFormData({ ...formData, data_access_level: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      >
                        <option value="">Select access level</option>
                        {DATA_ACCESS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Assessment Status
                      </label>
                      <select
                        value={formData.risk_assessment_status}
                        onChange={(e) => setFormData({ ...formData, risk_assessment_status: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      >
                        {ASSESSMENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Service Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.service_description}
                      onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      placeholder="What services does this subcontractor provide?"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_offshore"
                      checked={formData.is_offshore}
                      onChange={(e) => setFormData({ ...formData, is_offshore: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <label htmlFor="is_offshore" className="ml-2 text-sm text-slate-700">
                      Offshore location (outside Canada)
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      placeholder="Additional notes"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formData.name}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>{editingParty ? 'Update' : 'Add'} Fourth Party</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

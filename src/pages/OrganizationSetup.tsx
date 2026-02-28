import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Save,
  Globe,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronRight,
  Settings,
  FileText,
  Mail,
  Phone,
  MapPin,
  Hash,
  Briefcase,
} from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { Organization, InstitutionType, INSTITUTION_TYPE_LABELS } from '../types/organization';
import { logger } from '../lib/logger';

interface OrganizationFormData {
  name: string;
  legal_name: string;
  institution_type: InstitutionType;
  osfi_registration_number: string;
  lei: string;
  headquarters_country: string;
  headquarters_address: {
    street: string;
    city: string;
    province: string;
    postal_code: string;
  };
  contact_email: string;
  contact_phone: string;
  website: string;
  risk_appetite: 'conservative' | 'moderate' | 'aggressive';
  fiscal_year_end: string;
}

const PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 
  'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 
  'Prince Edward Island', 'Quebec', 'Saskatchewan',
  'Northwest Territories', 'Nunavut', 'Yukon'
];

const RISK_APPETITE_OPTIONS = [
  { value: 'conservative', label: 'Conservative', description: 'Lower risk tolerance, more stringent controls' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced approach to risk and opportunity' },
  { value: 'aggressive', label: 'Aggressive', description: 'Higher risk tolerance for greater returns' },
];

export default function OrganizationSetup() {
  const navigate = useNavigate();
  const { currentOrganization, updateOrganization, currentMembership, isPlatformAdmin } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'regulatory' | 'settings'>('general');

  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    legal_name: '',
    institution_type: 'bank',
    osfi_registration_number: '',
    lei: '',
    headquarters_country: 'Canada',
    headquarters_address: {
      street: '',
      city: '',
      province: '',
      postal_code: '',
    },
    contact_email: '',
    contact_phone: '',
    website: '',
    risk_appetite: 'moderate',
    fiscal_year_end: '12',
  });

  // Check permissions
  const canEdit = isPlatformAdmin || currentMembership?.defense_line === 'admin';

  useEffect(() => {
    if (currentOrganization) {
      setFormData({
        name: currentOrganization.name || '',
        legal_name: currentOrganization.legal_name || '',
        institution_type: currentOrganization.institution_type || 'bank',
        osfi_registration_number: currentOrganization.osfi_registration_number || '',
        lei: currentOrganization.lei || '',
        headquarters_country: currentOrganization.headquarters_country || 'Canada',
        headquarters_address: currentOrganization.headquarters_address || {
          street: '',
          city: '',
          province: '',
          postal_code: '',
        },
        contact_email: currentOrganization.contact_email || '',
        contact_phone: currentOrganization.contact_phone || '',
        website: currentOrganization.website || '',
        risk_appetite: currentOrganization.risk_appetite || 'moderate',
        fiscal_year_end: currentOrganization.fiscal_year_end || '12',
      });
    }
  }, [currentOrganization]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaved(false);
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      headquarters_address: {
        ...prev.headquarters_address,
        [field]: value,
      },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!currentOrganization || !canEdit) return;

    setSaving(true);
    try {
      await updateOrganization(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      logger.error('Failed to save organization:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No Organization Selected</h2>
          <p className="text-slate-600">Please select an organization to configure.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Building2 className="w-8 h-8 text-blue-600 mr-3" />
            Organization Setup
          </h1>
          <p className="text-slate-600 mt-1">
            Configure your organization profile and regulatory settings
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          {[
            { id: 'general', label: 'General Information', icon: Building2 },
            { id: 'regulatory', label: 'Regulatory Details', icon: Shield },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* General Information Tab */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Organization Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={!canEdit}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="e.g., Royal Bank of Canada"
                />
              </div>
            </div>

            {/* Legal Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Legal Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.legal_name}
                  onChange={(e) => handleInputChange('legal_name', e.target.value)}
                  disabled={!canEdit}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="Full legal entity name"
                />
              </div>
            </div>

            {/* Institution Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Institution Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.institution_type}
                onChange={(e) => handleInputChange('institution_type', e.target.value)}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                {Object.entries(INSTITUTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
              <div className="relative">
                <Globe className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  disabled={!canEdit}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="https://www.example.com"
                />
              </div>
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Primary Contact Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleInputChange('contact_email', e.target.value)}
                  disabled={!canEdit}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="tprm@example.com"
                />
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Primary Contact Phone
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                  disabled={!canEdit}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-slate-400" />
              Headquarters Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={formData.headquarters_address.street}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="Street Address"
                />
              </div>
              <input
                type="text"
                value={formData.headquarters_address.city}
                onChange={(e) => handleAddressChange('city', e.target.value)}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                placeholder="City"
              />
              <select
                value={formData.headquarters_address.province}
                onChange={(e) => handleAddressChange('province', e.target.value)}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="">Select Province</option>
                {PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={formData.headquarters_address.postal_code}
                onChange={(e) => handleAddressChange('postal_code', e.target.value.toUpperCase())}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                placeholder="Postal Code"
              />
              <input
                type="text"
                value={formData.headquarters_country}
                disabled
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Regulatory Details Tab */}
      {activeTab === 'regulatory' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">OSFI Regulatory Requirements</p>
              <p className="text-sm text-blue-700 mt-1">
                These identifiers are used for regulatory reporting and compliance with OSFI B-10 guidelines.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OSFI Registration Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                OSFI Registration Number
              </label>
              <div className="relative">
                <Hash className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.osfi_registration_number}
                  onChange={(e) => handleInputChange('osfi_registration_number', e.target.value)}
                  disabled={!canEdit}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="OSFI ID"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Your institution's OSFI registration identifier
              </p>
            </div>

            {/* LEI */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Legal Entity Identifier (LEI)
              </label>
              <div className="relative">
                <Hash className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.lei}
                  onChange={(e) => handleInputChange('lei', e.target.value.toUpperCase())}
                  disabled={!canEdit}
                  maxLength={20}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  placeholder="20-character LEI code"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Global Legal Entity Identifier for cross-border identification
              </p>
            </div>

            {/* Fiscal Year End */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fiscal Year End Month
              </label>
              <select
                value={formData.fiscal_year_end}
                onChange={(e) => handleInputChange('fiscal_year_end', e.target.value)}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Risk Appetite */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Risk Appetite</h3>
            <p className="text-sm text-slate-600 mb-4">
              Define your organization's overall risk appetite for third-party relationships.
              This setting influences default risk thresholds and workflow routing.
            </p>
            <div className="space-y-3">
              {RISK_APPETITE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.risk_appetite === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${!canEdit ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <input
                    type="radio"
                    name="risk_appetite"
                    value={option.value}
                    checked={formData.risk_appetite === option.value}
                    onChange={(e) => handleInputChange('risk_appetite', e.target.value)}
                    disabled={!canEdit}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{option.label}</p>
                    <p className="text-sm text-slate-600">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Additional Settings</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/org/users')}
                className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-slate-600 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900">User Management</p>
                    <p className="text-sm text-slate-500">Manage users and defense line assignments</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/org/workflows')}
                className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center">
                  <Settings className="w-5 h-5 text-slate-600 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900">Workflow Configuration</p>
                    <p className="text-sm text-slate-500">Customize approval workflows and SLAs</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Warning */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">View Only Mode</p>
            <p className="text-sm text-amber-700 mt-1">
              You don't have permission to edit organization settings. Contact your administrator
              if you need to make changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

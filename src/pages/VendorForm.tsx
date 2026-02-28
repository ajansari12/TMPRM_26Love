import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Vendor } from '../types';
import {
  SERVICE_CATEGORIES,
  BUSINESS_UNITS,
  PROVIDER_TYPES,
  CONTRACT_TYPES,
  DATA_ACCESS_LEVELS,
} from '../lib/constants';
import { Save, X, AlertCircle, Building2, Lock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

type VendorFormData = Omit<Vendor, 'id' | 'created_at' | 'updated_at' | 'vendor_id'>;

export default function VendorForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState(1);
  const isEdit = !!id;

  useEffect(() => {
    if (!isEdit) {
      navigate('/onboarding/new', { replace: true });
    }
  }, [isEdit, navigate]);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<VendorFormData>({
    defaultValues: {
      country: 'Canada',
      status: 'pending_approval',
      lifecycle_stage: 'identification',
      has_system_access: false,
      handles_sensitive_data: false,
      uses_subcontractors: false,
      has_formal_contract: false,
      is_critical: false,
    },
  });

  const watchHasSystemAccess = watch('has_system_access');
  const watchUsesSubcontractors = watch('uses_subcontractors');
  const watchHasFormalContract = watch('has_formal_contract');

  useEffect(() => {
    if (isEdit && currentOrganization?.id) {
      fetchVendor();
    }
  }, [id, currentOrganization?.id]);

  const [originalVendor, setOriginalVendor] = useState<any>(null);

  const fetchVendor = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .eq('organization_id', currentOrganization.id)
        .single();

      if (error) throw error;

      // Store original vendor data for change tracking
      setOriginalVendor(data);

      Object.keys(data).forEach((key) => {
        setValue(key as any, data[key]);
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: VendorFormData) => {
    // Early validation: prevent any creation attempts
    if (!isEdit || !id) {
      toast.error('New vendor creation must go through the onboarding process');
      navigate('/onboarding/new', { replace: true });
      return;
    }

    if (!currentOrganization?.id) {
      setError('No organization selected');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Filter out risk/assessment fields - these can only be changed through reassessment
      const {
        tier,
        status,
        is_critical,
        impact_score,
        likelihood_score,
        risk_rating,
        inherent_risk_level,
        lifecycle_stage,
        vendor_id,
        created_at,
        updated_at,
        created_by,
        ...editableData
      } = data as any;

      const vendorData = {
        ...editableData,
        // Don't change organization_id on update
      };

      // Update vendor profile
      const { error } = await supabase
        .from('vendors')
        .update(vendorData)
        .eq('id', id)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      // Track changes for audit log
      if (originalVendor) {
        const changedFields = Object.keys(editableData).filter(
          (key) => originalVendor[key] !== editableData[key]
        );

        if (changedFields.length > 0) {
          const changesBefore = Object.fromEntries(
            changedFields.map((f) => [f, originalVendor[f]])
          );
          const changesAfter = Object.fromEntries(
            changedFields.map((f) => [f, editableData[f]])
          );

          await supabase.from('audit_logs').insert({
            organization_id: currentOrganization.id,
            user_id: user?.id,
            action: 'vendor_profile_updated',
            entity_type: 'vendor',
            entity_id: id,
            changes: {
              fields: changedFields,
              before: changesBefore,
              after: changesAfter,
            },
            notes: `Vendor profile updated. Modified fields: ${changedFields.join(', ')}`,
          });
        }
      }

      toast.success('Vendor profile updated successfully');
      navigate('/vendors');
    } catch (error: any) {
      setError(error.message);
      toast.error(`Failed to update vendor: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 1, title: 'Company Information' },
    { id: 2, title: 'Primary Contact' },
    { id: 3, title: 'Service Classification' },
    { id: 4, title: 'Internal Ownership' },
    { id: 5, title: 'Risk & Compliance Profile' },
    { id: 6, title: 'Contract Information' },
    { id: 7, title: 'Data Access' },
    { id: 8, title: 'Subcontractors' },
    { id: 9, title: 'Notes' },
  ];

  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          No Organization Selected
        </h2>
        <p className="text-slate-600">
          Please select or register an organization to add vendors
        </p>
      </div>
    );
  }

  if (loading && isEdit) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-56 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-80 bg-slate-200 rounded animate-pulse" />
        </div>
        <CardSkeleton count={1} />
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Edit Third Party Profile
          </h1>
          <p className="text-slate-600 mt-1">
            {currentOrganization.name} - Update vendor contact and profile information. Risk assessment fields are managed through formal reassessments.
          </p>
        </div>
        <button
          onClick={() => navigate('/vendors')}
          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-2"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        {/* Section Navigation */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sticky top-6">
            <h3 className="font-semibold text-slate-900 mb-3">Sections</h3>
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {section.id}. {section.title}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Form Content */}
        <div className="col-span-3">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white rounded-lg shadow">
              {/* Section 1: Company Information */}
              {activeSection === 1 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">1. Company Information</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Legal Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register('legal_name', { required: 'Legal name is required' })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                        {errors.legal_name && (
                          <p className="mt-1 text-sm text-red-600">{errors.legal_name.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Trading Name / DBA
                        </label>
                        <input
                          {...register('trading_name')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description
                      </label>
                      <textarea
                        {...register('description')}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="Brief description of the company and its services"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Street Address
                        </label>
                        <input
                          {...register('street_address')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Suite / Unit
                        </label>
                        <input
                          {...register('suite_unit')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          City
                        </label>
                        <input
                          {...register('city')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Province / State
                        </label>
                        <input
                          {...register('province_state')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Postal Code
                        </label>
                        <input
                          {...register('postal_code')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Country <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register('country', { required: 'Country is required' })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                        {errors.country && (
                          <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Website
                        </label>
                        <input
                          {...register('website')}
                          type="url"
                          placeholder="https://example.com"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Number of Employees
                        </label>
                        <input
                          {...register('number_of_employees', { valueAsNumber: true })}
                          type="number"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Years in Operation
                        </label>
                        <input
                          {...register('years_in_operation', { valueAsNumber: true })}
                          type="number"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          LEI (if applicable)
                        </label>
                        <input
                          {...register('lei')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Ultimate Parent Company
                      </label>
                      <input
                        {...register('ultimate_parent_name')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="If part of a larger organization"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Section 2: Primary Contact */}
              {activeSection === 2 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">2. Primary Contact</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contact Name
                      </label>
                      <input
                        {...register('primary_contact_name')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Email Address
                        </label>
                        <input
                          {...register('primary_contact_email')}
                          type="email"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          {...register('primary_contact_phone')}
                          type="tel"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Service Classification */}
              {activeSection === 3 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">3. Service Classification</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Service Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        {...register('service_category', { required: 'Service category is required' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        <option value="">Select a category...</option>
                        {SERVICE_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      {errors.service_category && (
                        <p className="mt-1 text-sm text-red-600">{errors.service_category.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Service Description
                      </label>
                      <textarea
                        {...register('service_description')}
                        rows={4}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="Detailed description of services provided"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Provider Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        {...register('provider_type', { required: 'Provider type is required' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        <option value="">Select provider type...</option>
                        {PROVIDER_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      {errors.provider_type && (
                        <p className="mt-1 text-sm text-red-600">{errors.provider_type.message}</p>
                      )}
                      <p className="mt-1 text-sm text-slate-500">
                        {PROVIDER_TYPES.find((t) => t.value === watch('provider_type'))?.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 4: Internal Ownership */}
              {activeSection === 4 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">4. Internal Ownership</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Responsible Officer
                      </label>
                      <input
                        {...register('responsible_officer')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="Name of the internal officer responsible for this relationship"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Business Unit
                      </label>
                      <select
                        {...register('business_unit')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        <option value="">Select business unit...</option>
                        {BUSINESS_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 5: Risk & Compliance Profile (Read-Only) */}
              {activeSection === 5 && (
                <div className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-slate-900">5. Risk & Compliance Profile</h2>
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>

                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Read-Only Section</p>
                      <p>
                        These fields are managed through the formal risk assessment and reassessment process.
                        They cannot be edited directly through this form.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Risk Tier
                        </label>
                        <input
                          value={watch('tier') || 'Not assessed'}
                          disabled
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Managed through risk assessment process
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Vendor Status
                        </label>
                        <input
                          value={watch('status') || 'N/A'}
                          disabled
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Managed through workflow transitions
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Lifecycle Stage
                        </label>
                        <input
                          value={watch('lifecycle_stage') || 'N/A'}
                          disabled
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Managed through vendor lifecycle
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center text-sm font-medium text-slate-700 mb-1">
                          Critical Vendor Flag
                        </label>
                        <div className="flex items-center h-10">
                          <input
                            type="checkbox"
                            checked={watch('is_critical') || false}
                            disabled
                            className="rounded border-slate-300 text-slate-900 cursor-not-allowed opacity-50"
                          />
                          <span className="ml-2 text-sm text-slate-600">
                            {watch('is_critical') ? 'Critical' : 'Non-Critical'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Determined by assessment scoring
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Impact Score
                        </label>
                        <input
                          value={watch('impact_score') || 'N/A'}
                          disabled
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          From risk assessment
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Likelihood Score
                        </label>
                        <input
                          value={watch('likelihood_score') || 'N/A'}
                          disabled
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          From risk assessment
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Overall Risk Rating
                        </label>
                        <input
                          value={watch('risk_rating') || 'N/A'}
                          disabled
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Calculated from scores
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Inherent Risk Level
                      </label>
                      <input
                        value={watch('inherent_risk_level') || 'Not assessed'}
                        disabled
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Determined during risk assessment
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <p className="text-sm text-slate-600">
                        To update these fields, initiate a risk reassessment from the vendor detail page.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 6: Contract Information */}
              {activeSection === 6 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">6. Contract Information</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          {...register('has_formal_contract')}
                          type="checkbox"
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700">
                          Has formal contract
                        </span>
                      </label>
                    </div>

                    {watchHasFormalContract && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Contract Type
                          </label>
                          <select
                            {...register('contract_type')}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                          >
                            <option value="">Select contract type...</option>
                            {CONTRACT_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Contract Start Date
                            </label>
                            <input
                              {...register('contract_start_date')}
                              type="date"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Contract End Date
                            </label>
                            <input
                              {...register('contract_end_date')}
                              type="date"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Annual Contract Value (CAD)
                          </label>
                          <input
                            {...register('contract_value_cad', { valueAsNumber: true })}
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Section 7: Data Access */}
              {activeSection === 7 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">7. Data Access</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          {...register('has_system_access')}
                          type="checkbox"
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700">
                          Has system access
                        </span>
                      </label>
                    </div>

                    {watchHasSystemAccess && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Data Access Level
                          </label>
                          <select
                            {...register('data_access_level')}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                          >
                            <option value="">Select access level...</option>
                            {DATA_ACCESS_LEVELS.map((level) => (
                              <option key={level.value} value={level.value}>
                                {level.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Data Location
                          </label>
                          <input
                            {...register('data_location')}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                            placeholder="e.g., Canada, United States, European Union"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="flex items-center">
                        <input
                          {...register('handles_sensitive_data')}
                          type="checkbox"
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700">
                          Handles sensitive data (PII, financial data, etc.)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 8: Subcontractors */}
              {activeSection === 8 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">8. Subcontractors</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          {...register('uses_subcontractors')}
                          type="checkbox"
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700">
                          Uses subcontractors / fourth parties
                        </span>
                      </label>
                    </div>

                    {watchUsesSubcontractors && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Subcontractor Oversight Level
                        </label>
                        <select
                          {...register('subcontractor_oversight_level')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        >
                          <option value="">Select oversight level...</option>
                          <option value="comprehensive">Comprehensive - Full visibility and control</option>
                          <option value="significant">Significant - Regular monitoring</option>
                          <option value="moderate">Moderate - Periodic reviews</option>
                          <option value="limited">Limited - Basic oversight</option>
                          <option value="minimal">Minimal - Little to no oversight</option>
                        </select>
                        <p className="mt-1 text-sm text-slate-500">
                          Level of visibility and control over subcontractor arrangements
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 9: Notes */}
              {activeSection === 9 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">9. Notes</h2>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      {...register('notes')}
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      placeholder="Any additional information or special considerations"
                    />
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  {activeSection > 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveSection(activeSection - 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white transition-colors"
                    >
                      Previous
                    </button>
                  )}
                  {activeSection < sections.length && (
                    <button
                      type="button"
                      onClick={() => setActiveSection(activeSection + 1)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Next Section
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Saving...' : 'Update Vendor Profile'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

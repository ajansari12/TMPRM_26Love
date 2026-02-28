import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  User,
  FileText,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Shield,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  InstitutionType,
  INSTITUTION_TYPE_LABELS,
  OrganizationSettings,
} from '../types/organization';
import { logger } from '../lib/logger';

interface FormData {
  name: string;
  trading_name: string;
  institution_type: InstitutionType;
  osfi_registration_number: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  lei: string;
  fiscal_year_end: string;
  street_address: string;
  city: string;
  province_state: string;
  postal_code: string;
  country: string;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  trading_name: '',
  institution_type: 'bank',
  osfi_registration_number: '',
  primary_contact_name: '',
  primary_contact_email: '',
  primary_contact_phone: '',
  lei: '',
  fiscal_year_end: '',
  street_address: '',
  city: '',
  province_state: '',
  postal_code: '',
  country: 'Canada',
};

const STEPS = [
  { id: 1, title: 'Organization Details', icon: Building2 },
  { id: 2, title: 'Primary Contact', icon: User },
  { id: 3, title: 'Regulatory Information', icon: FileText },
  { id: 4, title: 'Review & Submit', icon: CheckCircle },
];

const PROVINCES = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Northwest Territories',
  'Nova Scotia',
  'Nunavut',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Yukon',
];

const FISCAL_MONTHS = [
  { value: '01-31', label: 'January 31' },
  { value: '02-28', label: 'February 28' },
  { value: '03-31', label: 'March 31' },
  { value: '04-30', label: 'April 30' },
  { value: '05-31', label: 'May 31' },
  { value: '06-30', label: 'June 30' },
  { value: '07-31', label: 'July 31' },
  { value: '08-31', label: 'August 31' },
  { value: '09-30', label: 'September 30' },
  { value: '10-31', label: 'October 31' },
  { value: '11-30', label: 'November 30' },
  { value: '12-31', label: 'December 31' },
];

export default function FIOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createOrganization, organizations } = useOrganization();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Legal name is required';
      }
      if (!formData.institution_type) {
        newErrors.institution_type = 'Institution type is required';
      }
    }

    if (step === 2) {
      if (!formData.primary_contact_name.trim()) {
        newErrors.primary_contact_name = 'Contact name is required';
      }
      if (!formData.primary_contact_email.trim()) {
        newErrors.primary_contact_email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primary_contact_email)) {
        newErrors.primary_contact_email = 'Invalid email format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const defaultSettings: OrganizationSettings = {
        require_1b_review: true,
        require_2nd_line_for_critical: true,
        auto_approve_low_risk: false,
        onboarding_sla_days: 14,
        due_diligence_reminder_days: [30, 14, 7],
        default_review_frequency_days: 365,
      };

      const org = await createOrganization({
        name: formData.name,
        trading_name: formData.trading_name || undefined,
        institution_type: formData.institution_type,
        osfi_registration_number: formData.osfi_registration_number || undefined,
        lei: formData.lei || undefined,
        primary_contact_name: formData.primary_contact_name,
        primary_contact_email: formData.primary_contact_email,
        primary_contact_phone: formData.primary_contact_phone || undefined,
        street_address: formData.street_address || undefined,
        city: formData.city || undefined,
        province_state: formData.province_state || undefined,
        postal_code: formData.postal_code || undefined,
        country: formData.country,
        settings: defaultSettings,
        is_active: true,
      });

      if (org) {
        navigate('/onboarding');
      }
    } catch (error) {
      logger.error('Error creating organization:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Authentication Required</h2>
          <p className="text-slate-600 mb-6">
            Please log in or create an account to register your financial institution.
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="block w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (organizations.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Organization Already Exists
          </h2>
          <p className="text-slate-600 mb-6">
            You are already a member of an organization. You can access your organization
            dashboard or contact support to create additional organizations.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Register Your Institution</h1>
          <p className="mt-2 text-slate-600">
            Complete the following steps to onboard your financial institution to the TPRM platform
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center transition-colors
                      ${
                        currentStep > step.id
                          ? 'bg-green-600 text-white'
                          : currentStep === step.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                      }
                    `}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span
                    className={`
                      mt-2 text-sm font-medium hidden sm:block
                      ${currentStep >= step.id ? 'text-slate-900' : 'text-slate-500'}
                    `}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      flex-1 h-1 mx-4 rounded
                      ${currentStep > step.id ? 'bg-green-600' : 'bg-slate-200'}
                    `}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-8">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">
                    Organization Details
                  </h2>
                  <p className="text-slate-600 text-sm">
                    Provide basic information about your financial institution
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Legal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g., Maple Leaf Bank of Canada"
                      className={`
                        w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors
                        ${errors.name ? 'border-red-500' : 'border-slate-300'}
                      `}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Trading Name (DBA)
                    </label>
                    <input
                      type="text"
                      value={formData.trading_name}
                      onChange={(e) => updateField('trading_name', e.target.value)}
                      placeholder="e.g., Maple Leaf Bank"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Institution Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.institution_type}
                      onChange={(e) =>
                        updateField('institution_type', e.target.value as InstitutionType)
                      }
                      className={`
                        w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white
                        ${errors.institution_type ? 'border-red-500' : 'border-slate-300'}
                      `}
                    >
                      {Object.entries(INSTITUTION_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {errors.institution_type && (
                      <p className="mt-1 text-sm text-red-600">{errors.institution_type}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      OSFI Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.osfi_registration_number}
                      onChange={(e) => updateField('osfi_registration_number', e.target.value)}
                      placeholder="e.g., 123456"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Your institution's OSFI registration or charter number
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.street_address}
                      onChange={(e) => updateField('street_address', e.target.value)}
                      placeholder="e.g., 100 Bay Street, Suite 2000"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="e.g., Toronto"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Province
                    </label>
                    <select
                      value={formData.province_state}
                      onChange={(e) => updateField('province_state', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                    >
                      <option value="">Select province...</option>
                      {PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => updateField('postal_code', e.target.value.toUpperCase())}
                      placeholder="e.g., M5J 2T3"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      disabled
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Primary Contact</h2>
                  <p className="text-slate-600 text-sm">
                    Provide details for the primary administrator of your organization
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    The primary contact will be set up as the organization administrator with full
                    access to manage users, workflows, and settings.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.primary_contact_name}
                      onChange={(e) => updateField('primary_contact_name', e.target.value)}
                      placeholder="e.g., John Smith"
                      className={`
                        w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors
                        ${errors.primary_contact_name ? 'border-red-500' : 'border-slate-300'}
                      `}
                    />
                    {errors.primary_contact_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.primary_contact_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.primary_contact_email}
                      onChange={(e) => updateField('primary_contact_email', e.target.value)}
                      placeholder="e.g., john.smith@mapleleafbank.ca"
                      className={`
                        w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors
                        ${errors.primary_contact_email ? 'border-red-500' : 'border-slate-300'}
                      `}
                    />
                    {errors.primary_contact_email && (
                      <p className="mt-1 text-sm text-red-600">{errors.primary_contact_email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.primary_contact_phone}
                      onChange={(e) => updateField('primary_contact_phone', e.target.value)}
                      placeholder="e.g., +1 (416) 555-0123"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">
                    Regulatory Information
                  </h2>
                  <p className="text-slate-600 text-sm">
                    Provide regulatory identifiers and fiscal year information
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Legal Entity Identifier (LEI)
                    </label>
                    <input
                      type="text"
                      value={formData.lei}
                      onChange={(e) => updateField('lei', e.target.value.toUpperCase())}
                      placeholder="e.g., 5493001KJTIIGC8Y1R12"
                      maxLength={20}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      20-character global identifier for legal entities
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fiscal Year End
                    </label>
                    <select
                      value={formData.fiscal_year_end}
                      onChange={(e) => updateField('fiscal_year_end', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                    >
                      <option value="">Select fiscal year end...</option>
                      {FISCAL_MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Used for annual reporting and attestation schedules
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-amber-800">Optional Fields</h4>
                      <p className="mt-1 text-sm text-amber-700">
                        LEI and Fiscal Year End are optional during initial registration. You can
                        update these details later in Organization Settings.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Review & Submit</h2>
                  <p className="text-slate-600 text-sm">
                    Please review your information before submitting
                  </p>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="ml-3 text-sm text-red-800">{submitError}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                      <Building2 className="w-4 h-4 mr-2 text-blue-600" />
                      Organization Details
                    </h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-slate-500">Legal Name</dt>
                        <dd className="font-medium text-slate-900">{formData.name || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Trading Name</dt>
                        <dd className="font-medium text-slate-900">
                          {formData.trading_name || '-'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Institution Type</dt>
                        <dd className="font-medium text-slate-900">
                          {INSTITUTION_TYPE_LABELS[formData.institution_type]}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">OSFI Registration</dt>
                        <dd className="font-medium text-slate-900">
                          {formData.osfi_registration_number || '-'}
                        </dd>
                      </div>
                      <div className="md:col-span-2">
                        <dt className="text-slate-500">Address</dt>
                        <dd className="font-medium text-slate-900">
                          {[
                            formData.street_address,
                            formData.city,
                            formData.province_state,
                            formData.postal_code,
                            formData.country,
                          ]
                            .filter(Boolean)
                            .join(', ') || '-'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                      <User className="w-4 h-4 mr-2 text-blue-600" />
                      Primary Contact
                    </h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-slate-500">Name</dt>
                        <dd className="font-medium text-slate-900">
                          {formData.primary_contact_name || '-'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Email</dt>
                        <dd className="font-medium text-slate-900">
                          {formData.primary_contact_email || '-'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Phone</dt>
                        <dd className="font-medium text-slate-900">
                          {formData.primary_contact_phone || '-'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-blue-600" />
                      Regulatory Information
                    </h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-slate-500">LEI</dt>
                        <dd className="font-medium text-slate-900">{formData.lei || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Fiscal Year End</dt>
                        <dd className="font-medium text-slate-900">
                          {formData.fiscal_year_end
                            ? FISCAL_MONTHS.find((m) => m.value === formData.fiscal_year_end)
                                ?.label
                            : '-'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-800">Ready to Submit</h4>
                      <p className="mt-1 text-sm text-green-700">
                        By submitting, you will create your organization and be set up as the
                        administrator. You can invite additional users and configure workflows after
                        registration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`
                inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors
                ${
                  currentStep === 1
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-200'
                }
              `}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </button>

            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Organization
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Need help?{' '}
          <a href="mailto:support@tprmguardian.com" className="text-blue-600 hover:underline">
            Contact support
          </a>{' '}
          or view our{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            onboarding guide
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { ArrowLeft, Save, CheckCircle, FileText, AlertCircle, Shield, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../lib/logger';

interface ContractData {
  id: string;
  vendor_id: string;
  contract_number: string | null;
  title: string;
  contract_type: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  auto_renewal: boolean;
  notice_period_days: number | null;
  annual_value_cad: number | null;
  total_value_cad: number | null;
  has_scope_definition: boolean;
  has_roles_responsibilities: boolean;
  has_subcontractor_provisions: boolean;
  has_pricing_terms: boolean;
  has_performance_measures: boolean;
  has_ownership_access: boolean;
  has_data_security: boolean;
  has_notification_requirements: boolean;
  has_dispute_resolution: boolean;
  has_regulatory_compliance: boolean;
  has_bcp_requirements: boolean;
  has_termination_provisions: boolean;
  has_insurance_requirements: boolean;
  has_audit_rights: boolean;
  has_osfi_access_clause: boolean;
  legal_review_status: string | null;
  legal_reviewer: string | null;
  legal_review_date: string | null;
  legal_review_notes: string | null;
  status: string;
  contract_owner: string | null;
  storage_location: string | null;
  notes: string | null;
  vendors: {
    legal_name: string;
    tier: string;
  };
}

const OSFI_PROVISIONS = [
  { key: 'has_scope_definition', label: 'Scope of Services Definition', description: 'Clear description of services to be provided' },
  { key: 'has_roles_responsibilities', label: 'Roles and Responsibilities', description: 'Defined roles for both parties' },
  { key: 'has_subcontractor_provisions', label: 'Subcontracting Provisions', description: 'Requirements for use of subcontractors' },
  { key: 'has_pricing_terms', label: 'Pricing and Payment Terms', description: 'Fee structure and payment conditions' },
  { key: 'has_performance_measures', label: 'Performance Standards and SLAs', description: 'Service level agreements and metrics' },
  { key: 'has_ownership_access', label: 'Data Ownership and Access', description: 'Rights to data and information' },
  { key: 'has_data_security', label: 'Data Security and Privacy', description: 'Protection of sensitive information' },
  { key: 'has_notification_requirements', label: 'Incident Notification Requirements', description: 'Reporting obligations for incidents' },
  { key: 'has_dispute_resolution', label: 'Dispute Resolution', description: 'Process for resolving conflicts' },
  { key: 'has_regulatory_compliance', label: 'Regulatory Compliance', description: 'Adherence to applicable laws and regulations' },
  { key: 'has_bcp_requirements', label: 'Business Continuity Requirements', description: 'BCP and disaster recovery obligations' },
  { key: 'has_termination_provisions', label: 'Termination Provisions', description: 'Conditions and process for termination' },
  { key: 'has_insurance_requirements', label: 'Insurance Requirements', description: 'Required insurance coverage' },
  { key: 'has_audit_rights', label: 'Audit Rights', description: 'Right to audit vendor operations' },
  { key: 'has_osfi_access_clause', label: 'OSFI Access Clause', description: 'OSFI right to access information and premises' },
];

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && currentOrganization) {
      fetchContract();
    }
  }, [id, currentOrganization]);

  async function fetchContract() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          vendors (
            legal_name,
            tier
          )
        `)
        .eq('id', id)
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Contract not found');
        navigate('/contracts');
        return;
      }
      setContract(data);
    } catch (error) {
      logger.error('Error fetching contract:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!contract) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .update({
          contract_number: contract.contract_number,
          title: contract.title,
          contract_type: contract.contract_type,
          effective_date: contract.effective_date,
          expiry_date: contract.expiry_date,
          auto_renewal: contract.auto_renewal,
          notice_period_days: contract.notice_period_days,
          annual_value_cad: contract.annual_value_cad,
          total_value_cad: contract.total_value_cad,
          has_scope_definition: contract.has_scope_definition,
          has_roles_responsibilities: contract.has_roles_responsibilities,
          has_subcontractor_provisions: contract.has_subcontractor_provisions,
          has_pricing_terms: contract.has_pricing_terms,
          has_performance_measures: contract.has_performance_measures,
          has_ownership_access: contract.has_ownership_access,
          has_data_security: contract.has_data_security,
          has_notification_requirements: contract.has_notification_requirements,
          has_dispute_resolution: contract.has_dispute_resolution,
          has_regulatory_compliance: contract.has_regulatory_compliance,
          has_bcp_requirements: contract.has_bcp_requirements,
          has_termination_provisions: contract.has_termination_provisions,
          has_insurance_requirements: contract.has_insurance_requirements,
          has_audit_rights: contract.has_audit_rights,
          has_osfi_access_clause: contract.has_osfi_access_clause,
          legal_review_status: contract.legal_review_status,
          legal_reviewer: contract.legal_reviewer,
          legal_review_date: contract.legal_review_date,
          legal_review_notes: contract.legal_review_notes,
          status: contract.status,
          contract_owner: contract.contract_owner,
          storage_location: contract.storage_location,
          notes: contract.notes,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Contract saved successfully');
    } catch (error) {
      logger.error('Error saving contract:', error);
      toast.error('Failed to save contract');
    } finally {
      setSaving(false);
    }
  }

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view this contract</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading contract...</div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Contract not found</p>
      </div>
    );
  }

  const provisionCompleteness = Math.round(
    (OSFI_PROVISIONS.filter((p) => contract[p.key as keyof ContractData]).length / OSFI_PROVISIONS.length) * 100
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/contracts"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contract Details</h1>
            <p className="mt-1 text-sm text-gray-500">{contract.vendors.legal_name}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Contract Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number</label>
                <input
                  type="text"
                  value={contract.contract_number || ''}
                  onChange={(e) => setContract({ ...contract, contract_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
                <select
                  value={contract.contract_type || ''}
                  onChange={(e) => setContract({ ...contract, contract_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select type</option>
                  <option value="MSA">Master Service Agreement</option>
                  <option value="SOW">Statement of Work</option>
                  <option value="SaaS">SaaS Agreement</option>
                  <option value="License">License Agreement</option>
                  <option value="Professional Services">Professional Services</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={contract.title}
                  onChange={(e) => setContract({ ...contract, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={contract.effective_date || ''}
                  onChange={(e) => setContract({ ...contract, effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={contract.expiry_date || ''}
                  onChange={(e) => setContract({ ...contract, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contract.auto_renewal}
                    onChange={(e) => setContract({ ...contract, auto_renewal: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Auto-renewal</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period (days)</label>
                <input
                  type="number"
                  value={contract.notice_period_days || ''}
                  onChange={(e) => setContract({ ...contract, notice_period_days: parseInt(e.target.value) || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Value (CAD)</label>
                <input
                  type="number"
                  value={contract.annual_value_cad || ''}
                  onChange={(e) => setContract({ ...contract, annual_value_cad: parseFloat(e.target.value) || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Value (CAD)</label>
                <input
                  type="number"
                  value={contract.total_value_cad || ''}
                  onChange={(e) => setContract({ ...contract, total_value_cad: parseFloat(e.target.value) || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={contract.status}
                  onChange={(e) => setContract({ ...contract, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="under_review">Under Review</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Owner</label>
                <input
                  type="text"
                  value={contract.contract_owner || ''}
                  onChange={(e) => setContract({ ...contract, contract_owner: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
                <input
                  type="text"
                  value={contract.storage_location || ''}
                  onChange={(e) => setContract({ ...contract, storage_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., SharePoint, Contract Management System"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">OSFI B-10 Annex 2 Provisions</h2>
            </div>
            <div className="space-y-4">
              {OSFI_PROVISIONS.map((provision) => (
                <div key={provision.key} className="border-b border-gray-100 pb-4 last:border-0">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contract[provision.key as keyof ContractData] as boolean}
                      onChange={(e) => setContract({ ...contract, [provision.key]: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{provision.label}</span>
                        {contract[provision.key as keyof ContractData] && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{provision.description}</p>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Legal Review</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Status</label>
                <select
                  value={contract.legal_review_status || ''}
                  onChange={(e) => setContract({ ...contract, legal_review_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Not Reviewed</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="approved">Approved</option>
                  <option value="approved_with_conditions">Approved with Conditions</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal Reviewer</label>
                <input
                  type="text"
                  value={contract.legal_reviewer || ''}
                  onChange={(e) => setContract({ ...contract, legal_reviewer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Date</label>
                <input
                  type="date"
                  value={contract.legal_review_date || ''}
                  onChange={(e) => setContract({ ...contract, legal_review_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal Review Notes</label>
                <textarea
                  value={contract.legal_review_notes || ''}
                  onChange={(e) => setContract({ ...contract, legal_review_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notes from legal review..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h2>
            <textarea
              value={contract.notes || ''}
              onChange={(e) => setContract({ ...contract, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional contract notes..."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">OSFI Provision Completeness</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Provisions Included</span>
                <span className="text-sm font-semibold text-gray-900">{provisionCompleteness}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    provisionCompleteness === 100 ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${provisionCompleteness}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-600">
              {OSFI_PROVISIONS.filter((p) => contract[p.key as keyof ContractData]).length} of {OSFI_PROVISIONS.length} provisions included
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">OSFI B-10 Requirement</h3>
            <p className="text-xs text-blue-700">
              All material outsourcing arrangements must include the 15 minimum provisions outlined in Annex 2.
              Ensure all applicable provisions are addressed in your contract.
            </p>
          </div>

          {contract.vendors.tier === 'tier_5_critical' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Tier 5 - Critical</h3>
              <p className="text-xs text-red-700">
                This vendor is Tier 5 (critical). Enhanced contract provisions and stricter SLAs are required.
                OSFI access clause is mandatory.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

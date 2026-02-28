import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { ArrowLeft, Save, CheckCircle, FileText, AlertCircle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '../lib/logger';

interface DueDiligenceData {
  id: string;
  vendor_id: string;
  dd_type: string;
  status: string;
  experience_competence: string | null;
  financial_strength: string | null;
  regulatory_compliance: string | null;
  reputation_risk: string | null;
  risk_management_programs: string | null;
  cyber_risk_management: string | null;
  info_security_programs: string | null;
  bcp_capability: string | null;
  subcontractor_management: string | null;
  concentration_impact: string | null;
  geographic_risk: string | null;
  substitutability: string | null;
  portability: string | null;
  insurance_coverage: string | null;
  cultural_alignment: string | null;
  political_legal_risk: string | null;
  financial_statements_uploaded: boolean;
  credit_report_uploaded: boolean;
  soc_report_uploaded: boolean;
  insurance_cert_uploaded: boolean;
  bcp_plan_uploaded: boolean;
  references_checked: boolean;
  sanctions_screened: boolean;
  adverse_media_checked: boolean;
  pii_assessment_completed: boolean;
  nda_signed: boolean;
  final_rating: string | null;
  conditions: string | null;
  rejection_reason: string | null;
  conducted_by: string | null;
  completion_date: string | null;
  next_due_date: string | null;
  notes: string | null;
  vendors: {
    legal_name: string;
    tier: string;
  };
}

const OSFI_FACTORS = [
  { key: 'experience_competence', label: 'Experience and Competence', description: 'Track record and expertise in delivering similar services' },
  { key: 'financial_strength', label: 'Financial Viability and Strength', description: 'Financial stability and ability to deliver services' },
  { key: 'regulatory_compliance', label: 'Regulatory Compliance History', description: 'History of regulatory compliance and violations' },
  { key: 'reputation_risk', label: 'Reputation Risk', description: 'Public perception and brand risk' },
  { key: 'risk_management_programs', label: 'Risk Management Programs', description: 'Quality and maturity of risk management framework' },
  { key: 'cyber_risk_management', label: 'Cyber Risk Management', description: 'Cybersecurity controls and incident response' },
  { key: 'info_security_programs', label: 'Information Security Programs', description: 'Data protection and security measures' },
  { key: 'bcp_capability', label: 'Business Continuity Planning', description: 'Disaster recovery and business continuity capabilities' },
  { key: 'subcontractor_management', label: 'Subcontractor Management', description: 'Fourth-party risk management practices' },
  { key: 'concentration_impact', label: 'Concentration Risk Impact', description: 'Dependency on single vendor or service' },
  { key: 'geographic_risk', label: 'Geographic and Geopolitical Risk', description: 'Location-based risks and jurisdictional issues' },
  { key: 'substitutability', label: 'Substitutability', description: 'Ease of replacing vendor or service' },
  { key: 'portability', label: 'Data and Service Portability', description: 'Ability to migrate data and services' },
  { key: 'insurance_coverage', label: 'Insurance Coverage', description: 'Adequacy of liability and cyber insurance' },
  { key: 'cultural_alignment', label: 'Cultural Alignment', description: 'Values and working style compatibility' },
  { key: 'political_legal_risk', label: 'Political and Legal Risk', description: 'Legal framework and political stability' },
];

const DOCUMENT_CHECKS = [
  { key: 'financial_statements_uploaded', label: 'Financial Statements' },
  { key: 'credit_report_uploaded', label: 'Credit Report' },
  { key: 'soc_report_uploaded', label: 'SOC 2 Report' },
  { key: 'insurance_cert_uploaded', label: 'Insurance Certificate' },
  { key: 'bcp_plan_uploaded', label: 'BCP/DR Plan' },
  { key: 'references_checked', label: 'References Checked' },
  { key: 'sanctions_screened', label: 'Sanctions Screening' },
  { key: 'adverse_media_checked', label: 'Adverse Media Check' },
  { key: 'pii_assessment_completed', label: 'PII Assessment' },
  { key: 'nda_signed', label: 'NDA Signed' },
];

export default function DueDiligenceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const [assessment, setAssessment] = useState<DueDiligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && currentOrganization) {
      fetchAssessment();
    }
  }, [id, currentOrganization]);

  async function fetchAssessment() {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('due_diligence')
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
        toast.error('Assessment not found');
        navigate('/due-diligence');
        return;
      }
      setAssessment(data);
    } catch (error) {
      logger.error('Error fetching assessment:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!assessment) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('due_diligence')
        .update({
          status: assessment.status,
          experience_competence: assessment.experience_competence,
          financial_strength: assessment.financial_strength,
          regulatory_compliance: assessment.regulatory_compliance,
          reputation_risk: assessment.reputation_risk,
          risk_management_programs: assessment.risk_management_programs,
          cyber_risk_management: assessment.cyber_risk_management,
          info_security_programs: assessment.info_security_programs,
          bcp_capability: assessment.bcp_capability,
          subcontractor_management: assessment.subcontractor_management,
          concentration_impact: assessment.concentration_impact,
          geographic_risk: assessment.geographic_risk,
          substitutability: assessment.substitutability,
          portability: assessment.portability,
          insurance_coverage: assessment.insurance_coverage,
          cultural_alignment: assessment.cultural_alignment,
          political_legal_risk: assessment.political_legal_risk,
          financial_statements_uploaded: assessment.financial_statements_uploaded,
          credit_report_uploaded: assessment.credit_report_uploaded,
          soc_report_uploaded: assessment.soc_report_uploaded,
          insurance_cert_uploaded: assessment.insurance_cert_uploaded,
          bcp_plan_uploaded: assessment.bcp_plan_uploaded,
          references_checked: assessment.references_checked,
          sanctions_screened: assessment.sanctions_screened,
          adverse_media_checked: assessment.adverse_media_checked,
          pii_assessment_completed: assessment.pii_assessment_completed,
          nda_signed: assessment.nda_signed,
          final_rating: assessment.final_rating,
          conditions: assessment.conditions,
          rejection_reason: assessment.rejection_reason,
          conducted_by: assessment.conducted_by,
          completion_date: assessment.completion_date,
          next_due_date: assessment.next_due_date,
          notes: assessment.notes,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Assessment saved successfully');
    } catch (error) {
      logger.error('Error saving assessment:', error);
      toast.error('Failed to save assessment');
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
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view this assessment</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading assessment...</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Assessment not found</p>
      </div>
    );
  }

  const completionPercentage = Math.round(
    (DOCUMENT_CHECKS.filter((check) => assessment[check.key as keyof DueDiligenceData]).length / DOCUMENT_CHECKS.length) * 100
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/due-diligence"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Due Diligence Assessment</h1>
            <p className="mt-1 text-sm text-gray-500">
              {assessment.vendors.legal_name} - {assessment.dd_type.replace('_', ' ')} Assessment
            </p>
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
              <h2 className="text-lg font-semibold text-gray-900">Assessment Status</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={assessment.status}
                  onChange={(e) => setAssessment({ ...assessment, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conducted By</label>
                <input
                  type="text"
                  value={assessment.conducted_by || ''}
                  onChange={(e) => setAssessment({ ...assessment, conducted_by: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completion Date</label>
                <input
                  type="date"
                  value={assessment.completion_date || ''}
                  onChange={(e) => setAssessment({ ...assessment, completion_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
                <input
                  type="date"
                  value={assessment.next_due_date || ''}
                  onChange={(e) => setAssessment({ ...assessment, next_due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">OSFI Annex 1 Factors</h2>
            <div className="space-y-6">
              {OSFI_FACTORS.map((factor) => (
                <div key={factor.key}>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {factor.label}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">{factor.description}</p>
                  <textarea
                    value={(assessment[factor.key as keyof DueDiligenceData] as string) || ''}
                    onChange={(e) => setAssessment({ ...assessment, [factor.key]: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter assessment notes..."
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Final Determination</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Rating</label>
                <select
                  value={assessment.final_rating || ''}
                  onChange={(e) => setAssessment({ ...assessment, final_rating: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Not Rated</option>
                  <option value="acceptable">Acceptable</option>
                  <option value="acceptable_with_conditions">Acceptable with Conditions</option>
                  <option value="unacceptable">Unacceptable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conditions (if applicable)</label>
                <textarea
                  value={assessment.conditions || ''}
                  onChange={(e) => setAssessment({ ...assessment, conditions: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="List any conditions for approval..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (if applicable)</label>
                <textarea
                  value={assessment.rejection_reason || ''}
                  onChange={(e) => setAssessment({ ...assessment, rejection_reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Explain reason for rejection..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={assessment.notes || ''}
                  onChange={(e) => setAssessment({ ...assessment, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional assessment notes..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Document Checklist</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Completion</span>
                <span className="text-sm font-semibold text-gray-900">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
            <div className="space-y-3">
              {DOCUMENT_CHECKS.map((check) => (
                <label key={check.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assessment[check.key as keyof DueDiligenceData] as boolean}
                    onChange={(e) => setAssessment({ ...assessment, [check.key]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{check.label}</span>
                  {assessment[check.key as keyof DueDiligenceData] && (
                    <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">OSFI B-10 Guidance</h3>
            <p className="text-xs text-blue-700">
              Due diligence should be commensurate with the risk tier and criticality of the arrangement.
              All 16 factors in Annex 1 should be considered and documented.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

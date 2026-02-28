import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Search,
  Plus,
  Globe,
  AlertTriangle,
  Link2,
  MoreVertical,
  Building,
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Download,
  RefreshCw,
  MapPin,
  Users,
  Clock,
  Flag,
  ChevronDown,
  ChevronRight,
  BarChart3,
  PieChart,
  Activity,
  Briefcase,
  Database,
  Network,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { logger } from '../lib/logger';

interface GlobalThirdParty {
  id: string;
  legal_name: string;
  trading_names: string[] | null;
  lei: string | null;
  headquarters_country: string;
  industry_codes: string[] | null;
  website: string | null;
  global_risk_score: number | null;
  verification_source: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LinkedFI {
  organization_id: string;
  organization_name: string;
  vendor_name: string;
  vendor_id: string;
  risk_tier: string;
}

interface ThirdPartyWithLinks extends GlobalThirdParty {
  fi_count: number;
  linked_fis: LinkedFI[];
  concentration_risk: 'low' | 'medium' | 'high';
}

interface PlatformStats {
  total_third_parties: number;
  verified_third_parties: number;
  pending_verification: number;
  high_concentration_risk: number;
}

export default function GlobalThirdParties() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<string>('all');
  const [thirdParties, setThirdParties] = useState<ThirdPartyWithLinks[]>([]);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'registry' | 'concentration' | 'analytics'>('registry');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({
    total_third_parties: 0,
    verified_third_parties: 0,
    pending_verification: 0,
    high_concentration_risk: 0,
  });

  const [formData, setFormData] = useState({
    legal_name: '',
    trading_name: '',
    lei: '',
    headquarters_country: '',
    website: '',
  });

  const fetchThirdParties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: globalParties, error: gpError } = await supabase
        .from('global_third_parties')
        .select(`
          id,
          legal_name,
          trading_names,
          lei,
          headquarters_country,
          industry_codes,
          website,
          global_risk_score,
          verification_source,
          verified_at,
          created_at,
          updated_at,
          vendor_global_links (
            vendor_id,
            organization_id,
            vendors:vendor_id (
              legal_name,
              tier
            ),
            organizations:organization_id (
              name
            )
          )
        `)
        .order('legal_name');

      if (gpError) throw gpError;

      const partiesWithLinks: ThirdPartyWithLinks[] = (globalParties || []).map((gp) => {
        const links = gp.vendor_global_links || [];
        const uniqueOrgs = new Set(
          links.map((l: { organization_id: string }) => l.organization_id)
        );
        const fiCount = uniqueOrgs.size;

        const linkedFis: LinkedFI[] = links.map(
          (l: {
            organization_id: string;
            vendor_id: string;
            vendors: { legal_name: string; tier: string } | null;
            organizations: { name: string } | null;
          }) => ({
            organization_id: l.organization_id,
            organization_name: l.organizations?.name || 'Unknown',
            vendor_name: l.vendors?.legal_name || 'Unknown',
            vendor_id: l.vendor_id,
            risk_tier: l.vendors?.tier || 'unknown',
          })
        );

        const concentrationRisk: 'low' | 'medium' | 'high' =
          fiCount >= 4 ? 'high' : fiCount >= 2 ? 'medium' : 'low';

        return {
          ...gp,
          fi_count: fiCount,
          linked_fis: linkedFis,
          concentration_risk: concentrationRisk,
        };
      });

      setThirdParties(partiesWithLinks);

      const verified = partiesWithLinks.filter((p) => p.verified_at).length;
      const highRisk = partiesWithLinks.filter((p) => p.concentration_risk === 'high').length;

      setStats({
        total_third_parties: partiesWithLinks.length,
        verified_third_parties: verified,
        pending_verification: partiesWithLinks.length - verified,
        high_concentration_risk: highRisk,
      });
    } catch (err) {
      logger.error('Error fetching global third parties:', err);
      setError('Failed to load global third parties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThirdParties();
  }, [fetchThirdParties]);

  const handleCreateThirdParty = async () => {
    if (!formData.legal_name || !formData.headquarters_country) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('global_third_parties').insert({
        legal_name: formData.legal_name,
        trading_names: formData.trading_name ? [formData.trading_name] : null,
        lei: formData.lei || null,
        headquarters_country: formData.headquarters_country,
        website: formData.website || null,
      });

      if (insertError) throw insertError;

      toast.success('Third party added successfully');
      setShowCreateModal(false);
      setFormData({
        legal_name: '',
        trading_name: '',
        lei: '',
        headquarters_country: '',
        website: '',
      });
      fetchThirdParties();
    } catch (err) {
      logger.error('Error creating third party:', err);
      toast.error('Failed to add third party');
    } finally {
      setSaving(false);
    }
  };

  const filteredThirdParties = thirdParties.filter((tp) => {
    const matchesSearch =
      tp.legal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tp.lei && tp.lei.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRisk = selectedRisk === 'all' || tp.concentration_risk === selectedRisk;
    const matchesVerification =
      selectedVerification === 'all' ||
      (selectedVerification === 'verified' && tp.verified_at) ||
      (selectedVerification === 'pending' && !tp.verified_at);
    return matchesSearch && matchesRisk && matchesVerification;
  });

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'tier_5_critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'tier_4_high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'tier_3_moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'tier_2_low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTier = (tier: string) => {
    const tierMap: Record<string, string> = {
      tier_5_critical: 'Critical',
      tier_4_high: 'High',
      tier_3_moderate: 'Moderate',
      tier_2_low: 'Low',
      tier_1_informational: 'Info',
    };
    return tierMap[tier] || tier;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Data</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchThirdParties}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            Global Third Party Registry
          </h1>
          <p className="text-gray-500 mt-1">
            Platform-wide view of all third parties across financial institutions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchThirdParties}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Third Party
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Database className="h-8 w-8 text-blue-500" />
            <span className="text-xs text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats.total_third_parties}</p>
          <p className="text-sm text-gray-500">Third Parties</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <span className="text-xs text-gray-500">Verified</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats.verified_third_parties}</p>
          <p className="text-sm text-gray-500">Verified Vendors</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Clock className="h-8 w-8 text-yellow-500" />
            <span className="text-xs text-gray-500">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats.pending_verification}</p>
          <p className="text-sm text-gray-500">Pending Verification</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <span className="text-xs text-gray-500">Risk</span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats.high_concentration_risk}</p>
          <p className="text-sm text-gray-500">High Concentration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('registry')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'registry'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Registry
            </div>
          </button>
          <button
            onClick={() => setActiveTab('concentration')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'concentration'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Concentration Risk
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </div>
          </button>
        </nav>
      </div>

      {/* Registry Tab */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, legal name, or LEI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Industries</option>
              <option value="Cloud Computing">Cloud Computing</option>
              <option value="Financial Technology">Financial Technology</option>
              <option value="Cybersecurity">Cybersecurity</option>
              <option value="Professional Services">Professional Services</option>
              <option value="Banking Software">Banking Software</option>
              <option value="Data Cloud">Data Cloud</option>
              <option value="Enterprise Software">Enterprise Software</option>
            </select>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Concentration</option>
              <option value="medium">Medium Concentration</option>
              <option value="low">Low Concentration</option>
            </select>
            <select
              value={selectedVerification}
              onChange={(e) => setSelectedVerification(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>

          {/* Third Parties Table */}
          <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Third Party</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">FIs Linked</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Concentration Risk</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredThirdParties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No third parties found</p>
                      <p className="text-sm text-gray-400 mt-1">Add your first global third party to get started</p>
                    </td>
                  </tr>
                ) : (
                  filteredThirdParties.map((tp) => (
                    <>
                      <tr
                        key={tp.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedVendor(expandedVendor === tp.id ? null : tp.id)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{tp.legal_name}</span>
                                {expandedVendor === tp.id ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <MapPin className="h-3 w-3" />
                                {tp.headquarters_country}
                                {tp.lei && (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <span className="font-mono text-xs">LEI: {tp.lei.slice(0, 10)}...</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{tp.fi_count}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRiskBadgeColor(tp.concentration_risk)}`}
                          >
                            {tp.concentration_risk.charAt(0).toUpperCase() + tp.concentration_risk.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {tp.verified_at ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1 text-gray-400 hover:text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-gray-600">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedVendor === tp.id && tp.linked_fis.length > 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 bg-gray-50">
                            <div className="ml-12">
                              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <Link2 className="h-4 w-4" />
                                Linked Financial Institutions ({tp.linked_fis.length})
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                {tp.linked_fis.map((fi, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                        <Building className="h-4 w-4 text-blue-600" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">{fi.organization_name}</p>
                                        <p className="text-xs text-gray-500">{fi.vendor_name}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span
                                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${getTierBadgeColor(fi.risk_tier)}`}
                                      >
                                        {formatTier(fi.risk_tier)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Concentration Risk Tab */}
      {activeTab === 'concentration' && (
        <div className="space-y-6">
          {/* High Concentration Alert */}
          {stats.high_concentration_risk > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900">High Concentration Risk Identified</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {stats.high_concentration_risk} third parties are linked to multiple FIs on the platform.
                    This represents potential systemic risk that should be monitored closely.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900">No High Concentration Risk</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Currently no third parties are identified with high concentration risk across multiple FIs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Concentration Matrix */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Network className="h-5 w-5 text-blue-600" />
              Third Party Concentration Overview
            </h3>
            {thirdParties.filter((tp) => tp.fi_count > 0).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p>No third party relationships established yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {thirdParties
                  .filter((tp) => tp.fi_count > 0)
                  .sort((a, b) => b.fi_count - a.fi_count)
                  .slice(0, 10)
                  .map((tp) => (
                    <div key={tp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tp.legal_name}</p>
                          <p className="text-sm text-gray-500">{tp.headquarters_country}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">FIs Linked</p>
                          <p className="text-lg font-semibold text-gray-900">{tp.fi_count}</p>
                        </div>
                        <span
                          className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getRiskBadgeColor(tp.concentration_risk)}`}
                        >
                          {tp.concentration_risk.charAt(0).toUpperCase() + tp.concentration_risk.slice(1)} Risk
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Concentration Risk Recommendations</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <Flag className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900">AWS Cloud Infrastructure</p>
                  <p className="text-sm text-yellow-700">80% FI coverage - Consider requiring FIs to maintain secondary cloud provider for critical workloads.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <Flag className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900">Palo Alto Networks Security</p>
                  <p className="text-sm text-yellow-700">70% FI coverage - High dependency on single security vendor increases systemic cyber risk.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Temenos Core Banking</p>
                  <p className="text-sm text-blue-700">50% FI coverage - Monitor operational incidents closely; single point of failure for core systems.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Industry Distribution */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-600" />
              Industry Distribution
            </h3>
            <div className="space-y-3">
              {industryBreakdown.map((industry, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{industry.name}</span>
                      <span className="text-sm text-gray-500">{industry.count} ({industry.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-blue-600 rounded-full h-2" 
                        style={{ width: `${industry.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Geographic Distribution */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              Geographic Distribution
            </h3>
            <div className="space-y-3">
              {[
                { country: 'United States', count: 98, percentage: 62.8 },
                { country: 'Canada', count: 24, percentage: 15.4 },
                { country: 'United Kingdom', count: 12, percentage: 7.7 },
                { country: 'Switzerland', count: 8, percentage: 5.1 },
                { country: 'Ireland', count: 6, percentage: 3.8 },
                { country: 'Other', count: 8, percentage: 5.2 },
              ].map((geo, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{geo.country}</span>
                      <span className="text-sm text-gray-500">{geo.count} ({geo.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-blue-600 rounded-full h-2" 
                        style={{ width: `${geo.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Indicator Summary */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Risk Indicator Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Financial Stability</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm">Low: 128</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm">Medium: 22</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm">High: 6</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Operational Resilience</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm">Low: 118</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm">Medium: 30</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm">High: 8</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Regulatory Compliance</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm">Low: 142</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm">Medium: 12</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm">High: 2</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Concentration Risk</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm">Low: 98</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm">Medium: 46</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm">High: 12</span>
                </div>
              </div>
            </div>
          </div>

          {/* Service Category Heatmap */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              Top Service Categories by FI Adoption
            </h3>
            <div className="space-y-3">
              {[
                { category: 'Cloud Infrastructure', fis: 9, vendors: 12 },
                { category: 'Cybersecurity', fis: 8, vendors: 22 },
                { category: 'Payment Processing', fis: 7, vendors: 8 },
                { category: 'Core Banking', fis: 6, vendors: 5 },
                { category: 'Data Analytics', fis: 6, vendors: 15 },
                { category: 'Enterprise Software', fis: 5, vendors: 18 },
              ].map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{cat.category}</p>
                    <p className="text-xs text-gray-500">{cat.vendors} vendors in category</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      cat.fis >= 8 ? 'bg-red-100 text-red-800' :
                      cat.fis >= 6 ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {cat.fis}/10 FIs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Add Global Third Party</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Acme Corporation Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name</label>
                <input
                  type="text"
                  value={formData.trading_name}
                  onChange={(e) => setFormData({ ...formData, trading_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LEI (Legal Entity Identifier)
                </label>
                <input
                  type="text"
                  value={formData.lei}
                  onChange={(e) => setFormData({ ...formData, lei: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="20-character LEI"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Headquarters Country <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.headquarters_country}
                  onChange={(e) => setFormData({ ...formData, headquarters_country: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select country</option>
                  <option value="Canada">Canada</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Switzerland">Switzerland</option>
                  <option value="Ireland">Ireland</option>
                  <option value="Germany">Germany</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateThirdParty}
                disabled={saving || !formData.legal_name || !formData.headquarters_country}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Third Party'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Vendor } from '../types';
import { getRiskMatrixPosition } from '../lib/riskCalculations';
import { Building2, Filter, X } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { logger } from '../lib/logger';
import { CardSkeleton } from '../components/LoadingSkeleton';

export default function RiskMatrix() {
  const { currentOrganization } = useOrganization();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState<string>('all');

  useEffect(() => {
    if (currentOrganization) {
      fetchVendors();
    }
  }, [currentOrganization]);

  const fetchVendors = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .not('impact_score', 'is', null)
        .not('likelihood_score', 'is', null);

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      logger.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVendorsInCell = (impactLevel: number, likelihoodLevel: number) => {
    return vendors.filter((vendor) => {
      if (filterTier !== 'all' && vendor.tier !== filterTier) return false;

      const position = getRiskMatrixPosition(
        vendor.impact_score || 0,
        vendor.likelihood_score || 0
      );
      return position.row === impactLevel && position.col === likelihoodLevel;
    });
  };

  const getCellColor = (impactLevel: number, likelihoodLevel: number) => {
    const riskScore = impactLevel * likelihoodLevel;

    if (riskScore >= 15) return 'bg-red-500';
    if (riskScore >= 10) return 'bg-orange-500';
    if (riskScore >= 5) return 'bg-amber-400';
    if (riskScore >= 2) return 'bg-emerald-400';
    return 'bg-slate-300';
  };

  const getCellTextColor = (impactLevel: number, likelihoodLevel: number) => {
    const riskScore = impactLevel * likelihoodLevel;
    return riskScore >= 5 ? 'text-white' : 'text-slate-900';
  };

  const impactLevels = [5, 4, 3, 2, 1];
  const likelihoodLevels = [1, 2, 3, 4, 5];

  const impactLabels = ['Very High', 'High', 'Medium', 'Low', 'Very Low'];
  const likelihoodLabels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

  const filteredVendors = filterTier === 'all'
    ? vendors
    : vendors.filter(v => v.tier === filterTier);

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view the risk matrix</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-44 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
        </div>
        <CardSkeleton count={2} />
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-[400px] bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Risk Matrix</h1>
        <p className="text-slate-600 mt-1">Impact vs Likelihood Assessment</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Filter by Tier:</span>
          </div>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="all">All Tiers</option>
            <option value="tier_5_critical">Tier 5 - Critical</option>
            <option value="tier_4_high">Tier 4 - High</option>
            <option value="tier_3_moderate">Tier 3 - Moderate</option>
            <option value="tier_2_low">Tier 2 - Low</option>
            <option value="tier_1_informational">Tier 1 - Informational</option>
          </select>
        </div>

        <div className="text-sm text-slate-600">
          Showing {filteredVendors.length} of {vendors.length} assessed vendors
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start">
          <div className="flex flex-col items-center mr-4">
            <div className="h-full flex items-center">
              <div className="transform -rotate-90 whitespace-nowrap font-semibold text-slate-900 text-lg">
                Impact
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-5 gap-2 mb-2">
              {impactLevels.map((impactLevel, idx) => (
                <div key={impactLevel} className="text-center">
                  <div className="text-xs font-medium text-slate-600 mb-1">
                    {impactLabels[idx]}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {impactLevels.map((impactLevel) => (
                <div key={impactLevel} className="grid grid-cols-5 gap-2">
                  {likelihoodLevels.map((likelihoodLevel) => {
                    const cellVendors = getVendorsInCell(impactLevel, likelihoodLevel);
                    const cellColor = getCellColor(impactLevel, likelihoodLevel);
                    const textColor = getCellTextColor(impactLevel, likelihoodLevel);

                    return (
                      <div
                        key={`${impactLevel}-${likelihoodLevel}`}
                        className={`${cellColor} ${textColor} p-4 rounded-lg min-h-[120px] relative group cursor-pointer transition-all hover:ring-2 hover:ring-slate-900`}
                        onClick={() => cellVendors.length > 0 && setSelectedVendor(cellVendors[0])}
                      >
                        <div className="text-xs font-semibold mb-2">
                          {impactLevel} × {likelihoodLevel} = {impactLevel * likelihoodLevel}
                        </div>

                        {cellVendors.length > 0 && (
                          <div className="space-y-1">
                            {cellVendors.slice(0, 3).map((vendor) => (
                              <div
                                key={vendor.id}
                                className="text-xs truncate bg-white bg-opacity-90 px-2 py-1 rounded"
                              >
                                {vendor.legal_name}
                              </div>
                            ))}
                            {cellVendors.length > 3 && (
                              <div className="text-xs bg-white bg-opacity-90 px-2 py-1 rounded">
                                +{cellVendors.length - 3} more
                              </div>
                            )}
                          </div>
                        )}

                        {cellVendors.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs opacity-50">
                            0
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2 mt-2">
              {likelihoodLevels.map((level, idx) => (
                <div key={level} className="text-center">
                  <div className="text-xs font-medium text-slate-600 mt-1">
                    {likelihoodLabels[idx]}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-4">
              <div className="font-semibold text-slate-900 text-lg">Likelihood</div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-slate-700">Critical (15+)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm text-slate-700">High (10-14)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-amber-400 rounded"></div>
              <span className="text-sm text-slate-700">Moderate (5-9)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-emerald-400 rounded"></div>
              <span className="text-sm text-slate-700">Low (2-4)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-slate-300 rounded"></div>
              <span className="text-sm text-slate-700">Minimal (1)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Risk Distribution Summary</h2>
          <div className="space-y-3">
            {[
              { label: 'Critical Risk (15+)', color: 'bg-red-500', count: vendors.filter(v => v.risk_rating && v.risk_rating >= 15).length },
              { label: 'High Risk (10-14)', color: 'bg-orange-500', count: vendors.filter(v => v.risk_rating && v.risk_rating >= 10 && v.risk_rating < 15).length },
              { label: 'Moderate Risk (5-9)', color: 'bg-amber-400', count: vendors.filter(v => v.risk_rating && v.risk_rating >= 5 && v.risk_rating < 10).length },
              { label: 'Low Risk (2-4)', color: 'bg-emerald-400', count: vendors.filter(v => v.risk_rating && v.risk_rating >= 2 && v.risk_rating < 5).length },
              { label: 'Minimal Risk (1)', color: 'bg-slate-300', count: vendors.filter(v => v.risk_rating && v.risk_rating < 2).length },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 ${item.color} rounded`}></div>
                  <span className="text-sm text-slate-700">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Matrix Statistics</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Total Assessed Vendors</span>
              <span className="text-lg font-semibold text-slate-900">{vendors.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Average Impact Score</span>
              <span className="text-lg font-semibold text-slate-900">
                {vendors.length > 0
                  ? (vendors.reduce((sum, v) => sum + (v.impact_score || 0), 0) / vendors.length).toFixed(2)
                  : '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Average Likelihood Score</span>
              <span className="text-lg font-semibold text-slate-900">
                {vendors.length > 0
                  ? (vendors.reduce((sum, v) => sum + (v.likelihood_score || 0), 0) / vendors.length).toFixed(2)
                  : '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Average Risk Rating</span>
              <span className="text-lg font-semibold text-slate-900">
                {vendors.length > 0
                  ? (vendors.reduce((sum, v) => sum + (v.risk_rating || 0), 0) / vendors.length).toFixed(2)
                  : '0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedVendor.legal_name}</h3>
                <p className="text-sm text-slate-600 mt-1">{selectedVendor.service_category}</p>
              </div>
              <button
                onClick={() => setSelectedVendor(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-slate-600">Impact Score</p>
                <p className="text-2xl font-bold text-slate-900">{selectedVendor.impact_score?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Likelihood Score</p>
                <p className="text-2xl font-bold text-slate-900">{selectedVendor.likelihood_score?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Risk Rating</p>
                <p className="text-2xl font-bold text-red-600">{selectedVendor.risk_rating?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Tier</p>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedVendor.tier?.replace('tier_', 'Tier ').replace('_', ' - ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <Link
                to={`/vendors/${selectedVendor.id}`}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-center"
                onClick={() => setSelectedVendor(null)}
              >
                View Details
              </Link>
              <button
                onClick={() => setSelectedVendor(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {vendors.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-slate-600 mb-4">No assessed vendors to display</p>
          <Link
            to="/vendors"
            className="inline-block px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            View All Vendors
          </Link>
        </div>
      )}
    </div>
  );
}

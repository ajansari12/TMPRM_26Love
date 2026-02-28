import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import DueDiligenceDocuments from '../components/DueDiligenceDocuments';
import {
  Plus,
  Search,
  Filter,
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  Calendar,
  FileText,
  Upload,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { exportToCSV } from '../lib/exportUtils';
import { logger } from '../lib/logger';

interface DueDiligence {
  id: string;
  vendor_id: string;
  dd_type: string;
  status: string;
  final_rating: string | null;
  completion_date: string | null;
  next_due_date: string | null;
  conducted_by: string | null;
  created_at: string;
  vendors: {
    legal_name: string;
    tier: string;
  };
}

export default function DueDiligence() {
  const { currentOrganization } = useOrganization();
  const [assessments, setAssessments] = useState<DueDiligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'documents' | 'assessments'>('documents');

  useEffect(() => {
    if (currentOrganization) {
      fetchAssessments();
    }
  }, [currentOrganization]);

  async function fetchAssessments() {
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
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssessments(data || []);
    } catch (error) {
      logger.error('Error fetching due diligence:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAssessments = assessments.filter(assessment => {
    const matchesSearch = assessment.vendors.legal_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || assessment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    if (filteredAssessments.length === 0) {
      toast.error('No data to export. Try adjusting your filters.');
      return;
    }

    const exportData = filteredAssessments.map(assessment => ({
      vendor_name: assessment.vendors?.legal_name || 'N/A',
      dd_type: assessment.dd_type || 'N/A',
      status: assessment.status || 'N/A',
      final_rating: assessment.final_rating || 'N/A',
      conducted_by: assessment.conducted_by || 'N/A',
      start_date: assessment.created_at ? format(new Date(assessment.created_at), 'MMM dd, yyyy') : 'N/A',
      completion_date: assessment.completion_date ? format(new Date(assessment.completion_date), 'MMM dd, yyyy') : 'N/A',
      next_due_date: assessment.next_due_date ? format(new Date(assessment.next_due_date), 'MMM dd, yyyy') : 'N/A',
    }));

    const result = exportToCSV(
      exportData,
      'due_diligence',
      [
        { key: 'vendor_name', label: 'Vendor Name' },
        { key: 'dd_type', label: 'Due Diligence Type' },
        { key: 'status', label: 'Status' },
        { key: 'final_rating', label: 'Final Rating' },
        { key: 'conducted_by', label: 'Conducted By' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'completion_date', label: 'Completion Date' },
        { key: 'next_due_date', label: 'Next Due Date' },
      ]
    );

    if (result.success) {
      toast.success(`Exported ${filteredAssessments.length} due diligence records to CSV`);
    } else {
      toast.error(result.error || 'Failed to export data');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'not_started':
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      not_started: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getRatingBadge = (rating: string | null) => {
    if (!rating) return null;
    const styles = {
      acceptable: 'bg-green-100 text-green-800',
      acceptable_with_conditions: 'bg-yellow-100 text-yellow-800',
      unacceptable: 'bg-red-100 text-red-800',
    };
    return styles[rating as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const stats = {
    total: assessments.length,
    completed: assessments.filter(a => a.status === 'completed').length,
    inProgress: assessments.filter(a => a.status === 'in_progress').length,
    overdue: assessments.filter(a => a.next_due_date && new Date(a.next_due_date) < new Date()).length,
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view due diligence assessments</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading due diligence assessments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Due Diligence</h1>
          <p className="mt-1 text-sm text-slate-500">
            OSFI B-10 Section 2.2.2 - Due diligence proportionate to risk level
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {activeTab === 'assessments' && (
            <>
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Assessment
              </button>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Document Collection
            </div>
          </button>
          <button
            onClick={() => setActiveTab('assessments')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'assessments'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Standalone Assessments
            </div>
          </button>
        </nav>
      </div>

      {activeTab === 'documents' ? (
        <DueDiligenceDocuments />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assessments</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <FileCheck className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-semibold text-green-600 mt-1">{stats.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-semibold text-blue-600 mt-1">{stats.inProgress}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-semibold text-red-600 mt-1">{stats.overdue}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by vendor name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssessments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500 mb-1">No due diligence assessments found</p>
                    <p className="text-sm text-gray-400">Due diligence tracking begins automatically when vendors are onboarded and tiered.</p>
                  </td>
                </tr>
              ) : (
                filteredAssessments.map((assessment) => (
                  <tr key={assessment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {assessment.vendors.legal_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {assessment.vendors.tier?.replace('tier_', 'Tier ').replace('_', ' - ') || 'Not Assessed'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">
                        {assessment.dd_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(assessment.status)}
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(assessment.status)}`}>
                          {assessment.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assessment.final_rating ? (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRatingBadge(assessment.final_rating)}`}>
                          {assessment.final_rating.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assessment.completion_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(assessment.completion_date), 'MMM d, yyyy')}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assessment.next_due_date ? (
                        <div className={`flex items-center gap-2 ${new Date(assessment.next_due_date) < new Date() ? 'text-red-600 font-medium' : ''}`}>
                          <Calendar className="w-4 h-4" />
                          {format(new Date(assessment.next_due_date), 'MMM d, yyyy')}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/due-diligence/${assessment.id}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewAssessmentModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            setShowNewModal(false);
            fetchAssessments();
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

function NewAssessmentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { currentOrganization } = useOrganization();
  const [vendors, setVendors] = useState<Array<{ id: string; legal_name: string }>>([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [ddType, setDdType] = useState('initial');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      fetchVendors();
    }
  }, [currentOrganization]);

  async function fetchVendors() {
    if (!currentOrganization) return;
    const { data } = await supabase
      .from('vendors')
      .select('id, legal_name')
      .eq('organization_id', currentOrganization.id)
      .order('legal_name');
    setVendors(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVendor || !currentOrganization) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('due_diligence')
        .insert({
          vendor_id: selectedVendor,
          dd_type: ddType,
          status: 'not_started',
          organization_id: currentOrganization.id,
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      logger.error('Error creating assessment:', error);
      toast.error('Failed to create assessment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">New Due Diligence Assessment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor *
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select a vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.legal_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assessment Type *
            </label>
            <select
              value={ddType}
              onChange={(e) => setDdType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="initial">Initial</option>
              <option value="ongoing">Ongoing</option>
              <option value="enhanced">Enhanced</option>
              <option value="periodic_review">Periodic Review</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

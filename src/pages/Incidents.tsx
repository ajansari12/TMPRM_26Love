import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Building2,
  Calendar,
  Download
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { exportToCSV } from '../lib/exportUtils';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';
import ErrorState from '../components/ErrorState';
import { logger } from '../lib/logger';

interface Incident {
  id: string;
  incident_id: string;
  vendor_id: string;
  title: string;
  description: string;
  incident_type: string | null;
  severity: string | null;
  status: string;
  detected_date: string | null;
  reported_date: string;
  resolved_date: string | null;
  osfi_notifiable: boolean;
  osfi_notified: boolean;
  reporter: string | null;
  vendors: {
    legal_name: string;
    tier: string;
  };
}

export default function Incidents() {
  const { currentOrganization } = useOrganization();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (currentOrganization) {
      fetchIncidents();
    }
  }, [currentOrganization]);

  async function fetchIncidents() {
    if (!currentOrganization) return;
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('incidents')
        .select(`
          *,
          vendors (
            legal_name,
            tier
          )
        `)
        .order('reported_date', { ascending: false });

      if (fetchError) throw fetchError;
      setIncidents(data || []);
    } catch (err) {
      logger.error('Error fetching incidents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, severityFilter]);

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch =
      incident.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      incident.incident_id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      incident.vendors.legal_name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const totalPages = Math.ceil(filteredIncidents.length / pageSize);
  const paginatedIncidents = filteredIncidents.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleExport = () => {
    if (filteredIncidents.length === 0) {
      toast.error('No data to export. Try adjusting your filters.');
      return;
    }

    const exportData = filteredIncidents.map(incident => ({
      incident_id: incident.incident_id || 'N/A',
      vendor_name: incident.vendors?.legal_name || 'N/A',
      title: incident.title || 'N/A',
      incident_type: incident.incident_type || 'N/A',
      severity: incident.severity || 'N/A',
      status: incident.status || 'N/A',
      detected_date: incident.detected_date ? format(new Date(incident.detected_date), 'MMM dd, yyyy') : 'N/A',
      reported_date: incident.reported_date ? format(new Date(incident.reported_date), 'MMM dd, yyyy') : 'N/A',
      resolved_date: incident.resolved_date ? format(new Date(incident.resolved_date), 'MMM dd, yyyy') : 'N/A',
      osfi_notifiable: incident.osfi_notifiable ? 'Yes' : 'No',
      reporter: incident.reporter || 'N/A',
    }));

    const result = exportToCSV(
      exportData,
      'incidents',
      [
        { key: 'incident_id', label: 'Incident ID' },
        { key: 'vendor_name', label: 'Vendor Name' },
        { key: 'title', label: 'Title' },
        { key: 'incident_type', label: 'Incident Type' },
        { key: 'severity', label: 'Severity' },
        { key: 'status', label: 'Status' },
        { key: 'detected_date', label: 'Detected Date' },
        { key: 'reported_date', label: 'Reported Date' },
        { key: 'resolved_date', label: 'Resolved Date' },
        { key: 'osfi_notifiable', label: 'OSFI Notifiable' },
        { key: 'reporter', label: 'Reporter' },
      ]
    );

    if (result.success) {
      toast.success(`Exported ${filteredIncidents.length} incidents to CSV`);
    } else {
      toast.error(result.error || 'Failed to export data');
    }
  };

  const getSeverityBadge = (severity: string | null) => {
    if (!severity) return 'bg-gray-100 text-gray-800';
    const styles = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return styles[severity as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      reported: 'bg-yellow-100 text-yellow-800',
      investigating: 'bg-blue-100 text-blue-800',
      contained: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length,
    critical: incidents.filter(i => i.severity === 'critical' && !['resolved', 'closed'].includes(i.status)).length,
    osfiNotifiable: incidents.filter(i => i.osfi_notifiable && !i.osfi_notified).length,
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view incidents</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={4} />
        <TableSkeleton rows={5} columns={8} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={fetchIncidents}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incident Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track vendor incidents and OSFI notification requirements
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Report Incident
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Incidents</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Incidents</p>
              <p className="text-2xl font-semibold text-orange-600 mt-1">{stats.open}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Open</p>
              <p className="text-2xl font-semibold text-red-600 mt-1">{stats.critical}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">OSFI Pending</p>
              <p className="text-2xl font-semibold text-purple-600 mt-1">{stats.osfiNotifiable}</p>
            </div>
            <Shield className="w-8 h-8 text-purple-600" />
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
                placeholder="Search incidents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="reported">Reported</option>
                <option value="investigating">Investigating</option>
                <option value="contained">Contained</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Incidents list">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Incident ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reported
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OSFI
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12">
                    <EmptyState
                      icon={AlertTriangle}
                      title="No incidents found"
                      description="No incidents match your current filters. Try adjusting your search criteria."
                      action={
                        <button
                          onClick={() => setShowNewModal(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Report Incident
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedIncidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{incident.incident_id}</div>
                      <div className="text-xs text-gray-500">{incident.incident_type || 'Not classified'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-900">{incident.vendors.legal_name}</div>
                          <div className="text-xs text-gray-500">{incident.vendors.tier?.replace('tier_', 'Tier ').replace('_', ' - ') || 'Not Assessed'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">{incident.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityBadge(incident.severity)}`}>
                        {incident.severity || 'Unrated'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(incident.status)}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(incident.reported_date), 'MMM d')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(incident.reported_date), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {incident.osfi_notifiable ? (
                        <div className="flex items-center gap-1">
                          {incident.osfi_notified ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-xs text-green-600">Notified</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                              <span className="text-xs text-orange-600">Pending</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/incidents/${incident.id}`}
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

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredIncidents.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {showNewModal && (
        <NewIncidentModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            setShowNewModal(false);
            fetchIncidents();
          }}
        />
      )}
    </div>
  );
}

function NewIncidentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { currentOrganization } = useOrganization();
  const [vendors, setVendors] = useState<Array<{ id: string; legal_name: string }>>([]);
  const [formData, setFormData] = useState({
    vendor_id: '',
    title: '',
    description: '',
    incident_type: '',
    severity: '',
  });
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
    if (!formData.vendor_id || !formData.title || !formData.description || !currentOrganization) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('incidents')
        .insert({
          vendor_id: formData.vendor_id,
          title: formData.title,
          description: formData.description,
          incident_type: formData.incident_type || null,
          severity: formData.severity || null,
          status: 'reported',
          reported_date: new Date().toISOString(),
          organization_id: currentOrganization.id,
        });

      if (error) throw error;

      if (['critical', 'high'].includes(formData.severity)) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('id, legal_name, tier, organization_id')
          .eq('id', formData.vendor_id)
          .single();

        if (vendorData && ['tier_5_critical', 'tier_4_high'].includes(vendorData.tier || '')) {
          const { data: existingTask } = await supabase
            .from('assessment_tasks')
            .select('id')
            .eq('vendor_id', formData.vendor_id)
            .eq('task_type', 'incident_triggered')
            .in('status', ['pending', 'in_progress'])
            .maybeSingle();

          if (!existingTask) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (formData.severity === 'critical' ? 7 : 14));

            await supabase.from('assessment_tasks').insert({
              organization_id: currentOrganization.id,
              vendor_id: formData.vendor_id,
              task_type: 'incident_triggered',
              status: 'pending',
              priority: formData.severity === 'critical' ? 'urgent' : 'high',
              assigned_defense_line: '2nd',
              due_date: dueDate.toISOString().split('T')[0],
              notes: `Incident-triggered reassessment required. Incident: "${formData.title}" (Severity: ${formData.severity}). Vendor: ${vendorData.legal_name}.`,
            });

            await supabase.from('notifications').insert({
              organization_id: currentOrganization.id,
              type: 'incident_triggered_reassessment',
              title: `Reassessment triggered for ${vendorData.legal_name}`,
              message: `A ${formData.severity} severity incident has triggered an automatic reassessment for this ${vendorData.tier?.replace('_', ' ')} vendor.`,
              action_url: '/assessments/reassessments',
              priority: formData.severity === 'critical' ? 'critical' : 'high',
              related_entity_type: 'vendor',
              related_entity_id: formData.vendor_id,
              target_role: '2nd',
            });

            toast.info('Reassessment task auto-created', {
              description: `A ${formData.severity} incident on a ${vendorData.tier?.includes('5') ? 'Tier 5' : 'Tier 4'} vendor has triggered an automatic reassessment task.`,
            });
          }
        }
      }

      onSuccess();
    } catch (error) {
      logger.error('Error creating incident:', error);
      toast.error('Failed to report incident');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Report New Incident</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor *
            </label>
            <select
              value={formData.vendor_id}
              onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
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
              Incident Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Incident Type
              </label>
              <select
                value={formData.incident_type}
                onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select type</option>
                <option value="Security Breach">Security Breach</option>
                <option value="Data Loss">Data Loss</option>
                <option value="Service Outage">Service Outage</option>
                <option value="Performance Issue">Performance Issue</option>
                <option value="Compliance Violation">Compliance Violation</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
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
              {loading ? 'Reporting...' : 'Report Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

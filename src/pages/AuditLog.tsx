import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { Search, Filter, Shield, User, Calendar, Building2, Eye, FlaskConical, FileSearch, X } from 'lucide-react';
import { format } from 'date-fns';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';
import ErrorState from '../components/ErrorState';
import { logger } from '../lib/logger';

interface AuditLog {
  id: string;
  timestamp: string;
  user_email: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_name: string | null;
  ip_address: string | null;
  notes: string | null;
  is_test_mode: boolean;
  impersonation_session_id: string | null;
}

export default function AuditLog() {
  const { currentOrganization } = useOrganization();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [showTestMode, setShowTestMode] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (currentOrganization) {
      fetchLogs();
    }
  }, [currentOrganization]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, entityFilter, showTestMode]);

  async function fetchLogs() {
    if (!currentOrganization) return;
    setError(null);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load audit logs');
      logger.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      (log.user_email || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (log.user_name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (log.entity_name || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    const matchesTestMode = showTestMode || !log.is_test_mode;
    return matchesSearch && matchesAction && matchesEntity && matchesTestMode;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  const testModeCount = logs.filter(log => log.is_test_mode).length;
  const productionCount = logs.filter(log => !log.is_test_mode).length;

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      'CREATE': 'bg-green-100 text-green-800',
      'UPDATE': 'bg-blue-100 text-blue-800',
      'DELETE': 'bg-red-100 text-red-800',
      'LOGIN': 'bg-purple-100 text-purple-800',
      'LOGOUT': 'bg-gray-100 text-gray-800',
      'EXPORT': 'bg-yellow-100 text-yellow-800',
    };
    return styles[action] || 'bg-gray-100 text-gray-800';
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action).filter(Boolean)));
  const uniqueEntities = Array.from(new Set(logs.map(log => log.entity_type).filter(Boolean)));

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No organization selected</p>
          <p className="text-sm text-gray-400 mt-1">Please select an organization to view audit logs</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track all system activities and user actions
          </p>
        </div>
        <CardSkeleton count={4} />
        <div className="bg-white rounded-lg shadow p-6">
          <TableSkeleton rows={5} cols={7} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track all system activities and user actions
          </p>
        </div>
        <ErrorState message={error} onRetry={fetchLogs} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track all system activities and user actions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{logs.length}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Production Actions</p>
              <p className="text-2xl font-semibold text-green-600 mt-1">{productionCount}</p>
            </div>
            <User className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Test Mode Actions</p>
              <p className="text-2xl font-semibold text-teal-600 mt-1">{testModeCount}</p>
            </div>
            <FlaskConical className="w-8 h-8 text-teal-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Activities</p>
              <p className="text-2xl font-semibold text-blue-600 mt-1">
                {logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No audit logs yet"
          description="System activities and user actions will appear here once they are recorded."
        />
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search audit logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                <select
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Entities</option>
                  {uniqueEntities.map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  title="From date"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  title="To date"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Clear date range"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showTestMode}
                    onChange={(e) => setShowTestMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                </div>
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-medium text-gray-700">Show test mode entries</span>
                  {testModeCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded-full">
                      {testModeCount}
                    </span>
                  )}
                </div>
              </label>
              <p className="text-xs text-gray-500">
                Test mode entries are created during role impersonation testing
              </p>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="No logs match your filters"
              description="Try adjusting your search terms or filters to find what you are looking for."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Audit log entries">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entity
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mode
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedLogs.map((log) => (
                      <tr key={log.id} className={`hover:bg-gray-50 ${log.is_test_mode ? 'bg-teal-50/30' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900">
                                {format(new Date(log.timestamp), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(log.timestamp), 'HH:mm:ss')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900">{log.user_name || 'Unknown'}</div>
                              <div className="text-xs text-gray-500">{log.user_email || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getActionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm text-gray-900">{log.entity_type || '-'}</div>
                            {log.entity_name && (
                              <div className="text-xs text-gray-500">{log.entity_name}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.is_test_mode ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full">
                              <FlaskConical className="w-3 h-3" />
                              Test
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                              Production
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {log.notes || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ip_address || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredLogs.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Audit Log Information</h3>
        <p className="text-xs text-blue-700">
          All user actions are logged for security and compliance purposes. Audit logs are immutable and retained according to regulatory requirements.
        </p>
      </div>
    </div>
  );
}

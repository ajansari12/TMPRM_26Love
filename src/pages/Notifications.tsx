import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useDebounce } from '../hooks/useDebounce';
import { formatDistanceToNow, format } from 'date-fns';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import ErrorState from '../components/ErrorState';
import {
  Bell,
  CheckCheck,
  Check,
  X,
  Search,
  AlertTriangle,
  FileText,
  Building2,
  Activity,
  Shield,
  Clock,
  GitPullRequest,
  UserPlus,
  AlertCircle,
  AlertOctagon,
  LogOut,
  XCircle,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

const PRIORITY_CONFIG = {
  critical: { color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-300' },
  high: { color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-300' },
  medium: { color: 'amber', bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-300' },
  low: { color: 'gray', bgColor: 'bg-gray-100', textColor: 'text-gray-700', borderColor: 'border-gray-300' },
};

const TYPE_ICONS: Record<string, any> = {
  incident_triggered_reassessment: AlertTriangle,
  contract_expiry_warning: Clock,
  kri_breach: AlertOctagon,
  offboarding_initiated: LogOut,
  vendor_terminated: XCircle,
  contract: FileText,
  vendor: Building2,
  kri: Activity,
  incident: AlertTriangle,
  assessment: Shield,
  onboarding: GitPullRequest,
  assigned: UserPlus,
  sla: AlertCircle,
  default: Bell,
};

function getNotificationIcon(type: string) {
  if (TYPE_ICONS[type]) {
    return TYPE_ICONS[type];
  }
  const prefix = type.split('_')[0];
  return TYPE_ICONS[prefix] || TYPE_ICONS.default;
}

export default function Notifications() {
  const { user } = useAuth();
  const { currentOrganization, currentMembership, notificationCounts } = useOrganization();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'read'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (user && currentOrganization) {
      fetchNotifications();
    }
  }, [user, currentOrganization, currentMembership]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterTab]);

  async function fetchNotifications() {
    if (!user || !currentOrganization) return;

    try {
      setLoading(true);
      setError(null);
      const allNotifications: Notification[] = [];

      try {
        const query = supabase
          .from('notifications')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false })
          .limit(100);

        const { data } = await query;
        if (data) {
          allNotifications.push(...data);
        }
      } catch (notifError) {
        logger.error('Error fetching notifications table:', notifError);
      }

      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: auditData } = await supabase
          .from('onboarding_audit_log')
          .select('*, request:onboarding_requests(vendor_legal_name)')
          .eq('organization_id', currentOrganization.id)
          .gte('performed_at', sevenDaysAgo.toISOString())
          .order('performed_at', { ascending: false })
          .limit(50);

        if (auditData) {
          const auditNotifications: Notification[] = auditData.map((entry) => {
            let type = 'onboarding_activity';
            let priority: Notification['priority'] = 'low';

            if (entry.action_type === 'submitted') {
              type = 'onboarding_submitted';
              priority = 'medium';
            } else if (
              entry.action_type?.includes('review') &&
              entry.new_defense_line === currentMembership?.defense_line
            ) {
              type = 'assigned_review';
              priority = 'high';
            } else if (entry.action_type === 'vendor_created') {
              type = 'vendor_created';
              priority = 'medium';
            }

            const vendorName =
              (entry.request as { vendor_legal_name?: string })?.vendor_legal_name ||
              'Unknown Vendor';

            return {
              id: `audit_${entry.id}`,
              type,
              title: getAuditTitle(entry.action_type, vendorName),
              message: entry.action_description || '',
              priority,
              related_entity_type: 'onboarding_request',
              related_entity_id: entry.request_id,
              action_url: `/onboarding/${entry.request_id}`,
              is_read:
                entry.performed_by === user?.id ||
                new Date(entry.performed_at) < new Date(Date.now() - 24 * 60 * 60 * 1000),
              created_at: entry.performed_at,
            };
          });

          allNotifications.push(...auditNotifications);
        }
      } catch (auditError) {
        logger.error('Error fetching onboarding audit log:', auditError);
      }

      allNotifications.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getAuditTitle(actionType: string, vendorName: string): string {
    switch (actionType) {
      case 'submitted':
        return `New request submitted: ${vendorName}`;
      case 'review_confirm':
        return `Request confirmed: ${vendorName}`;
      case 'review_accept':
        return `Request approved: ${vendorName}`;
      case 'review_reject':
        return `Request rejected: ${vendorName}`;
      case 'review_return':
        return `Request returned: ${vendorName}`;
      case 'vendor_created':
        return `Vendor created: ${vendorName}`;
      default:
        return `Activity on: ${vendorName}`;
    }
  }

  async function toggleRead(notificationId: string, currentReadStatus: boolean) {
    try {
      const newReadStatus = !currentReadStatus;
      const updateData: { is_read: boolean; read_at?: string } = {
        is_read: newReadStatus,
      };

      if (newReadStatus) {
        updateData.read_at = new Date().toISOString();
      }

      if (!notificationId.startsWith('audit_') && notificationId !== 'sla_warning') {
        await supabase
          .from('notifications')
          .update(updateData)
          .eq('id', notificationId);
      }

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, is_read: newReadStatus, read_at: updateData.read_at }
            : n
        )
      );
    } catch (error) {
      logger.error('Error toggling notification read status:', error);
    }
  }

  async function markAllAsRead() {
    try {
      const unreadNotifications = notifications.filter((n) => !n.is_read);
      const unreadIds = unreadNotifications
        .filter((n) => !n.id.startsWith('audit_') && n.id !== 'sla_warning')
        .map((n) => n.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', unreadIds);
      }

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch (error) {
      logger.error('Error marking all as read:', error);
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (notification.action_url) {
      if (!notification.is_read) {
        toggleRead(notification.id, false);
      }
      navigate(notification.action_url);
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === 'unread' && n.is_read) return false;
    if (filterTab === 'read' && !n.is_read) return false;

    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      return (
        n.title.toLowerCase().includes(search) ||
        n.message.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const paginatedNotifications = filteredNotifications.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const readTodayCount = notifications.filter(
    (n) => n.is_read && n.read_at && new Date(n.read_at).toDateString() === new Date().toDateString()
  ).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and track all your system notifications
          </p>
        </div>
        <CardSkeleton count={3} />
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and track all your system notifications
          </p>
        </div>
        <ErrorState message={error} onRetry={fetchNotifications} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage and track all your system notifications
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Notifications</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {notifications.length}
              </p>
            </div>
            <Bell className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Unread</p>
              <p className="text-2xl font-semibold text-orange-600 mt-1">{unreadCount}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Read Today</p>
              <p className="text-2xl font-semibold text-green-600 mt-1">{readTodayCount}</p>
            </div>
            <CheckCheck className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <CheckCheck className="w-5 h-5" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterTab === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab('unread')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterTab === 'unread'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
            <button
              onClick={() => setFilterTab('read')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterTab === 'read'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Read
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={debouncedSearch ? 'No matching notifications' : "You're all caught up!"}
              description={
                debouncedSearch
                  ? 'No notifications match your search'
                  : 'No notifications to display right now.'
              }
            />
          ) : (
            paginatedNotifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const config = PRIORITY_CONFIG[notification.priority];

              return (
                <div
                  key={notification.id}
                  className={`p-4 transition-colors ${
                    !notification.is_read ? 'bg-blue-50/30' : ''
                  } ${notification.action_url ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                  onClick={() =>
                    notification.action_url && handleNotificationClick(notification)
                  }
                >
                  <div className="flex gap-4">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}
                    >
                      <Icon className={`w-5 h-5 ${config.textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-semibold ${
                              notification.is_read ? 'text-slate-700' : 'text-slate-900'
                            }`}
                          >
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-sm text-slate-600 mt-1">
                              {notification.message}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${config.bgColor} ${config.textColor}`}
                            >
                              {notification.priority}
                            </span>
                            {notification.is_read && notification.read_at && (
                              <span className="text-xs text-slate-400">
                                Read {format(new Date(notification.read_at), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRead(notification.id, notification.is_read);
                          }}
                          className="flex-shrink-0 p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          title={notification.is_read ? 'Mark as unread' : 'Mark as read'}
                        >
                          {notification.is_read ? (
                            <X className="w-4 h-4 text-slate-400" />
                          ) : (
                            <Check className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredNotifications.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}

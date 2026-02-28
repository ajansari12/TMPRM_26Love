import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  AlertTriangle,
  FileText,
  Building2,
  Activity,
  Shield,
  Clock,
  ChevronRight,
  Loader2,
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
  created_at: string;
}

const PRIORITY_CONFIG = {
  critical: { color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-300' },
  high: { color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-300' },
  medium: { color: 'amber', bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-300' },
  low: { color: 'gray', bgColor: 'bg-gray-100', textColor: 'text-gray-700', borderColor: 'border-gray-300' },
};

const TYPE_ICONS: Record<string, any> = {
  // Specific full-type mappings
  incident_triggered_reassessment: AlertTriangle,
  contract_expiry_warning: Clock,
  kri_breach: AlertOctagon,
  offboarding_initiated: LogOut,
  vendor_terminated: XCircle,
  // Prefix-based mappings
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
  // Check for exact type match first
  if (TYPE_ICONS[type]) {
    return TYPE_ICONS[type];
  }
  // Fall back to prefix-based matching
  const prefix = type.split('_')[0];
  return TYPE_ICONS[prefix] || TYPE_ICONS.default;
}

function groupNotifications(notifications: Notification[]) {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const thisWeek: Notification[] = [];
  const older: Notification[] = [];

  for (const n of notifications) {
    const date = new Date(n.created_at);
    if (isToday(date)) {
      today.push(n);
    } else if (isYesterday(date)) {
      yesterday.push(n);
    } else if (differenceInDays(new Date(), date) <= 7) {
      thisWeek.push(n);
    } else {
      older.push(n);
    }
  }

  return { today, yesterday, thisWeek, older };
}

export default function NotificationCenter() {
  const { user, profile } = useAuth();
  const { currentOrganization, currentMembership, notificationCounts } =
    useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && currentOrganization) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user, currentOrganization, currentMembership]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchNotifications() {
    if (!user || !currentOrganization) return;

    try {
      setLoading(true);

      const allNotifications: Notification[] = [];

      try {
        const query = supabase
          .from('notifications')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false })
          .limit(20);

        const { data } = await query;
        if (data) {
          allNotifications.push(...data);
        }
      } catch {
        // notifications table may not exist
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
          .limit(15);

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
              (entry.request as { vendor_legal_name?: string })
                ?.vendor_legal_name || 'Unknown Vendor';

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
                new Date(entry.performed_at) <
                  new Date(Date.now() - 24 * 60 * 60 * 1000),
              created_at: entry.performed_at,
            };
          });

          allNotifications.push(...auditNotifications);
        }
      } catch {
        // onboarding_audit_log may not exist
      }

      if (notificationCounts.slaWarnings > 0) {
        allNotifications.unshift({
          id: 'sla_warning',
          type: 'sla_warning',
          title: 'SLA Warning',
          message: `${notificationCounts.slaWarnings} request(s) approaching SLA deadline`,
          priority: 'high',
          action_url: '/onboarding',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      allNotifications.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const uniqueNotifications = allNotifications.slice(0, 50);

      setNotifications(uniqueNotifications);
      setUnreadCount(uniqueNotifications.filter((n) => !n.is_read).length);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
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

  async function markAsRead(notificationId: string) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  }

  async function markAllAsRead() {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length === 0) return;

      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      logger.error('Error marking all as read:', error);
    }
  }

  const grouped = groupNotifications(notifications);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              <p className="text-xs text-slate-500">{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-200 rounded transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No notifications</p>
              </div>
            ) : (
              <>
                {grouped.today.length > 0 && (
                  <NotificationGroup title="Today" notifications={grouped.today} onRead={markAsRead} />
                )}
                {grouped.yesterday.length > 0 && (
                  <NotificationGroup title="Yesterday" notifications={grouped.yesterday} onRead={markAsRead} />
                )}
                {grouped.thisWeek.length > 0 && (
                  <NotificationGroup title="This Week" notifications={grouped.thisWeek} onRead={markAsRead} />
                )}
                {grouped.older.length > 0 && (
                  <NotificationGroup title="Older" notifications={grouped.older} onRead={markAsRead} />
                )}
              </>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium w-full"
            >
              View all notifications
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationGroup({
  title,
  notifications,
  onRead,
}: {
  title: string;
  notifications: Notification[];
  onRead: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {title}
      </div>
      <div className="divide-y divide-slate-100">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onRead={onRead} />
        ))}
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const Icon = getNotificationIcon(notification.type);
  const config = PRIORITY_CONFIG[notification.priority];

  const content = (
    <div className="flex gap-3">
      <div className={`flex-shrink-0 w-9 h-9 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${config.textColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium ${notification.is_read ? 'text-slate-700' : 'text-slate-900'}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRead(notification.id); }}
              className="flex-shrink-0 p-1 hover:bg-slate-200 rounded transition-colors"
              title="Mark as read"
            >
              <Check className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
        {notification.message && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {format(new Date(notification.created_at), 'h:mm a')}
          </span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${config.bgColor} ${config.textColor}`}>
            {notification.priority}
          </span>
          {notification.action_url && (
            <span className="text-xs text-blue-600 font-medium flex items-center gap-0.5">
              View <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const baseClass = `block p-4 hover:bg-slate-50 transition-colors ${!notification.is_read ? 'bg-blue-50/50' : ''} ${notification.action_url ? 'cursor-pointer' : ''}`;

  if (notification.action_url) {
    return (
      <Link
        to={notification.action_url}
        className={baseClass}
        onClick={() => { if (!notification.is_read) onRead(notification.id); }}
      >
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

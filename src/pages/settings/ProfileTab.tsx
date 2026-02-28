import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import { User, Bell, Save } from 'lucide-react';
import { ROLE_OPTIONS } from '../settings/types';
import type { UserNotificationPrefs } from '../settings/types';

export default function ProfileTab() {
  const { user, profile } = useAuth();
  const { currentOrganization, currentMembership } = useOrganization();

  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [userNotifPrefs, setUserNotifPrefs] = useState<UserNotificationPrefs>({
    notification_email: '',
    receive_task_notifications: true,
    receive_escalation_notifications: true,
  });

  const isRiskManager = profile?.role === 'risk_manager';

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          logger.error('Error fetching profile:', error);
          return;
        }
        setProfileData(data);
      } catch (error) {
        logger.error('Error fetching profile:', error);
      }
    }
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (currentMembership) {
      setUserNotifPrefs({
        notification_email: currentMembership.notification_email || user?.email || '',
        receive_task_notifications: currentMembership.receive_task_notifications ?? true,
        receive_escalation_notifications: currentMembership.receive_escalation_notifications ?? true,
      });
    }
  }, [currentMembership, user]);

  async function handleSaveProfile() {
    if (!user || !profileData) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          role: profileData.role,
          department: profileData.department,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile saved successfully');
    } catch (error) {
      logger.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveUserNotificationPrefs() {
    if (!currentOrganization || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organization_users')
        .update({
          notification_email: userNotifPrefs.notification_email || null,
          receive_task_notifications: userNotifPrefs.receive_task_notifications,
          receive_escalation_notifications: userNotifPrefs.receive_escalation_notifications,
        })
        .eq('organization_id', currentOrganization.id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (error) {
      logger.error('Error saving notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={String(profileData?.full_name || '')}
            onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={String(profileData?.role || '')}
            onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
            disabled={!isRiskManager}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input
            type="text"
            value={String(profileData?.department || '')}
            onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {currentOrganization && currentMembership && (
        <>
          <div className="pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">My Notification Preferences</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Configure how you receive notifications for {currentOrganization.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notification Email
                </label>
                <input
                  type="email"
                  value={userNotifPrefs.notification_email}
                  onChange={(e) => setUserNotifPrefs(prev => ({ ...prev, notification_email: e.target.value }))}
                  placeholder={user?.email || 'your@email.com'}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank to use your account email</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={userNotifPrefs.receive_task_notifications}
                    onChange={(e) => setUserNotifPrefs(prev => ({ ...prev, receive_task_notifications: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Task Notifications</span>
                    <p className="text-xs text-gray-500">Receive emails when tasks are assigned to you or need your review</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={userNotifPrefs.receive_escalation_notifications}
                    onChange={(e) => setUserNotifPrefs(prev => ({ ...prev, receive_escalation_notifications: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Escalation Notifications</span>
                    <p className="text-xs text-gray-500">Receive emails for overdue items and SLA breaches</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleSaveUserNotificationPrefs}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

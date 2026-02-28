import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { toast } from 'sonner';
import { User, Users } from 'lucide-react';
import { ROLE_OPTIONS } from './types';

export default function UsersTab() {
  const { user } = useAuth();

  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('Error fetching users:', error);
          toast.error('Failed to load users');
          return;
        }
        setUsers(data || []);
      } catch (error) {
        logger.error('Error fetching users:', error);
      }
    }
    fetchUsers();
  }, [user]);

  async function handleUpdateUserRole(userId: string, newRole: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success('User role updated');
    } catch (error) {
      logger.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={String(u.id)} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{String(u.full_name) || 'No Name'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(u.email)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(u.department) || '-'}</td>
                <td className="px-4 py-3">
                  <select
                    value={String(u.role) || 'business_user'}
                    onChange={(e) => handleUpdateUserRole(String(u.id), e.target.value)}
                    disabled={u.id === user?.id}
                    className="px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {u.created_at ? new Date(String(u.created_at)).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-white rounded border">
            <p className="font-medium text-gray-900">Risk Manager</p>
            <p className="text-xs text-gray-500 mt-1">Full access to all features, settings, and user management</p>
          </div>
          <div className="p-3 bg-white rounded border">
            <p className="font-medium text-gray-900">Vendor Owner</p>
            <p className="text-xs text-gray-500 mt-1">Create/edit vendors, manage contracts, report incidents</p>
          </div>
          <div className="p-3 bg-white rounded border">
            <p className="font-medium text-gray-900">Compliance Analyst</p>
            <p className="text-xs text-gray-500 mt-1">View all, create/approve assessments, export reports</p>
          </div>
          <div className="p-3 bg-white rounded border">
            <p className="font-medium text-gray-900">Auditor</p>
            <p className="text-xs text-gray-500 mt-1">Read-only access to all data and audit logs</p>
          </div>
          <div className="p-3 bg-white rounded border">
            <p className="font-medium text-gray-900">Executive</p>
            <p className="text-xs text-gray-500 mt-1">View dashboards, reports, and KRIs only</p>
          </div>
          <div className="p-3 bg-white rounded border">
            <p className="font-medium text-gray-900">Business User</p>
            <p className="text-xs text-gray-500 mt-1">View vendors and report incidents only</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { logger } from '../lib/logger';
import {
  Users,
  Search,
  Mail,
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  X,
  Clock,
  Calendar,
  Send,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { OrganizationUser, DefenseLine, DEFENSE_LINE_LABELS } from '../types/organization';
import ConfirmModal from '../components/ConfirmModal';

interface DefaultPermissions {
  can_create_requests: boolean;
  can_review: boolean;
  can_approve: boolean;
  can_manage_users: boolean;
  can_configure_workflows: boolean;
  can_complete_assessments: boolean;
}

function getDefaultPermissions(defenseLine: DefenseLine): DefaultPermissions {
  switch (defenseLine) {
    case '1a':
      return {
        can_create_requests: true,
        can_review: false,
        can_approve: false,
        can_manage_users: false,
        can_configure_workflows: false,
        can_complete_assessments: true,
      };
    case '1b':
      return {
        can_create_requests: true,
        can_review: true,
        can_approve: false,
        can_manage_users: false,
        can_configure_workflows: false,
        can_complete_assessments: true,
      };
    case '2nd':
      return {
        can_create_requests: false,
        can_review: true,
        can_approve: true,
        can_manage_users: false,
        can_configure_workflows: true,
        can_complete_assessments: false,
      };
    case '3rd':
      return {
        can_create_requests: false,
        can_review: true,
        can_approve: false,
        can_manage_users: false,
        can_configure_workflows: false,
        can_complete_assessments: false,
      };
    case 'admin':
      return {
        can_create_requests: true,
        can_review: true,
        can_approve: true,
        can_manage_users: true,
        can_configure_workflows: true,
        can_complete_assessments: true,
      };
    default:
      return {
        can_create_requests: false,
        can_review: false,
        can_approve: false,
        can_manage_users: false,
        can_configure_workflows: false,
        can_complete_assessments: false,
      };
  }
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: InviteFormData) => void;
  loading?: boolean;
}

interface InviteFormData {
  email: string;
  name: string;
  defense_line: DefenseLine;
  title: string;
  department: string;
}

function InviteModal({ isOpen, onClose, onInvite, loading }: InviteModalProps) {
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    name: '',
    defense_line: '1a',
    title: '',
    department: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onInvite(formData);
    if (!loading) {
      onClose();
      setFormData({ email: '', name: '', defense_line: '1a', title: '', department: '' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Invite User</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Defense Line <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.defense_line}
              onChange={(e) => setFormData({ ...formData, defense_line: e.target.value as DefenseLine })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(DEFENSE_LINE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Determines the user's role in the approval workflow
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Risk Analyst"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Enterprise Risk"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PendingInvitation {
  id: string;
  email: string;
  defense_line: DefenseLine;
  role_title?: string;
  department?: string;
  inviter_name: string;
  created_at: string;
  expires_at: string;
}

interface EditUserModalProps {
  user: OrganizationUser;
  onClose: () => void;
  onSave: (userId: string, data: { defense_line: DefenseLine; role_title: string; department: string }) => Promise<void>;
}

function EditUserModal({ user: editUser, onClose, onSave }: EditUserModalProps) {
  const [defenseLine, setDefenseLine] = useState<DefenseLine>(editUser.defense_line);
  const [title, setTitle] = useState(editUser.role_title || editUser.title || '');
  const [department, setDepartment] = useState(editUser.department || '');
  const [saving, setSaving] = useState(false);

  const defenseLineOptions: { value: DefenseLine; label: string }[] = Object.entries(DEFENSE_LINE_LABELS).map(([value, label]) => ({
    value: value as DefenseLine,
    label,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(editUser.id, { defense_line: defenseLine, role_title: title, department });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-xs text-slate-500">Editing</p>
            <p className="font-medium text-slate-900">{editUser.user_name || editUser.user_email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Defense Line</label>
            <select
              value={defenseLine}
              onChange={(e) => setDefenseLine(e.target.value as DefenseLine)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {defenseLineOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Risk Analyst"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Risk Management"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const { currentOrganization, currentMembership, isPlatformAdmin, members, loadMembers } = useOrganization();
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDefenseLine, setFilterDefenseLine] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'remove_user' | 'cancel_invite'; id: string } | null>(null);
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null);

  const canManageUsers = isPlatformAdmin || currentMembership?.defense_line === 'admin';

  useEffect(() => {
    if (currentOrganization) {
      loadMembers();
      loadPendingInvitations();
    }
  }, [currentOrganization]);

  useEffect(() => {
    if (members.length > 0) {
      const mappedUsers: OrganizationUser[] = members.map((m) => ({
        ...m,
        user_email: m.user?.email,
        user_name: m.user?.full_name,
        title: m.role_title,
        permissions: {
          can_create_requests: m.can_create_requests,
          can_review: m.can_review,
          can_approve: m.can_approve,
          can_admin: m.defense_line === 'admin',
        },
        joined_at: m.created_at,
      }));
      setUsers(mappedUsers);
    }
  }, [members]);

  const loadPendingInvitations = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
    } catch (error) {
      logger.error('Error loading invitations:', error);
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterDefenseLine === 'all' || user.defense_line === filterDefenseLine;
    return matchesSearch && matchesFilter;
  });

  // Group users by defense line
  const usersByDefenseLine = {
    '1a': filteredUsers.filter((u) => u.defense_line === '1a'),
    '1b': filteredUsers.filter((u) => u.defense_line === '1b'),
    '2nd': filteredUsers.filter((u) => u.defense_line === '2nd'),
    '3rd': filteredUsers.filter((u) => u.defense_line === '3rd'),
    admin: filteredUsers.filter((u) => u.defense_line === 'admin'),
  };

  const handleInvite = async (data: InviteFormData) => {
    if (!currentOrganization || !user) return;

    setInviting(true);
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', data.email.toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        const { data: existingMember } = await supabase
          .from('organization_users')
          .select('id')
          .eq('organization_id', currentOrganization.id)
          .eq('user_id', existingProfile.id)
          .eq('is_active', true)
          .maybeSingle();

        if (existingMember) {
          toast.error('User is already a member of this organization');
          return;
        }

        const permissions = getDefaultPermissions(data.defense_line);
        const { error } = await supabase.from('organization_users').insert({
          organization_id: currentOrganization.id,
          user_id: existingProfile.id,
          defense_line: data.defense_line,
          role_title: data.title,
          department: data.department,
          ...permissions,
          invited_by: user.id,
        });

        if (error) throw error;

        toast.success(`${data.name} has been added to the organization`);
        await loadMembers();
      } else {
        const inviterName = profile?.full_name || user.email || 'A team member';
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            organization_id: currentOrganization.id,
            defense_line: data.defense_line,
            role_title: data.title,
            department: data.department,
            inviter_id: user.id,
            inviter_name: inviterName,
            organization_name: currentOrganization.name,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to send invitation');
        }

        if (result.email_sent) {
          toast.success(`Invitation sent to ${data.email}`);
        } else {
          toast.success('Invitation created', {
            description: 'Email notification could not be sent. Share the invitation link manually.',
          });
        }

        await loadPendingInvitations();
      }
    } catch (error: any) {
      logger.error('Error inviting user:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const toggleVendorCreationPermission = async (userId: string, currentValue: boolean) => {
    if (!currentOrganization) return;

    try {
      const { error } = await supabase
        .from('organization_users')
        .update({ can_create_vendors: !currentValue })
        .eq('organization_id', currentOrganization.id)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(
        !currentValue
          ? 'Vendor creation permission granted'
          : 'Vendor creation permission revoked'
      );
      await loadMembers();
    } catch (error) {
      logger.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    }
  };

  const handleRemoveUser = (userId: string) => {
    setConfirmAction({ type: 'remove_user', id: userId });
  };

  const handleCancelInvitation = (invitationId: string) => {
    setConfirmAction({ type: 'cancel_invite', id: invitationId });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !currentOrganization) return;

    try {
      if (confirmAction.type === 'remove_user') {
        const { error } = await supabase
          .from('organization_users')
          .update({ is_active: false })
          .eq('organization_id', currentOrganization.id)
          .eq('user_id', confirmAction.id);

        if (error) throw error;

        toast.success('User removed from organization');
        await loadMembers();
      } else if (confirmAction.type === 'cancel_invite') {
        const { error } = await supabase
          .from('organization_invitations')
          .update({ status: 'cancelled' })
          .eq('id', confirmAction.id);

        if (error) throw error;

        toast.success('Invitation cancelled');
        await loadPendingInvitations();
      }
    } catch (error) {
      logger.error('Error performing action:', error);
      toast.error(confirmAction.type === 'remove_user' ? 'Failed to remove user' : 'Failed to cancel invitation');
    } finally {
      setConfirmAction(null);
    }
  };

  const handleUpdateUser = async (
    userId: string,
    data: { defense_line: DefenseLine; role_title: string; department: string }
  ) => {
    if (!currentOrganization) return;
    const permissions = getDefaultPermissions(data.defense_line);
    const { error } = await supabase
      .from('organization_users')
      .update({ defense_line: data.defense_line, role_title: data.role_title, department: data.department, ...permissions })
      .eq('organization_id', currentOrganization.id)
      .eq('user_id', userId);
    if (error) {
      logger.error('Error updating user:', error);
      toast.error('Failed to update user');
      throw error;
    }
    toast.success('User updated successfully');
    await loadMembers();
  };

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    if (!currentOrganization || !user) return;

    try {
      const inviterName = profile?.full_name || user.email || 'A team member';
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;

      await supabase
        .from('organization_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitation.id);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: invitation.email,
          organization_id: currentOrganization.id,
          defense_line: invitation.defense_line,
          role_title: invitation.role_title,
          department: invitation.department,
          inviter_id: user.id,
          inviter_name: inviterName,
          organization_name: currentOrganization.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend invitation');
      }

      toast.success('Invitation resent');
      await loadPendingInvitations();
    } catch (error: any) {
      logger.error('Error resending invitation:', error);
      toast.error(error.message || 'Failed to resend invitation');
    }
  };

  const getDefenseLineColor = (line: DefenseLine) => {
    const colors: Record<DefenseLine, string> = {
      '1a': 'bg-blue-100 text-blue-700 border-blue-200',
      '1b': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      '2nd': 'bg-purple-100 text-purple-700 border-purple-200',
      '3rd': 'bg-pink-100 text-pink-700 border-pink-200',
      admin: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return colors[line];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Users className="w-8 h-8 text-blue-600 mr-3" />
            User Management
          </h1>
          <p className="text-slate-600 mt-1">
            Manage users and their defense line assignments
          </p>
        </div>
        {canManageUsers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(DEFENSE_LINE_LABELS).map(([line, label]) => (
          <div
            key={line}
            className={`p-4 rounded-lg border ${getDefenseLineColor(line as DefenseLine)}`}
          >
            <p className="text-2xl font-bold">{usersByDefenseLine[line as DefenseLine]?.length || 0}</p>
            <p className="text-sm">{label}</p>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or department..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">Defense Line:</span>
            <select
              value={filterDefenseLine}
              onChange={(e) => setFilterDefenseLine(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Lines</option>
              {Object.entries(DEFENSE_LINE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Defense Line
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Role / Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Vendor Creation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Joined
              </th>
              {canManageUsers && (
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-600">
                        {user.user_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-slate-900">{user.user_name}</p>
                      <p className="text-sm text-slate-500">{user.user_email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDefenseLineColor(
                      user.defense_line
                    )}`}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {DEFENSE_LINE_LABELS[user.defense_line]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm text-slate-900">{user.title || '-'}</p>
                  <p className="text-sm text-slate-500">{user.department || '-'}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.is_active ? (
                    <span className="inline-flex items-center text-sm text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-sm text-amber-600">
                      <Clock className="w-4 h-4 mr-1" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.can_create_vendors ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-slate-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(user.joined_at).toLocaleDateString()}
                  </div>
                </td>
                {canManageUsers && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </button>

                      {activeMenu === user.id && (
                        <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                          <div className="px-4 py-2 border-b border-slate-200">
                            <p className="text-xs font-medium text-slate-500 uppercase">Permissions</p>
                          </div>
                          <button
                            onClick={async () => {
                              await toggleVendorCreationPermission(user.id, user.can_create_vendors);
                              setActiveMenu(null);
                            }}
                            className="flex items-center justify-between w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <span className="flex items-center">
                              <Shield className="w-4 h-4 mr-2" />
                              Can Create Vendors
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                user.can_create_vendors
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {user.can_create_vendors ? 'ON' : 'OFF'}
                            </span>
                          </button>
                          <div className="border-t border-slate-200 mt-1 pt-1">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setActiveMenu(null);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit User
                            </button>
                            <button
                              onClick={() => {
                                handleRemoveUser(user.id);
                                setActiveMenu(null);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove User
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={canManageUsers ? 7 : 6} className="px-6 py-12 text-center">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No users found matching your criteria</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations */}
      {canManageUsers && pendingInvitations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
            <h3 className="text-lg font-medium text-amber-800 flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Pending Invitations ({pendingInvitations.length})
            </h3>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Defense Line
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Invited By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pendingInvitations.map((invitation) => (
                <tr key={invitation.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <Mail className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-slate-900">{invitation.email}</p>
                        <p className="text-xs text-slate-500">Invitation pending</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDefenseLineColor(
                        invitation.defense_line
                      )}`}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      {DEFENSE_LINE_LABELS[invitation.defense_line]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-slate-900">{invitation.role_title || '-'}</p>
                    <p className="text-sm text-slate-500">{invitation.department || '-'}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-slate-700">{invitation.inviter_name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-slate-700">
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleResendInvitation(invitation)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Resend invitation"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Cancel invitation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Defense Line Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4">Defense Line Roles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border border-slate-200 rounded-lg">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDefenseLineColor('1a')} mb-2`}>
              {DEFENSE_LINE_LABELS['1a']}
            </div>
            <p className="text-sm text-slate-600">
              Business functions that onboard, request, and manage third-party relationships.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-lg">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDefenseLineColor('1b')} mb-2`}>
              {DEFENSE_LINE_LABELS['1b']}
            </div>
            <p className="text-sm text-slate-600">
              Business unit risk coordinators who review and confirm submissions before escalation.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-lg">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDefenseLineColor('2nd')} mb-2`}>
              {DEFENSE_LINE_LABELS['2nd']}
            </div>
            <p className="text-sm text-slate-600">
              Risk management and compliance functions that provide independent oversight and approval.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-lg">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDefenseLineColor('3rd')} mb-2`}>
              {DEFENSE_LINE_LABELS['3rd']}
            </div>
            <p className="text-sm text-slate-600">
              Internal audit function providing independent assurance on TPRM effectiveness.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-lg">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDefenseLineColor('admin')} mb-2`}>
              {DEFENSE_LINE_LABELS['admin']}
            </div>
            <p className="text-sm text-slate-600">
              System administrators with full access to configure workflows, users, and settings.
            </p>
          </div>
        </div>
      </div>

      {/* Permission Warning */}
      {!canManageUsers && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">View Only Mode</p>
            <p className="text-sm text-amber-700 mt-1">
              You don't have permission to manage users. Contact your administrator if you need to make changes.
            </p>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={async (data) => {
          await handleInvite(data);
          setShowInviteModal(false);
        }}
        loading={inviting}
      />

      <ConfirmModal
        isOpen={!!confirmAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
        title={confirmAction?.type === 'remove_user' ? 'Remove User' : 'Cancel Invitation'}
        message={confirmAction?.type === 'remove_user' ? 'Are you sure you want to remove this user from the organization?' : 'Are you sure you want to cancel this invitation?'}
        confirmLabel={confirmAction?.type === 'remove_user' ? 'Remove' : 'Cancel Invitation'}
        variant="danger"
      />

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}
    </div>
  );
}

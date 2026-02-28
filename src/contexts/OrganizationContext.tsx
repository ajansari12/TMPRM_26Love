import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useAuth } from './AuthContext';
import {
  Organization,
  OrganizationUser,
  DefenseLine,
  OrganizationStats,
} from '../types/organization';
import {
  isTableMissingError,
  getTableNameFromError,
  logTableMissingError,
  getPostgrestErrorMessage,
} from './organization/helpers';
import { useNotificationCounts, type NotificationCounts } from './organization/useNotificationCounts';
import { useOrgStats } from './organization/useOrgStats';
import { useOrgMembers } from './organization/useOrgMembers';
import { useImpersonation, type DefenseLineImpersonationState } from './organization/useImpersonation';

interface OrganizationContextType {
  // Current organization
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;

  // User's membership in current org
  currentMembership: OrganizationUser | null;

  // All organizations user belongs to
  organizations: Organization[];

  // User's defense line in current org (uses impersonated value when active)
  defenseLine: DefenseLine | null;

  // Permissions (derived from defense line, uses impersonated when active)
  canCreateRequests: boolean;
  canReview: boolean;
  canApprove: boolean;
  canManageUsers: boolean;
  canConfigureWorkflows: boolean;
  isAdmin: boolean;

  // Organization stats
  stats: (OrganizationStats & { pendingReviews: number }) | null;

  // Platform admin status
  isPlatformAdmin: boolean;

  // Notification counts for badges
  notificationCounts: NotificationCounts;

  // Loading state
  loading: boolean;

  // Organization Impersonation (platform admin viewing as org)
  isImpersonating: boolean;
  impersonatedOrganization: Organization | null;
  impersonateOrganization: (orgId: string) => Promise<void>;
  stopImpersonation: () => void;

  // Defense Line Impersonation (admin testing as different defense line)
  defenseLineImpersonation: DefenseLineImpersonationState;
  impersonateDefenseLine: (targetLine: DefenseLine) => Promise<boolean>;
  stopDefenseLineImpersonation: () => Promise<void>;
  extendDefenseLineImpersonation: () => Promise<boolean>;
  getImpersonationSessionId: () => string | null;

  // Actions
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganization: () => Promise<void>;
  createOrganization: (data: Partial<Organization>) => Promise<Organization | null>;
  updateOrganization: (data: Partial<Organization>) => Promise<boolean>;
  refreshNotificationCounts: () => Promise<void>;

  // User management
  inviteUser: (email: string, defenseLine: DefenseLine, roleTitle?: string, businessUnit?: string) => Promise<boolean>;
  updateUserRole: (userId: string, defenseLine: DefenseLine, permissions: Partial<OrganizationUser>) => Promise<boolean>;
  removeUser: (userId: string) => Promise<boolean>;

  // Members
  members: OrganizationUser[];
  loadMembers: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user, profile } = useAuth();

  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentMembership, setCurrentMembership] = useState<OrganizationUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  // Composed hooks
  const { notificationCounts, refreshNotificationCounts } = useNotificationCounts(
    currentOrganization,
    currentMembership,
  );

  const { stats, refreshStats } = useOrgStats(currentOrganization, user);

  const { members, loadMembers, inviteUser, updateUserRole, removeUser } = useOrgMembers(
    currentOrganization,
    user,
  );

  const impersonation = useImpersonation(
    currentOrganization,
    setCurrentOrganization,
    currentMembership,
    user,
    isPlatformAdmin,
  );

  // isAdmin always checks the real membership (not impersonated)
  const isAdmin = currentMembership?.defense_line === 'admin';

  // Derived defense line (uses impersonated value when active)
  const defenseLine = impersonation.defenseLineImpersonation.isActive
    ? impersonation.defenseLineImpersonation.targetDefenseLine
    : (currentMembership?.defense_line ?? null);

  // Permissions derived from the effective defense line
  const effectiveDefenseLine = impersonation.defenseLineImpersonation.isActive
    ? impersonation.defenseLineImpersonation.targetDefenseLine
    : currentMembership?.defense_line;

  const canCreateRequests = impersonation.defenseLineImpersonation.isActive
    ? (effectiveDefenseLine === '1a' || effectiveDefenseLine === '1b' || effectiveDefenseLine === 'admin')
    : ((currentMembership?.can_create_requests ?? false) || isAdmin);
  const canReview = impersonation.defenseLineImpersonation.isActive
    ? (effectiveDefenseLine === '1b' || effectiveDefenseLine === '2nd' || effectiveDefenseLine === 'admin')
    : ((currentMembership?.can_review ?? false) || isAdmin);
  const canApprove = impersonation.defenseLineImpersonation.isActive
    ? (effectiveDefenseLine === '2nd' || effectiveDefenseLine === 'admin' || effectiveDefenseLine === 'senior_management')
    : ((currentMembership?.can_approve ?? false) || isAdmin);
  const canManageUsers = (currentMembership?.can_manage_users ?? false) || isAdmin;
  const canConfigureWorkflows = (currentMembership?.can_configure_workflows ?? false) || isAdmin;

  // Load user's organizations on auth change
  useEffect(() => {
    if (user) {
      loadUserOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrganization(null);
      setCurrentMembership(null);
      setLoading(false);
    }
  }, [user]);

  // Check platform admin status when user changes
  useEffect(() => {
    if (user) {
      checkPlatformAdminStatus();
    } else {
      setIsPlatformAdmin(false);
    }
  }, [user]);

  // Load current membership when organization changes
  useEffect(() => {
    if (currentOrganization && user) {
      loadCurrentMembership();
    }
  }, [currentOrganization, user]);

  async function checkPlatformAdminStatus() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          const tableName = getTableNameFromError(error) || 'platform_admins';
          logTableMissingError(tableName);
          setIsPlatformAdmin(false);
          return;
        }
        throw error;
      }

      setIsPlatformAdmin(!!data);
    } catch (error) {
      logger.error('Error checking platform admin status:', error);
      setIsPlatformAdmin(false);
    }
  }

  async function loadUserOrganizations() {
    if (!user) return;

    setLoading(true);
    try {
      const { data: memberships, error: memberError } = await supabase
        .from('organization_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (memberError) {
        if (isTableMissingError(memberError)) {
          const tableName = getTableNameFromError(memberError) || 'organization_users';
          logTableMissingError(tableName);
          setOrganizations([]);
          setCurrentOrganization(null);
          setLoading(false);
          return;
        }
        throw memberError;
      }

      if (!memberships || memberships.length === 0) {
        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      const orgIds = memberships.map((m) => m.organization_id);

      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .eq('is_active', true)
        .order('name');

      if (orgError) {
        if (isTableMissingError(orgError)) {
          const tableName = getTableNameFromError(orgError) || 'organizations';
          logTableMissingError(tableName);
          setOrganizations([]);
          setCurrentOrganization(null);
          setLoading(false);
          return;
        }
        throw orgError;
      }

      setOrganizations(orgs || []);

      if (orgs && orgs.length > 0) {
        const defaultOrgId = profile?.default_organization_id;
        const defaultOrg = orgs.find((o) => o.id === defaultOrgId) || orgs[0];
        setCurrentOrganization(defaultOrg);
      }
    } catch (error) {
      logger.error('Error loading organizations:', error);
      setOrganizations([]);
      setCurrentOrganization(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentMembership() {
    if (!currentOrganization || !user) return;

    try {
      const { data, error } = await supabase
        .from('organization_users')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          const tableName = getTableNameFromError(error) || 'organization_users';
          logTableMissingError(tableName);
          setCurrentMembership(null);
          return;
        }
        throw error;
      }
      setCurrentMembership(data);
    } catch (error) {
      logger.error('Error loading membership:', error);
      setCurrentMembership(null);
    }
  }

  async function switchOrganization(orgId: string) {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);

      if (user) {
        await supabase
          .from('profiles')
          .update({ default_organization_id: orgId })
          .eq('id', user.id);
      }
    }
  }

  async function refreshOrganization() {
    await loadUserOrganizations();
    if (currentOrganization) {
      await refreshStats();
      await refreshNotificationCounts();
    }
  }

  async function createOrganization(data: Partial<Organization>): Promise<Organization | null> {
    if (!user) return null;

    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          ...data,
          created_by: user.id,
        })
        .select()
        .single();

      if (orgError) {
        if (isTableMissingError(orgError)) {
          const tableName = getTableNameFromError(orgError) || 'organizations';
          logTableMissingError(tableName);
        }
        const msg = getPostgrestErrorMessage(orgError);
        logger.error('Error creating organization:', msg);
        throw new Error(msg || 'Failed to create organization');
      }

      await loadUserOrganizations();
      return org;
    } catch (error) {
      logger.error('Error creating organization:', error);
      throw error;
    }
  }

  async function updateOrganization(data: Partial<Organization>): Promise<boolean> {
    if (!currentOrganization) return false;

    try {
      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', currentOrganization.id);

      if (error) {
        if (isTableMissingError(error)) {
          const tableName = getTableNameFromError(error) || 'organizations';
          logTableMissingError(tableName);
          return false;
        }
        throw error;
      }

      const { data: updated, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', currentOrganization.id)
        .maybeSingle();

      if (!fetchError && updated) {
        setCurrentOrganization(updated);
      }

      return true;
    } catch (error) {
      logger.error('Error updating organization:', error);
      return false;
    }
  }

  const value: OrganizationContextType = {
    currentOrganization,
    setCurrentOrganization,
    currentMembership,
    organizations,
    defenseLine,
    canCreateRequests,
    canReview,
    canApprove,
    canManageUsers,
    canConfigureWorkflows,
    isAdmin,
    stats,
    isPlatformAdmin,
    notificationCounts,
    loading,
    // Impersonation
    isImpersonating: impersonation.isImpersonating,
    impersonatedOrganization: impersonation.impersonatedOrganization,
    impersonateOrganization: impersonation.impersonateOrganization,
    stopImpersonation: impersonation.stopImpersonation,
    defenseLineImpersonation: impersonation.defenseLineImpersonation,
    impersonateDefenseLine: impersonation.impersonateDefenseLine,
    stopDefenseLineImpersonation: impersonation.stopDefenseLineImpersonation,
    extendDefenseLineImpersonation: impersonation.extendDefenseLineImpersonation,
    getImpersonationSessionId: impersonation.getImpersonationSessionId,
    // Actions
    switchOrganization,
    refreshOrganization,
    createOrganization,
    updateOrganization,
    refreshNotificationCounts,
    // User management
    inviteUser,
    updateUserRole,
    removeUser,
    members,
    loadMembers,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

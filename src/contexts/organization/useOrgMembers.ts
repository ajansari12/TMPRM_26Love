import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import {
  Organization,
  OrganizationUser,
  DefenseLine,
} from '../../types/organization';
import { isTableMissingError, getTableNameFromError, logTableMissingError } from './helpers';
import type { User } from '@supabase/supabase-js';

export function useOrgMembers(
  currentOrganization: Organization | null,
  user: User | null,
) {
  const [members, setMembers] = useState<OrganizationUser[]>([]);

  async function loadMembers() {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('organization_users')
        .select(
          `
          *,
          user:profiles!organization_users_user_id_fkey (
            id,
            email,
            full_name
          )
        `,
        )
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('defense_line')
        .order('role_title');

      if (error) {
        if (isTableMissingError(error)) {
          const tableName = getTableNameFromError(error) || 'organization_users';
          logTableMissingError(tableName);
          setMembers([]);
          return;
        }
        throw error;
      }
      setMembers(data || []);
    } catch (error) {
      logger.error('Error loading members:', error);
      setMembers([]);
    }
  }

  async function inviteUser(
    email: string,
    defenseLine: DefenseLine,
    roleTitle?: string,
    businessUnit?: string,
  ): Promise<boolean> {
    if (!currentOrganization || !user) return false;

    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profileError) {
        if (isTableMissingError(profileError)) {
          logTableMissingError('profiles');
          return false;
        }
        throw profileError;
      }

      if (existingProfile) {
        const { error } = await supabase.from('organization_users').insert({
          organization_id: currentOrganization.id,
          user_id: existingProfile.id,
          defense_line: defenseLine,
          role_title: roleTitle,
          business_unit: businessUnit,
          can_create_requests:
            defenseLine === '1a' || defenseLine === '1b' || defenseLine === 'admin',
          can_review: defenseLine === '1b' || defenseLine === '2nd' || defenseLine === 'admin',
          can_approve: defenseLine === '2nd' || defenseLine === 'admin',
          can_manage_users: defenseLine === 'admin',
          can_configure_workflows: defenseLine === 'admin',
          invited_by: user.id,
        });

        if (error) {
          if (isTableMissingError(error)) {
            const tableName = getTableNameFromError(error) || 'organization_users';
            logTableMissingError(tableName);
            return false;
          }
          throw error;
        }
      } else {
        logger.log('User not found, invitation system not yet implemented');
        return false;
      }

      await loadMembers();
      return true;
    } catch (error) {
      logger.error('Error inviting user:', error);
      return false;
    }
  }

  async function updateUserRole(
    userId: string,
    defenseLine: DefenseLine,
    permissions: Partial<OrganizationUser>,
  ): Promise<boolean> {
    if (!currentOrganization) return false;

    try {
      const { error } = await supabase
        .from('organization_users')
        .update({
          defense_line: defenseLine,
          ...permissions,
        })
        .eq('organization_id', currentOrganization.id)
        .eq('user_id', userId);

      if (error) {
        if (isTableMissingError(error)) {
          const tableName = getTableNameFromError(error) || 'organization_users';
          logTableMissingError(tableName);
          return false;
        }
        throw error;
      }
      await loadMembers();
      return true;
    } catch (error) {
      logger.error('Error updating user role:', error);
      return false;
    }
  }

  async function removeUser(userId: string): Promise<boolean> {
    if (!currentOrganization) return false;

    try {
      const { error } = await supabase
        .from('organization_users')
        .update({ is_active: false })
        .eq('organization_id', currentOrganization.id)
        .eq('user_id', userId);

      if (error) {
        if (isTableMissingError(error)) {
          const tableName = getTableNameFromError(error) || 'organization_users';
          logTableMissingError(tableName);
          return false;
        }
        throw error;
      }
      await loadMembers();
      return true;
    } catch (error) {
      logger.error('Error removing user:', error);
      return false;
    }
  }

  return {
    members,
    loadMembers,
    inviteUser,
    updateUserRole,
    removeUser,
  };
}

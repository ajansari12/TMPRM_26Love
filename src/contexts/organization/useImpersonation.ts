import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { Organization, OrganizationUser, DefenseLine } from '../../types/organization';
import { isTableMissingError, logTableMissingError } from './helpers';
import type { User } from '@supabase/supabase-js';

export interface DefenseLineImpersonationState {
  isActive: boolean;
  sessionId: string | null;
  targetDefenseLine: DefenseLine | null;
  originalDefenseLine: DefenseLine | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  minutesRemaining: number;
}

const DEFAULT_IMPERSONATION: DefenseLineImpersonationState = {
  isActive: false,
  sessionId: null,
  targetDefenseLine: null,
  originalDefenseLine: null,
  startedAt: null,
  expiresAt: null,
  minutesRemaining: 0,
};

export function useImpersonation(
  currentOrganization: Organization | null,
  setCurrentOrganization: (org: Organization | null) => void,
  currentMembership: OrganizationUser | null,
  user: User | null,
  isPlatformAdmin: boolean,
) {
  const isAdmin = currentMembership?.defense_line === 'admin';

  // Organization impersonation (platform admin)
  const [impersonatedOrganization, setImpersonatedOrganization] = useState<Organization | null>(
    null,
  );
  const [originalOrganization, setOriginalOrganization] = useState<Organization | null>(null);
  const isImpersonating = impersonatedOrganization !== null;

  // Defense line impersonation (admin testing)
  const [defenseLineImpersonation, setDefenseLineImpersonation] =
    useState<DefenseLineImpersonationState>(DEFAULT_IMPERSONATION);

  // Check for existing session on org change
  useEffect(() => {
    if (currentOrganization && user && isAdmin) {
      checkActiveImpersonationSession();
    } else {
      setDefenseLineImpersonation(DEFAULT_IMPERSONATION);
    }
  }, [currentOrganization, user, currentMembership]);

  // Timeout monitoring
  useEffect(() => {
    if (!defenseLineImpersonation.isActive) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expiresAt = defenseLineImpersonation.expiresAt;

      if (expiresAt) {
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000));

        if (remaining <= 0) {
          stopDefenseLineImpersonation('timeout');
        } else {
          setDefenseLineImpersonation((prev) => ({
            ...prev,
            minutesRemaining: remaining,
          }));
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [defenseLineImpersonation.isActive, defenseLineImpersonation.expiresAt]);

  async function checkActiveImpersonationSession() {
    if (!currentOrganization || !user) return;

    try {
      const { data, error } = await supabase.rpc('get_active_defense_line_impersonation', {
        p_user_id: user.id,
        p_organization_id: currentOrganization.id,
      });

      if (error) {
        logger.warn('Error checking impersonation session:', error);
        return;
      }

      if (data && data.length > 0) {
        const session = data[0];
        const expiresAt = new Date(
          new Date(session.last_activity_at).getTime() + 60 * 60 * 1000,
        );

        setDefenseLineImpersonation({
          isActive: true,
          sessionId: session.session_id,
          targetDefenseLine: session.target_defense_line as DefenseLine,
          originalDefenseLine: session.original_defense_line as DefenseLine,
          startedAt: new Date(session.started_at),
          expiresAt,
          minutesRemaining: session.minutes_remaining,
        });
      }
    } catch (error) {
      logger.error('Error checking impersonation session:', error);
    }
  }

  async function impersonateOrganization(orgId: string): Promise<void> {
    if (!isPlatformAdmin || !user) return;

    try {
      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          logTableMissingError('organizations');
          return;
        }
        throw error;
      }

      if (org) {
        setOriginalOrganization(currentOrganization);
        setImpersonatedOrganization(org);
        setCurrentOrganization(org);

        try {
          await supabase.from('audit_logs').insert({
            organization_id: orgId,
            user_id: user.id,
            action: 'platform_admin_impersonation_started',
            entity_type: 'organization',
            entity_id: orgId,
            changes: {
              impersonated_by: user.id,
              organization_name: org.name,
              started_at: new Date().toISOString(),
            },
          });
        } catch (auditError) {
          logger.warn('Audit log creation failed:', auditError);
        }
      }
    } catch (error) {
      logger.error('Error starting impersonation:', error);
    }
  }

  function stopImpersonation(): void {
    if (!isImpersonating || !user) return;

    const impersonatedOrgId = impersonatedOrganization?.id;

    if (impersonatedOrgId) {
      (async () => {
        try {
          await supabase.from('audit_logs').insert({
            organization_id: impersonatedOrgId,
            user_id: user.id,
            action: 'platform_admin_impersonation_ended',
            entity_type: 'organization',
            entity_id: impersonatedOrgId,
            changes: {
              impersonated_by: user.id,
              ended_at: new Date().toISOString(),
            },
          });
        } catch (auditError) {
          logger.warn('Audit log creation failed:', auditError);
        }
      })();
    }

    setCurrentOrganization(originalOrganization);
    setImpersonatedOrganization(null);
    setOriginalOrganization(null);
  }

  async function impersonateDefenseLine(targetLine: DefenseLine): Promise<boolean> {
    if (!currentOrganization || !user || !isAdmin) return false;

    try {
      const { data: sessionId, error } = await supabase.rpc(
        'start_defense_line_impersonation',
        {
          p_organization_id: currentOrganization.id,
          p_target_defense_line: targetLine,
        },
      );

      if (error) {
        logger.error('Error starting defense line impersonation:', error);
        return false;
      }

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      setDefenseLineImpersonation({
        isActive: true,
        sessionId,
        targetDefenseLine: targetLine,
        originalDefenseLine: currentMembership?.defense_line ?? 'admin',
        startedAt: new Date(),
        expiresAt,
        minutesRemaining: 60,
      });

      return true;
    } catch (error) {
      logger.error('Error starting defense line impersonation:', error);
      return false;
    }
  }

  async function stopDefenseLineImpersonation(reason: string = 'manual'): Promise<void> {
    if (!defenseLineImpersonation.isActive || !defenseLineImpersonation.sessionId) return;

    try {
      await supabase.rpc('end_defense_line_impersonation', {
        p_session_id: defenseLineImpersonation.sessionId,
        p_reason: reason,
      });
    } catch (error) {
      logger.error('Error ending defense line impersonation:', error);
    }

    setDefenseLineImpersonation(DEFAULT_IMPERSONATION);
  }

  async function extendDefenseLineImpersonation(): Promise<boolean> {
    if (!defenseLineImpersonation.isActive || !defenseLineImpersonation.sessionId) return false;

    try {
      const { data: success, error } = await supabase.rpc(
        'extend_defense_line_impersonation',
        {
          p_session_id: defenseLineImpersonation.sessionId,
        },
      );

      if (error || !success) {
        logger.error('Error extending impersonation:', error);
        return false;
      }

      const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      setDefenseLineImpersonation((prev) => ({
        ...prev,
        expiresAt: newExpiresAt,
        minutesRemaining: 60,
      }));

      return true;
    } catch (error) {
      logger.error('Error extending impersonation:', error);
      return false;
    }
  }

  function getImpersonationSessionId(): string | null {
    return defenseLineImpersonation.sessionId;
  }

  return {
    // Org impersonation
    isImpersonating,
    impersonatedOrganization,
    impersonateOrganization,
    stopImpersonation,
    // Defense line impersonation
    defenseLineImpersonation,
    impersonateDefenseLine,
    stopDefenseLineImpersonation,
    extendDefenseLineImpersonation,
    getImpersonationSessionId,
  };
}

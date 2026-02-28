import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { Organization, OrganizationUser } from '../../types/organization';
import { isTableMissingError } from './helpers';

export interface NotificationCounts {
  pendingMyReview: number;
  pendingContractReviews: number;
  overdueDueDiligence: number;
  newRequestsToday: number;
  slaWarnings: number;
  pendingReassessments: number;
}

const DEFAULT_COUNTS: NotificationCounts = {
  pendingMyReview: 0,
  pendingContractReviews: 0,
  overdueDueDiligence: 0,
  newRequestsToday: 0,
  slaWarnings: 0,
  pendingReassessments: 0,
};

export function useNotificationCounts(
  currentOrganization: Organization | null,
  currentMembership: OrganizationUser | null,
) {
  const [notificationCounts, setNotificationCounts] = useState<NotificationCounts>(DEFAULT_COUNTS);

  async function loadNotificationCounts() {
    if (!currentOrganization || !currentMembership) return;

    const counts: NotificationCounts = { ...DEFAULT_COUNTS };
    const defenseLine = currentMembership.defense_line;

    if (defenseLine === 'admin') {
      try {
        const { count, error } = await supabase
          .from('onboarding_requests')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', currentOrganization.id)
          .in('status', ['1b_review', '2nd_review', 'pending_senior_approval']);

        if (!error) {
          counts.pendingMyReview = count || 0;
        }
      } catch (err) {
        logger.error('Error fetching pending review count:', err);
      }
    } else {
      const statusForLine =
        defenseLine === '1b'
          ? '1b_review'
          : defenseLine === '2nd'
            ? '2nd_review'
            : null;

      if (statusForLine) {
        try {
          const { count, error } = await supabase
            .from('onboarding_requests')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .eq('status', statusForLine);

          if (!error) {
            counts.pendingMyReview = count || 0;
          }
        } catch (err) {
          logger.error('Error fetching pending review count:', err);
        }
      }
    }

    try {
      const { count, error } = await supabase
        .from('contract_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'pending');

      if (!error) {
        counts.pendingContractReviews = count || 0;
      }
    } catch (err) {
      if (!isTableMissingError(err)) {
        logger.error('Error fetching contract reviews count:', err);
      }
    }

    try {
      const { count, error } = await supabase
        .from('due_diligence_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'overdue');

      if (!error) {
        counts.overdueDueDiligence = count || 0;
      }
    } catch (err) {
      if (!isTableMissingError(err)) {
        logger.error('Error fetching due diligence count:', err);
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const { count, error } = await supabase
        .from('onboarding_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .gte('created_at', todayStart.toISOString());

      if (!error) {
        counts.newRequestsToday = count || 0;
      }
    } catch (err) {
      logger.error('Error fetching new requests count:', err);
    }

    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const { count, error } = await supabase
        .from('onboarding_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .not('status', 'in', '("approved","rejected","withdrawn","vendor_created")')
        .lt('target_completion_date', threeDaysFromNow.toISOString())
        .gt('target_completion_date', new Date().toISOString());

      if (!error) {
        counts.slaWarnings = count || 0;
      }
    } catch (err) {
      logger.error('Error fetching SLA warnings count:', err);
    }

    try {
      const { count, error } = await supabase
        .from('assessment_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .in('task_type', [
          'periodic_reassessment',
          'material_change',
          'contract_renewal',
          'bulk_import_assessment',
          'reassessment_validation',
        ])
        .in('status', ['pending', 'in_progress']);

      if (!error) {
        counts.pendingReassessments = count || 0;
      }
    } catch (err) {
      if (!isTableMissingError(err)) {
        logger.error('Error fetching pending reassessments count:', err);
      }
    }

    setNotificationCounts(counts);
  }

  // Load when membership is ready
  useEffect(() => {
    if (currentOrganization && currentMembership) {
      loadNotificationCounts();
    }
  }, [currentOrganization, currentMembership]);

  // Refresh every 60 seconds
  useEffect(() => {
    if (!currentOrganization || !currentMembership) return;

    const interval = setInterval(() => {
      loadNotificationCounts();
    }, 60000);

    return () => clearInterval(interval);
  }, [currentOrganization, currentMembership]);

  return {
    notificationCounts,
    refreshNotificationCounts: loadNotificationCounts,
  };
}

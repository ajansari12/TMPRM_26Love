import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { Organization, OrganizationStats } from '../../types/organization';
import { isTableMissingError, logTableMissingError } from './helpers';
import type { User } from '@supabase/supabase-js';

export function useOrgStats(
  currentOrganization: Organization | null,
  user: User | null,
) {
  const [stats, setStats] = useState<OrganizationStats | null>(null);

  async function loadOrganizationStats() {
    if (!currentOrganization) return;

    let totalVendors = 0;
    let criticalVendors = 0;
    let activeOnboarding = 0;
    let pending1b = 0;
    let pending2nd = 0;
    let overdueTasks = 0;

    try {
      const { count, error } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id);

      if (error && isTableMissingError(error)) {
        logTableMissingError('vendors');
      } else {
        totalVendors = count || 0;
      }
    } catch (error) {
      logger.error('Error loading vendor count:', error);
    }

    try {
      const { count, error } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('is_critical', true);

      if (!error || !isTableMissingError(error)) {
        criticalVendors = count || 0;
      }
    } catch (error) {
      logger.error('Error loading critical vendor count:', error);
    }

    try {
      const { count, error } = await supabase
        .from('onboarding_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .not('status', 'in', '("approved","rejected","withdrawn","vendor_created")');

      if (error && isTableMissingError(error)) {
        logTableMissingError('onboarding_requests');
      } else {
        activeOnboarding = count || 0;
      }
    } catch (error) {
      logger.error('Error loading onboarding request count:', error);
    }

    try {
      const { count, error } = await supabase
        .from('onboarding_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('status', '1b_review');

      if (!error || !isTableMissingError(error)) {
        pending1b = count || 0;
      }
    } catch (error) {
      logger.error('Error loading 1b review count:', error);
    }

    try {
      const { count, error } = await supabase
        .from('onboarding_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('status', '2nd_review');

      if (!error || !isTableMissingError(error)) {
        pending2nd = count || 0;
      }
    } catch (error) {
      logger.error('Error loading 2nd review count:', error);
    }

    try {
      const { count, error } = await supabase
        .from('onboarding_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'overdue');

      if (error && isTableMissingError(error)) {
        logTableMissingError('onboarding_tasks');
      } else {
        overdueTasks = count || 0;
      }
    } catch (error) {
      logger.error('Error loading overdue tasks count:', error);
    }

    let avgOnboardingDays = 0;
    try {
      const { data: completedRequests } = await supabase
        .from('onboarding_requests')
        .select('created_at, completed_at')
        .eq('organization_id', currentOrganization.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (completedRequests && completedRequests.length > 0) {
        const totalDays = completedRequests.reduce((sum, r) => {
          const start = new Date(r.created_at).getTime();
          const end = new Date(r.completed_at).getTime();
          return sum + (end - start) / (1000 * 60 * 60 * 24);
        }, 0);
        avgOnboardingDays = Math.round(totalDays / completedRequests.length);
      }
    } catch {
      // onboarding_requests may not have completed_at column
    }

    setStats({
      total_vendors: totalVendors,
      critical_vendors: criticalVendors,
      active_onboarding_requests: activeOnboarding,
      pending_reviews_1b: pending1b,
      pending_reviews_2nd: pending2nd,
      overdue_tasks: overdueTasks,
      average_onboarding_days: avgOnboardingDays,
    });
  }

  useEffect(() => {
    if (currentOrganization && user) {
      loadOrganizationStats();
    }
  }, [currentOrganization, user]);

  const statsWithPendingReviews = stats
    ? {
        ...stats,
        pendingReviews: (stats.pending_reviews_1b || 0) + (stats.pending_reviews_2nd || 0),
      }
    : null;

  return {
    stats: statsWithPendingReviews,
    refreshStats: loadOrganizationStats,
  };
}

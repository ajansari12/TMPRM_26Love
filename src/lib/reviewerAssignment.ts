import { supabase } from './supabase';
import { logger } from './logger';
import type { DefenseLine } from '../types/organization';

interface ReviewerCandidate {
  user_id: string;
  business_unit?: string;
  active_count: number;
}

export async function findLeastLoadedReviewer(
  organizationId: string,
  defenseLine: DefenseLine,
  preferredBusinessUnit?: string
): Promise<string | null> {
  try {
    const { data: candidates, error: candidatesError } = await supabase
      .from('organization_users')
      .select('user_id, business_unit')
      .eq('organization_id', organizationId)
      .eq('defense_line', defenseLine)
      .eq('is_active', true)
      .eq('can_review', true);

    if (candidatesError || !candidates?.length) {
      logger.warn(`No reviewers found for defense line ${defenseLine}`);
      return null;
    }

    const userIds = candidates.map((c) => c.user_id);

    const { data: activeTasks, error: tasksError } = await supabase
      .from('onboarding_requests')
      .select('assigned_1b_reviewer, assigned_2nd_reviewer')
      .eq('organization_id', organizationId)
      .in('status', ['1b_review', '2nd_review', 'pending_senior_approval']);

    if (tasksError) {
      logger.warn('Could not fetch active tasks for assignment:', tasksError);
    }

    const loadMap: Record<string, number> = {};
    userIds.forEach((uid) => {
      loadMap[uid] = 0;
    });

    if (activeTasks) {
      activeTasks.forEach((task) => {
        const reviewer =
          defenseLine === '1b' ? task.assigned_1b_reviewer : task.assigned_2nd_reviewer;
        if (reviewer && loadMap[reviewer] !== undefined) {
          loadMap[reviewer]++;
        }
      });
    }

    const scored: ReviewerCandidate[] = candidates.map((c) => ({
      user_id: c.user_id,
      business_unit: c.business_unit,
      active_count: loadMap[c.user_id] || 0,
    }));

    scored.sort((a, b) => {
      if (preferredBusinessUnit) {
        const aMatch = a.business_unit === preferredBusinessUnit ? 0 : 1;
        const bMatch = b.business_unit === preferredBusinessUnit ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return a.active_count - b.active_count;
    });

    return scored[0]?.user_id || null;
  } catch (err) {
    logger.error('Error finding least-loaded reviewer:', err);
    return null;
  }
}

export async function findSeniorApprover(
  organizationId: string,
  effectiveTier: string
): Promise<string | null> {
  try {
    const { data: approvers, error } = await supabase
      .from('senior_approvers')
      .select('user_id, can_approve_tiers')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('is_available', true);

    if (error || !approvers?.length) {
      logger.warn('No available senior approvers found');
      return null;
    }

    const eligible = approvers.filter(
      (a) => a.can_approve_tiers?.includes(effectiveTier)
    );

    return eligible[0]?.user_id || approvers[0]?.user_id || null;
  } catch (err) {
    logger.error('Error finding senior approver:', err);
    return null;
  }
}

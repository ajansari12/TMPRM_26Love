import { supabase } from './supabase';
import { logger } from './logger';

export type EmailEventType =
  | 'request_submitted'
  | 'request_assigned'
  | 'request_returned'
  | 'request_approved'
  | 'request_rejected'
  | 'request_conditionally_approved'
  | 'vendor_created'
  | 'sla_warning'
  | 'sla_breach'
  | 'document_expiry_warning'
  | 'assessment_due_reminder'
  | 'review_reminder';

interface SendWorkflowEmailParams {
  event_type: EmailEventType;
  recipient_email: string;
  recipient_name?: string;
  organization_id: string;
  organization_name?: string;
  request_id?: string;
  request_number?: string;
  vendor_name?: string;
  actor_name?: string;
  notes?: string;
  conditions?: string;
  due_date?: string;
  days_remaining?: number;
  document_name?: string;
  link_url?: string;
}

interface EmailResult {
  success: boolean;
  email_sent?: boolean;
  email_id?: string;
  error?: string;
}

export async function sendWorkflowEmail(
  params: SendWorkflowEmailParams
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('workflow-email', {
      body: params,
    });

    if (error) {
      logger.error('Error sending workflow email:', error);
      return { success: false, error: error.message };
    }

    return data as EmailResult;
  } catch (err) {
    logger.error('Failed to send workflow email:', err);
    return { success: false, error: (err as Error).message };
  }
}

export async function notifyReviewers(
  organizationId: string,
  defenseLine: '1b' | '2nd',
  params: Omit<SendWorkflowEmailParams, 'recipient_email' | 'organization_id'>
): Promise<{ sent: number; failed: number }> {
  try {
    const { data: reviewers, error } = await supabase
      .from('organization_users')
      .select(`
        user_id,
        profiles!inner(email, full_name)
      `)
      .eq('organization_id', organizationId)
      .eq('defense_line', defenseLine)
      .eq('is_active', true);

    if (error || !reviewers?.length) {
      logger.warn('No reviewers found for defense line:', defenseLine);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const reviewer of reviewers) {
      const profile = reviewer.profiles as unknown as { email: string; full_name: string };
      if (profile?.email) {
        const result = await sendWorkflowEmail({
          ...params,
          organization_id: organizationId,
          recipient_email: profile.email,
          recipient_name: profile.full_name,
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    return { sent, failed };
  } catch (err) {
    logger.error('Error notifying reviewers:', err);
    return { sent: 0, failed: 0 };
  }
}

export async function notifyRequestor(
  requestorId: string,
  organizationId: string,
  params: Omit<SendWorkflowEmailParams, 'recipient_email' | 'organization_id'>
): Promise<EmailResult> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', requestorId)
      .maybeSingle();

    if (error || !profile?.email) {
      logger.warn('Could not find requestor email:', requestorId);
      return { success: false, error: 'Requestor email not found' };
    }

    return sendWorkflowEmail({
      ...params,
      organization_id: organizationId,
      recipient_email: profile.email,
      recipient_name: profile.full_name,
    });
  } catch (err) {
    logger.error('Error notifying requestor:', err);
    return { success: false, error: (err as Error).message };
  }
}

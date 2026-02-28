import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DocumentRequest {
  id: string;
  organization_id: string;
  vendor_id: string | null;
  document_type_code: string;
  document_type_name: string;
  vendor_name: string | null;
  vendor_contact_email: string | null;
  due_date: string;
  reminder_count: number;
  next_reminder_at: string | null;
  blocks_activation: boolean;
  is_critical: boolean;
}

interface ReminderResult {
  request_id: string;
  vendor_name: string | null;
  document_type: string;
  reminder_number: number;
  escalated: boolean;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    const { data: pendingRequests, error: fetchError } = await supabase
      .from('due_diligence_document_requests')
      .select(`
        id,
        organization_id,
        vendor_id,
        document_type_code,
        due_date,
        reminder_count,
        next_reminder_at,
        blocks_activation,
        is_critical,
        document_type:due_diligence_document_types(name)
      `)
      .eq('status', 'requested')
      .or(`next_reminder_at.lte.${today},due_date.lte.${today}`);

    if (fetchError) {
      throw new Error(`Failed to fetch pending requests: ${fetchError.message}`);
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No reminders to send",
          processed: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const vendorIds = [...new Set(pendingRequests.filter(r => r.vendor_id).map(r => r.vendor_id))];
    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, legal_name, primary_contact_email')
      .in('id', vendorIds);

    const vendorMap = new Map(vendors?.map(v => [v.id, v]) || []);

    const { data: orgConfigs } = await supabase
      .from('organization_dd_config')
      .select('*');

    const configMap = new Map(orgConfigs?.map(c => [c.organization_id, c]) || []);

    const results: ReminderResult[] = [];
    const reminderInserts: Array<{
      organization_id: string;
      document_request_id: string;
      reminder_type: string;
      reminder_number: number;
      sent_to_email: string | null;
      sent_to_name: string | null;
      escalated: boolean;
      escalation_reason: string | null;
    }> = [];

    for (const request of pendingRequests) {
      const config = configMap.get(request.organization_id);
      const maxReminders = config?.max_reminders || 3;
      const escalationThreshold = config?.escalation_after_reminders || 2;
      const reminderFrequency = config?.reminder_frequency_days || 7;

      if (config && !config.auto_send_reminders) {
        continue;
      }

      const newReminderCount = (request.reminder_count || 0) + 1;
      const shouldEscalate = newReminderCount > escalationThreshold;
      const isOverdue = new Date(request.due_date) < new Date();

      const vendor = request.vendor_id ? vendorMap.get(request.vendor_id) : null;
      const documentTypeName = (request.document_type as { name: string } | null)?.name || request.document_type_code;

      reminderInserts.push({
        organization_id: request.organization_id,
        document_request_id: request.id,
        reminder_type: isOverdue ? 'overdue' : 'standard',
        reminder_number: newReminderCount,
        sent_to_email: vendor?.primary_contact_email || null,
        sent_to_name: vendor?.legal_name || null,
        escalated: shouldEscalate,
        escalation_reason: shouldEscalate ? `${newReminderCount} reminders sent without response` : null,
      });

      const nextReminderDate = new Date();
      nextReminderDate.setDate(nextReminderDate.getDate() + reminderFrequency);

      await supabase
        .from('due_diligence_document_requests')
        .update({
          reminder_count: newReminderCount,
          last_reminder_at: new Date().toISOString(),
          next_reminder_at: newReminderCount < maxReminders ? nextReminderDate.toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      results.push({
        request_id: request.id,
        vendor_name: vendor?.legal_name || null,
        document_type: documentTypeName,
        reminder_number: newReminderCount,
        escalated: shouldEscalate,
        status: isOverdue ? 'overdue' : 'pending',
      });
    }

    if (reminderInserts.length > 0) {
      await supabase
        .from('due_diligence_request_reminders')
        .insert(reminderInserts);
    }

    const overdueCount = results.filter(r => r.status === 'overdue').length;
    const escalatedCount = results.filter(r => r.escalated).length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        overdue: overdueCount,
        escalated: escalatedCount,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing DD document reminders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

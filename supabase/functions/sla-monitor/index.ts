import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SLAConfig {
  warning_days: number;
  breach_days: number;
}

const DEFAULT_SLA_DAYS: Record<string, SLAConfig> = {
  "1b_review": { warning_days: 3, breach_days: 5 },
  "2nd_review": { warning_days: 5, breach_days: 10 },
};

async function sendWorkflowEmail(
  supabaseUrl: string,
  supabaseKey: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/workflow-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (e) {
    console.error("Failed to send workflow email:", e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const results = {
      checked: 0,
      warnings_sent: 0,
      breaches_marked: 0,
      errors: [] as string[],
    };

    const { data: pendingRequests, error: fetchError } = await supabase
      .from("onboarding_requests")
      .select(`
        id,
        organization_id,
        request_number,
        vendor_legal_name,
        status,
        current_defense_line,
        submitted_at,
        target_completion_date,
        sla_breached,
        assigned_1b_reviewer,
        assigned_2nd_reviewer,
        requested_by,
        organizations(name)
      `)
      .in("status", ["1b_review", "2nd_review"])
      .eq("sla_breached", false);

    if (fetchError) {
      throw new Error(`Failed to fetch requests: ${fetchError.message}`);
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending requests to check",
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const request of pendingRequests) {
      results.checked++;

      const submittedAt = request.submitted_at
        ? new Date(request.submitted_at)
        : null;
      const targetDate = request.target_completion_date
        ? new Date(request.target_completion_date)
        : null;

      if (!submittedAt && !targetDate) continue;

      const slaConfig = DEFAULT_SLA_DAYS[request.status] || {
        warning_days: 5,
        breach_days: 10,
      };

      let effectiveDeadline: Date;
      if (targetDate) {
        effectiveDeadline = targetDate;
      } else if (submittedAt) {
        effectiveDeadline = new Date(submittedAt);
        effectiveDeadline.setDate(
          effectiveDeadline.getDate() + slaConfig.breach_days
        );
      } else {
        continue;
      }

      const daysRemaining = Math.ceil(
        (effectiveDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const orgName =
        (request.organizations as { name: string } | null)?.name ||
        "Organization";

      const assignedReviewer =
        request.status === "1b_review"
          ? request.assigned_1b_reviewer
          : request.assigned_2nd_reviewer;

      if (daysRemaining <= 0) {
        const { error: updateError } = await supabase
          .from("onboarding_requests")
          .update({
            sla_breached: true,
            updated_at: now.toISOString(),
          })
          .eq("id", request.id);

        if (updateError) {
          results.errors.push(
            `Failed to mark breach for ${request.request_number}: ${updateError.message}`
          );
          continue;
        }

        results.breaches_marked++;

        if (assignedReviewer) {
          const { data: reviewerProfile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", assignedReviewer)
            .maybeSingle();

          if (reviewerProfile?.email) {
            await sendWorkflowEmail(supabaseUrl, supabaseServiceKey, {
              event_type: "sla_breach",
              recipient_email: reviewerProfile.email,
              recipient_name: reviewerProfile.full_name,
              organization_id: request.organization_id,
              organization_name: orgName,
              request_id: request.id,
              request_number: request.request_number,
              vendor_name: request.vendor_legal_name,
              due_date: effectiveDeadline.toISOString().split("T")[0],
              days_remaining: daysRemaining,
            });
          }
        }

        const { data: admins } = await supabase
          .from("organization_users")
          .select(
            `
            user_id,
            profiles!inner(email, full_name)
          `
          )
          .eq("organization_id", request.organization_id)
          .eq("defense_line", "admin")
          .eq("is_active", true);

        if (admins) {
          for (const admin of admins) {
            const profile = admin.profiles as unknown as {
              email: string;
              full_name: string;
            };
            if (profile?.email) {
              await sendWorkflowEmail(supabaseUrl, supabaseServiceKey, {
                event_type: "sla_breach",
                recipient_email: profile.email,
                recipient_name: profile.full_name,
                organization_id: request.organization_id,
                organization_name: orgName,
                request_id: request.id,
                request_number: request.request_number,
                vendor_name: request.vendor_legal_name,
                due_date: effectiveDeadline.toISOString().split("T")[0],
                days_remaining: daysRemaining,
              });
            }
          }
        }

        await supabase.from("onboarding_audit_log").insert({
          organization_id: request.organization_id,
          request_id: request.id,
          action_type: "sla_breach",
          action_description: `SLA breached for ${request.vendor_legal_name}`,
          performed_by_name: "System (SLA Monitor)",
          new_values: {
            days_overdue: Math.abs(daysRemaining),
            deadline: effectiveDeadline.toISOString(),
          },
        });
      } else if (
        daysRemaining <= slaConfig.warning_days &&
        daysRemaining > 0
      ) {
        if (assignedReviewer) {
          const { data: reviewerProfile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", assignedReviewer)
            .maybeSingle();

          if (reviewerProfile?.email) {
            const { data: recentNotification } = await supabase
              .from("audit_logs")
              .select("id")
              .eq("entity_id", request.id)
              .eq("action", "sla_warning_sent")
              .gte(
                "created_at",
                new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
              )
              .maybeSingle();

            if (!recentNotification) {
              const emailSent = await sendWorkflowEmail(
                supabaseUrl,
                supabaseServiceKey,
                {
                  event_type: "sla_warning",
                  recipient_email: reviewerProfile.email,
                  recipient_name: reviewerProfile.full_name,
                  organization_id: request.organization_id,
                  organization_name: orgName,
                  request_id: request.id,
                  request_number: request.request_number,
                  vendor_name: request.vendor_legal_name,
                  due_date: effectiveDeadline.toISOString().split("T")[0],
                  days_remaining: daysRemaining,
                }
              );

              if (emailSent) {
                results.warnings_sent++;

                await supabase.from("audit_logs").insert({
                  organization_id: request.organization_id,
                  action: "sla_warning_sent",
                  entity_type: "onboarding_request",
                  entity_id: request.id,
                  changes: {
                    recipient: reviewerProfile.email,
                    days_remaining: daysRemaining,
                    deadline: effectiveDeadline.toISOString(),
                  },
                });
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SLA monitoring completed",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SLA monitor error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

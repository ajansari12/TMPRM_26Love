import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReassessmentResult {
  vendorsChecked: number;
  vendorsDue30: number;
  vendorsDue14: number;
  vendorsDue7: number;
  vendorsOverdue: number;
  notificationsCreated: number;
  tasksCreated: number;
  statusUpdates: number;
  errors: string[];
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
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const result: ReassessmentResult = {
      vendorsChecked: 0,
      vendorsDue30: 0,
      vendorsDue14: 0,
      vendorsDue7: 0,
      vendorsOverdue: 0,
      notificationsCreated: 0,
      tasksCreated: 0,
      statusUpdates: 0,
      errors: [],
    };

    const { data: vendors, error: vendorsError } = await supabase
      .from("vendors")
      .select("id, legal_name, vendor_id, next_review_date, responsible_officer, status, tier, organization_id")
      .not("next_review_date", "is", null)
      .lte("next_review_date", in30Days.toISOString().split("T")[0])
      .in("status", ["active", "under_review", "review_due"]);

    if (vendorsError) {
      throw new Error(`Error fetching vendors: ${vendorsError.message}`);
    }

    result.vendorsChecked = vendors?.length || 0;

    if (vendors) {
      for (const vendor of vendors) {
        try {
          const reviewDate = new Date(vendor.next_review_date);
          const daysUntil = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          let notificationPriority: "low" | "medium" | "high" | "critical" = "medium";
          let taskPriority: "urgent" | "high" | "normal" | "low" = "normal";
          let daysBefore = 30;
          let notificationType = "reassessment_due_30";

          if (daysUntil < 0) {
            result.vendorsOverdue++;
            notificationPriority = "critical";
            taskPriority = "urgent";
            daysBefore = 0;
            notificationType = "reassessment_overdue";
          } else if (daysUntil <= 7) {
            result.vendorsDue7++;
            notificationPriority = "critical";
            taskPriority = "high";
            daysBefore = 7;
            notificationType = "reassessment_due_7";
          } else if (daysUntil <= 14) {
            result.vendorsDue14++;
            notificationPriority = "high";
            taskPriority = "high";
            daysBefore = 14;
            notificationType = "reassessment_due_14";
          } else {
            result.vendorsDue30++;
            notificationPriority = "medium";
            taskPriority = "normal";
            daysBefore = 30;
            notificationType = "reassessment_due_30";
          }

          if (daysUntil <= 30 && vendor.status === "active") {
            const { error: updateError } = await supabase
              .from("vendors")
              .update({ status: "review_due" })
              .eq("id", vendor.id);

            if (!updateError) {
              result.statusUpdates++;
            }
          }

          const { data: existingTask } = await supabase
            .from("assessment_tasks")
            .select("id, priority")
            .eq("vendor_id", vendor.id)
            .eq("task_type", "periodic_reassessment")
            .in("status", ["pending", "in_progress"])
            .maybeSingle();

          if (!existingTask) {
            const tierLabel = getTierLabel(vendor.tier);
            const { error: taskError } = await supabase
              .from("assessment_tasks")
              .insert({
                organization_id: vendor.organization_id,
                vendor_id: vendor.id,
                task_type: "periodic_reassessment",
                status: "pending",
                priority: taskPriority,
                assigned_defense_line: "1b",
                due_date: vendor.next_review_date,
                trigger_reason: `Periodic reassessment due based on review schedule. Current tier: ${tierLabel}.`,
                notes: `Periodic reassessment due for ${vendor.legal_name}. Current tier: ${tierLabel}. ${daysUntil < 0 ? "OVERDUE - Immediate action required." : `Due in ${daysUntil} days.`}`,
              });

            if (!taskError) {
              result.tasksCreated++;
            } else {
              result.errors.push(`Error creating task for vendor ${vendor.id}: ${taskError.message}`);
            }
          } else if (existingTask && shouldUpgradePriority(existingTask.priority, taskPriority)) {
            await supabase
              .from("assessment_tasks")
              .update({
                priority: taskPriority,
                notes: `Periodic reassessment due for ${vendor.legal_name}. Current tier: ${getTierLabel(vendor.tier)}. ${daysUntil < 0 ? "OVERDUE - Immediate action required." : `Due in ${daysUntil} days.`}`,
              })
              .eq("id", existingTask.id);
          }

          const { data: existingReminder } = await supabase
            .from("reassessment_reminders")
            .select("id")
            .eq("vendor_id", vendor.id)
            .eq("days_before_due", daysBefore)
            .gte("sent_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!existingReminder) {
            await supabase.from("reassessment_reminders").insert({
              vendor_id: vendor.id,
              reminder_type: notificationType,
              days_before_due: daysBefore,
              recipient_email: vendor.responsible_officer,
            });

            const tierLabel = vendor.tier ? getTierLabel(vendor.tier) : "Unknown";
            const title = daysUntil < 0
              ? `Reassessment Overdue: ${vendor.legal_name}`
              : `Reassessment Due in ${daysUntil} Days: ${vendor.legal_name}`;
            const message = daysUntil < 0
              ? `The periodic risk assessment for ${vendor.legal_name} (${vendor.vendor_id}) is overdue. Current tier: ${tierLabel}. Please complete the reassessment immediately.`
              : `The periodic risk assessment for ${vendor.legal_name} (${vendor.vendor_id}) is due in ${daysUntil} days. Current tier: ${tierLabel}. Please schedule the reassessment.`;

            await supabase.from("notifications").insert({
              organization_id: vendor.organization_id,
              type: notificationType,
              title,
              message,
              priority: notificationPriority,
              related_entity_type: "vendor",
              related_entity_id: vendor.id,
              action_url: `/assessments/reassessments`,
              target_role: "risk_manager",
            });

            result.notificationsCreated++;
          }
        } catch (vendorError) {
          result.errors.push(`Error processing vendor ${vendor.id}: ${(vendorError as Error).message}`);
        }
      }
    }

    await supabase
      .from("scheduled_jobs")
      .upsert({
        job_name: "reassessment_reminder",
        job_type: "daily",
        description: "Check for vendors due for reassessment, create tasks, and send reminders",
        is_enabled: true,
        last_run_at: now.toISOString(),
        last_run_status: result.errors.length === 0 ? "success" : "partial",
        last_run_result: result,
        next_run_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "job_name" });

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reassessment reminder error:", error);

    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getTierLabel(tier: string): string {
  const tierLabels: Record<string, string> = {
    tier_5_critical: "Critical (Tier 5)",
    tier_4_high: "High Risk (Tier 4)",
    tier_3_moderate: "Moderate Risk (Tier 3)",
    tier_2_low: "Low Risk (Tier 2)",
    tier_1_informational: "Informational (Tier 1)",
  };
  return tierLabels[tier] || tier;
}

function shouldUpgradePriority(current: string, proposed: string): boolean {
  const priorityOrder = ["low", "normal", "high", "urgent"];
  return priorityOrder.indexOf(proposed) > priorityOrder.indexOf(current);
}

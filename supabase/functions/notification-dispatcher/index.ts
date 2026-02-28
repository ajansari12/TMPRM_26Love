import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DispatchResult {
  totalNotifications: number;
  byPriority: { critical: number; high: number; medium: number; low: number };
  byType: Record<string, number>;
  digestsCompiled: number;
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
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result: DispatchResult = {
      totalNotifications: 0,
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      byType: {},
      digestsCompiled: 0,
    };

    const { data: pendingNotifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("is_read", false)
      .gte("created_at", yesterday.toISOString())
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (pendingNotifications) {
      result.totalNotifications = pendingNotifications.length;

      for (const notification of pendingNotifications) {
        if (notification.priority === "critical") result.byPriority.critical++;
        else if (notification.priority === "high") result.byPriority.high++;
        else if (notification.priority === "medium") result.byPriority.medium++;
        else result.byPriority.low++;

        const typeKey = notification.type.split("_")[0];
        result.byType[typeKey] = (result.byType[typeKey] || 0) + 1;
      }
    }

    const { data: users } = await supabase
      .from("profiles")
      .select("id, email, full_name, role");

    if (users && pendingNotifications) {
      const userNotifications: Record<string, any[]> = {};

      for (const user of users) {
        const userNotifs = pendingNotifications.filter((n) => {
          if (n.target_user_id === user.id) return true;
          if (n.target_role && n.target_role === user.role) return true;
          if (!n.target_user_id && !n.target_role) return true;
          return false;
        });

        if (userNotifs.length > 0) {
          userNotifications[user.id] = userNotifs;
        }
      }

      result.digestsCompiled = Object.keys(userNotifications).length;

      for (const [userId, notifications] of Object.entries(userNotifications)) {
        const criticalCount = notifications.filter((n) => n.priority === "critical").length;
        const highCount = notifications.filter((n) => n.priority === "high").length;

        if (criticalCount > 0 || highCount > 0) {
          console.log(`User ${userId}: ${criticalCount} critical, ${highCount} high priority notifications`);
        }
      }
    }

    const summaryByRole: Record<string, { count: number; critical: number }> = {};
    if (pendingNotifications) {
      for (const notification of pendingNotifications) {
        const role = notification.target_role || "all";
        if (!summaryByRole[role]) {
          summaryByRole[role] = { count: 0, critical: 0 };
        }
        summaryByRole[role].count++;
        if (notification.priority === "critical") {
          summaryByRole[role].critical++;
        }
      }
    }

    await supabase
      .from("scheduled_jobs")
      .update({
        last_run_at: now.toISOString(),
        last_run_status: "success",
        last_run_result: { result, summaryByRole },
        next_run_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("job_name", "notification_dispatcher");

    await supabase.from("audit_logs").insert({
      action: "notification_dispatch",
      entity_type: "system",
      entity_id: "notification_dispatcher",
      changes: {
        result,
        summaryByRole,
        executed_at: now.toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ success: true, result, summaryByRole }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notification dispatcher error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

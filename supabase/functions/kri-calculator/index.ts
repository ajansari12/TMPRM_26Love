import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface KRIResult {
  kri_code: string;
  kri_name: string;
  calculated_value: number;
  previous_value: number | null;
  change_amount: number | null;
  change_direction: "up" | "down" | "unchanged";
  status: "green" | "amber" | "red";
  threshold_breached: boolean;
}

function getStatus(
  value: number,
  threshold: any
): { status: "green" | "amber" | "red"; breached: boolean } {
  if (!threshold || !threshold.is_enabled) {
    return { status: "green", breached: false };
  }

  if (threshold.is_higher_better) {
    if (value >= (threshold.green_min || 0)) return { status: "green", breached: false };
    if (value >= (threshold.amber_min || 0)) return { status: "amber", breached: threshold.notify_on_amber };
    return { status: "red", breached: true };
  } else {
    if (value <= (threshold.green_max || 100)) return { status: "green", breached: false };
    if (value <= (threshold.amber_max || 100)) return { status: "amber", breached: threshold.notify_on_amber };
    return { status: "red", breached: true };
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

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const { data: thresholds } = await supabase
      .from("kri_thresholds")
      .select("*")
      .order("display_order");

    const { data: vendors } = await supabase.from("vendors").select("*");
    const { data: assessments } = await supabase.from("tiering_assessments").select("*");
    const { data: dueDiligence } = await supabase.from("due_diligence").select("*");
    const { data: contracts } = await supabase.from("contracts").select("*");
    const { data: incidents } = await supabase.from("incidents").select("*");
    const { data: subcontractors } = await supabase.from("subcontractors").select("*");
    const { data: performanceReviews } = await supabase.from("performance_reviews").select("*");

    const { data: previousHistory } = await supabase
      .from("kri_history")
      .select("*")
      .lt("recorded_date", today)
      .order("recorded_date", { ascending: false })
      .limit(8);

    const previousValues: Record<string, number> = {};
    if (previousHistory) {
      for (const h of previousHistory) {
        if (!previousValues[h.kri_code]) {
          previousValues[h.kri_code] = h.calculated_value;
        }
      }
    }

    const results: KRIResult[] = [];
    const notificationsToCreate: any[] = [];

    const totalVendors = vendors?.length || 0;
    const criticalVendors = vendors?.filter((v) => v.tier === "tier_5_critical" || v.is_critical).length || 0;
    const criticalConcentration = totalVendors > 0 ? (criticalVendors / totalVendors) * 100 : 0;

    const kri001Threshold = thresholds?.find((t) => t.kri_code === "KRI001");
    const kri001Status = getStatus(criticalConcentration, kri001Threshold);
    const kri001Prev = previousValues["KRI001"] ?? null;
    results.push({
      kri_code: "KRI001",
      kri_name: "Critical Vendor Concentration",
      calculated_value: criticalConcentration,
      previous_value: kri001Prev,
      change_amount: kri001Prev !== null ? criticalConcentration - kri001Prev : null,
      change_direction: kri001Prev === null ? "unchanged" : criticalConcentration > kri001Prev ? "up" : criticalConcentration < kri001Prev ? "down" : "unchanged",
      status: kri001Status.status,
      threshold_breached: kri001Status.breached,
    });

    const completedAssessments = assessments?.filter((a) => a.status === "approved").length || 0;
    const totalRequiredAssessments = (completedAssessments + (assessments?.filter((a) => ["draft", "in_progress", "pending_review"].includes(a.status)).length || 0)) || 1;
    const assessmentCompletion = (completedAssessments / totalRequiredAssessments) * 100;

    const kri002Threshold = thresholds?.find((t) => t.kri_code === "KRI002");
    const kri002Status = getStatus(assessmentCompletion, kri002Threshold);
    const kri002Prev = previousValues["KRI002"] ?? null;
    results.push({
      kri_code: "KRI002",
      kri_name: "Assessment Completion Rate",
      calculated_value: assessmentCompletion,
      previous_value: kri002Prev,
      change_amount: kri002Prev !== null ? assessmentCompletion - kri002Prev : null,
      change_direction: kri002Prev === null ? "unchanged" : assessmentCompletion > kri002Prev ? "up" : assessmentCompletion < kri002Prev ? "down" : "unchanged",
      status: kri002Status.status,
      threshold_breached: kri002Status.breached,
    });

    const completedDD = dueDiligence?.filter((d) => d.status === "completed" || d.final_rating).length || 0;
    const totalDD = dueDiligence?.length || 1;
    const ddCompletion = (completedDD / totalDD) * 100;

    const kri003Threshold = thresholds?.find((t) => t.kri_code === "KRI003");
    const kri003Status = getStatus(ddCompletion, kri003Threshold);
    const kri003Prev = previousValues["KRI003"] ?? null;
    results.push({
      kri_code: "KRI003",
      kri_name: "Due Diligence Compliance",
      calculated_value: ddCompletion,
      previous_value: kri003Prev,
      change_amount: kri003Prev !== null ? ddCompletion - kri003Prev : null,
      change_direction: kri003Prev === null ? "unchanged" : ddCompletion > kri003Prev ? "up" : ddCompletion < kri003Prev ? "down" : "unchanged",
      status: kri003Status.status,
      threshold_breached: kri003Status.breached,
    });

    const expiringContracts = contracts?.filter((c) => {
      if (!c.expiry_date) return false;
      const expiry = new Date(c.expiry_date);
      return expiry > now && expiry <= in90Days;
    }).length || 0;

    const kri004Threshold = thresholds?.find((t) => t.kri_code === "KRI004");
    const kri004Status = getStatus(expiringContracts, kri004Threshold);
    const kri004Prev = previousValues["KRI004"] ?? null;
    results.push({
      kri_code: "KRI004",
      kri_name: "Contract Expiry Alert",
      calculated_value: expiringContracts,
      previous_value: kri004Prev,
      change_amount: kri004Prev !== null ? expiringContracts - kri004Prev : null,
      change_direction: kri004Prev === null ? "unchanged" : expiringContracts > kri004Prev ? "up" : expiringContracts < kri004Prev ? "down" : "unchanged",
      status: kri004Status.status,
      threshold_breached: kri004Status.breached,
    });

    const openIncidents = incidents?.filter((i) => !["resolved", "closed"].includes(i.status)).length || 0;

    const kri005Threshold = thresholds?.find((t) => t.kri_code === "KRI005");
    const kri005Status = getStatus(openIncidents, kri005Threshold);
    const kri005Prev = previousValues["KRI005"] ?? null;
    results.push({
      kri_code: "KRI005",
      kri_name: "Open Incident Count",
      calculated_value: openIncidents,
      previous_value: kri005Prev,
      change_amount: kri005Prev !== null ? openIncidents - kri005Prev : null,
      change_direction: kri005Prev === null ? "unchanged" : openIncidents > kri005Prev ? "up" : openIncidents < kri005Prev ? "down" : "unchanged",
      status: kri005Status.status,
      threshold_breached: kri005Status.breached,
    });

    const totalIncidents = incidents?.length || 1;
    const criticalIncidents = incidents?.filter((i) => i.severity === "critical").length || 0;
    const criticalIncidentRate = (criticalIncidents / totalIncidents) * 100;

    const kri006Threshold = thresholds?.find((t) => t.kri_code === "KRI006");
    const kri006Status = getStatus(criticalIncidentRate, kri006Threshold);
    const kri006Prev = previousValues["KRI006"] ?? null;
    results.push({
      kri_code: "KRI006",
      kri_name: "Critical Incident Rate",
      calculated_value: criticalIncidentRate,
      previous_value: kri006Prev,
      change_amount: kri006Prev !== null ? criticalIncidentRate - kri006Prev : null,
      change_direction: kri006Prev === null ? "unchanged" : criticalIncidentRate > kri006Prev ? "up" : criticalIncidentRate < kri006Prev ? "down" : "unchanged",
      status: kri006Status.status,
      threshold_breached: kri006Status.breached,
    });

    const totalSubs = subcontractors?.length || 1;
    const approvedSubs = subcontractors?.filter((s) => s.status === "approved").length || 0;
    const subOversight = (approvedSubs / totalSubs) * 100;

    const kri007Threshold = thresholds?.find((t) => t.kri_code === "KRI007");
    const kri007Status = getStatus(subOversight, kri007Threshold);
    const kri007Prev = previousValues["KRI007"] ?? null;
    results.push({
      kri_code: "KRI007",
      kri_name: "Subcontractor Oversight",
      calculated_value: subOversight,
      previous_value: kri007Prev,
      change_amount: kri007Prev !== null ? subOversight - kri007Prev : null,
      change_direction: kri007Prev === null ? "unchanged" : subOversight > kri007Prev ? "up" : subOversight < kri007Prev ? "down" : "unchanged",
      status: kri007Status.status,
      threshold_breached: kri007Status.breached,
    });

    const reviewsWithSLA = performanceReviews?.filter((r) => r.sla_compliance_percentage !== null) || [];
    const avgSLA = reviewsWithSLA.length > 0
      ? reviewsWithSLA.reduce((sum, r) => sum + (r.sla_compliance_percentage || 0), 0) / reviewsWithSLA.length
      : 100;

    const kri008Threshold = thresholds?.find((t) => t.kri_code === "KRI008");
    const kri008Status = getStatus(avgSLA, kri008Threshold);
    const kri008Prev = previousValues["KRI008"] ?? null;
    results.push({
      kri_code: "KRI008",
      kri_name: "Performance SLA Compliance",
      calculated_value: avgSLA,
      previous_value: kri008Prev,
      change_amount: kri008Prev !== null ? avgSLA - kri008Prev : null,
      change_direction: kri008Prev === null ? "unchanged" : avgSLA > kri008Prev ? "up" : avgSLA < kri008Prev ? "down" : "unchanged",
      status: kri008Status.status,
      threshold_breached: kri008Status.breached,
    });

    for (const kri of results) {
      await supabase.from("kri_history").upsert(
        {
          recorded_date: today,
          kri_code: kri.kri_code,
          calculated_value: kri.calculated_value,
          previous_value: kri.previous_value,
          change_amount: kri.change_amount,
          change_direction: kri.change_direction,
          status: kri.status,
          threshold_breached: kri.threshold_breached,
        },
        { onConflict: "recorded_date,kri_code" }
      );

      if (kri.threshold_breached) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("type", `kri_breach_${kri.kri_code}`)
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existing) {
          notificationsToCreate.push({
            type: `kri_breach_${kri.kri_code}`,
            title: `KRI Threshold Breach: ${kri.kri_name}`,
            message: `${kri.kri_name} is at ${kri.calculated_value.toFixed(1)} (${kri.status.toUpperCase()}). Review required.`,
            priority: kri.status === "red" ? "critical" : "high",
            related_entity_type: "kri",
            related_entity_id: kri.kri_code,
            action_url: "/kri",
            target_role: "risk_manager",
          });
        }
      }
    }

    if (notificationsToCreate.length > 0) {
      await supabase.from("notifications").insert(notificationsToCreate);
    }

    await supabase
      .from("scheduled_jobs")
      .update({
        last_run_at: now.toISOString(),
        last_run_status: "success",
        last_run_result: { results, notificationsCreated: notificationsToCreate.length },
        next_run_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("job_name", "kri_calculator");

    return new Response(
      JSON.stringify({ success: true, results, notificationsCreated: notificationsToCreate.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("KRI calculator error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PortfolioInsight {
  summary: string;
  key_risks: string[];
  concentration_alerts: string[];
  compliance_gaps: string[];
  recommendations: string[];
  risk_trend: "improving" | "stable" | "deteriorating";
  generated_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: "organization_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Gather portfolio data
    const [vendorsRes, incidentsRes, assessmentsRes] = await Promise.all([
      supabase
        .from("vendors")
        .select(
          "id, legal_name, tier, risk_rating, service_category, country, is_critical, status, contract_value_cad"
        )
        .eq("organization_id", organization_id)
        .in("status", ["active", "under_review", "pending_assessment"]),
      supabase
        .from("incidents")
        .select("id, severity, status, vendor_id, reported_date")
        .eq("organization_id", organization_id)
        .gte(
          "reported_date",
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        ),
      supabase
        .from("tiering_assessments")
        .select("id, vendor_id, risk_rating, status, assessment_date")
        .eq("organization_id", organization_id)
        .order("assessment_date", { ascending: false })
        .limit(100),
    ]);

    const vendors = vendorsRes.data || [];
    const incidents = incidentsRes.data || [];
    const assessments = assessmentsRes.data || [];

    // Build portfolio summary
    const portfolioSummary = {
      total_vendors: vendors.length,
      critical_vendors: vendors.filter((v) => v.is_critical || v.tier === "tier_5_critical").length,
      high_risk: vendors.filter((v) => v.tier === "tier_4_high").length,
      total_spend: vendors.reduce((s, v) => s + (v.contract_value_cad || 0), 0),
      avg_risk_rating: vendors.length > 0
        ? vendors.reduce((s, v) => s + (v.risk_rating || 0), 0) / vendors.length
        : 0,
      open_incidents: incidents.filter((i) => !["resolved", "closed"].includes(i.status)).length,
      critical_incidents: incidents.filter((i) => i.severity === "critical").length,
      recent_assessments: assessments.filter((a) => a.status === "approved").length,
      countries: [...new Set(vendors.map((v) => v.country))].length,
      categories: [...new Set(vendors.map((v) => v.service_category))].length,
      top_vendors_by_risk: vendors
        .filter((v) => v.risk_rating)
        .sort((a, b) => (b.risk_rating || 0) - (a.risk_rating || 0))
        .slice(0, 5)
        .map((v) => ({ name: v.legal_name, rating: v.risk_rating, tier: v.tier })),
    };

    let insight: PortfolioInsight;

    if (anthropicKey) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: `You are a TPRM (Third-Party Risk Management) portfolio analyst. Analyze the vendor portfolio data and generate an executive briefing. Return JSON:
{
  "summary": "2-3 sentence executive overview",
  "key_risks": ["top 3-5 portfolio-level risks"],
  "concentration_alerts": ["concentration risk observations"],
  "compliance_gaps": ["OSFI B-10 or regulatory gaps"],
  "recommendations": ["3-5 actionable recommendations"],
  "risk_trend": "improving" | "stable" | "deteriorating"
}`,
          messages: [
            {
              role: "user",
              content: `Generate portfolio insights for this TPRM portfolio:\n${JSON.stringify(portfolioSummary, null, 2)}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const text = aiData.content?.[0]?.text || "{}";
        let jsonStr = text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        const parsed = JSON.parse(jsonStr);
        insight = {
          ...parsed,
          generated_at: new Date().toISOString(),
        };
      } else {
        insight = generateRuleBasedInsights(portfolioSummary);
      }
    } else {
      insight = generateRuleBasedInsights(portfolioSummary);
    }

    // Store insight
    await supabase.from("portfolio_insights").upsert(
      {
        organization_id,
        insight_json: insight,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );

    return new Response(
      JSON.stringify({ success: true, data: insight }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Insights generation failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateRuleBasedInsights(summary: any): PortfolioInsight {
  const risks: string[] = [];
  const recommendations: string[] = [];
  const concentrationAlerts: string[] = [];
  const complianceGaps: string[] = [];

  if (summary.critical_vendors > summary.total_vendors * 0.3) {
    risks.push(
      `${summary.critical_vendors} critical vendors (${((summary.critical_vendors / summary.total_vendors) * 100).toFixed(0)}% of portfolio) — high systemic risk`
    );
  }

  if (summary.open_incidents > 0) {
    risks.push(
      `${summary.open_incidents} unresolved incidents, including ${summary.critical_incidents} critical`
    );
    recommendations.push("Prioritize resolution of critical incidents within SLA timeframes");
  }

  if (summary.countries > 5) {
    concentrationAlerts.push(
      `Portfolio spans ${summary.countries} countries — ensure jurisdictional compliance for each`
    );
  }

  if (summary.avg_risk_rating > 12) {
    risks.push(`Average portfolio risk rating (${summary.avg_risk_rating.toFixed(1)}) is elevated`);
    recommendations.push("Review high-risk vendor relationships for mitigation opportunities");
  }

  recommendations.push("Ensure all critical vendors have current assessments within OSFI review cycles");
  recommendations.push("Verify concentration thresholds are set and monitored for all dimensions");

  const trend: PortfolioInsight["risk_trend"] =
    summary.avg_risk_rating > 12 ? "deteriorating" :
    summary.avg_risk_rating < 8 ? "improving" : "stable";

  return {
    summary: `Your portfolio has ${summary.total_vendors} active vendors with ${summary.critical_vendors} classified as critical. The average risk rating is ${summary.avg_risk_rating.toFixed(1)}/25 with $${(summary.total_spend / 1000000).toFixed(1)}M in total managed spend.`,
    key_risks: risks.length > 0 ? risks : ["No significant portfolio-level risks detected"],
    concentration_alerts: concentrationAlerts.length > 0 ? concentrationAlerts : ["No concentration alerts"],
    compliance_gaps: complianceGaps.length > 0 ? complianceGaps : ["No major compliance gaps identified"],
    recommendations,
    risk_trend: trend,
    generated_at: new Date().toISOString(),
  };
}

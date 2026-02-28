import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MonitoringSignal {
  vendor_id: string;
  organization_id: string;
  signal_type: "news" | "regulatory" | "financial" | "cyber";
  severity: "info" | "warning" | "critical";
  title: string;
  summary: string;
  source_url?: string;
  ai_confidence: number;
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
    const { vendor_id, organization_id } = body;

    // If specific vendor_id provided, scan just that vendor
    // Otherwise scan all active vendors for the organization
    let vendors: Array<{
      id: string;
      legal_name: string;
      country: string;
      service_category: string;
      tier: string;
      organization_id: string;
    }> = [];

    if (vendor_id && organization_id) {
      const { data } = await supabase
        .from("vendors")
        .select(
          "id, legal_name, country, service_category, tier, organization_id"
        )
        .eq("id", vendor_id)
        .eq("organization_id", organization_id)
        .single();
      if (data) vendors = [data];
    } else if (organization_id) {
      // Scan critical and high-risk vendors
      const { data } = await supabase
        .from("vendors")
        .select(
          "id, legal_name, country, service_category, tier, organization_id"
        )
        .eq("organization_id", organization_id)
        .in("status", ["active", "under_review"])
        .in("tier", ["tier_5_critical", "tier_4_high"])
        .limit(20);
      vendors = data || [];
    }

    if (vendors.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No vendors to scan",
          signals: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allSignals: MonitoringSignal[] = [];

    for (const vendor of vendors) {
      if (!anthropicKey) {
        // Without API key, generate placeholder signals based on vendor profile
        const signals = generateRuleBasedSignals(vendor);
        allSignals.push(...signals);
        continue;
      }

      try {
        const response = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              system: `You are a third-party risk monitoring analyst. Given a vendor's profile, generate relevant monitoring signals based on known industry risks, regulatory changes, and common issues for vendors in this sector and geography.

Return a JSON array of signals:
[{
  "signal_type": "news" | "regulatory" | "financial" | "cyber",
  "severity": "info" | "warning" | "critical",
  "title": "Brief signal title",
  "summary": "1-2 sentence explanation",
  "confidence": 0.0-1.0
}]

Only return signals that are plausible for the vendor's profile. Return an empty array if no notable signals exist. Focus on actionable risk intelligence.`,
              messages: [
                {
                  role: "user",
                  content: `Analyze monitoring signals for this vendor:
Name: ${vendor.legal_name}
Country: ${vendor.country}
Service Category: ${vendor.service_category}
Risk Tier: ${vendor.tier}

Generate relevant risk monitoring signals based on typical risks for this type of vendor.`,
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const aiData = await response.json();
          const text =
            aiData.content?.[0]?.text || "[]";

          // Extract JSON from response
          let jsonStr = text;
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          const signals = JSON.parse(jsonStr);
          if (Array.isArray(signals)) {
            for (const signal of signals) {
              allSignals.push({
                vendor_id: vendor.id,
                organization_id: vendor.organization_id,
                signal_type: signal.signal_type || "news",
                severity: signal.severity || "info",
                title: signal.title || "Monitoring signal",
                summary: signal.summary || "",
                ai_confidence: signal.confidence || 0.5,
              });
            }
          }
        }
      } catch (aiError) {
        // Fall back to rule-based signals on AI failure
        const signals = generateRuleBasedSignals(vendor);
        allSignals.push(...signals);
      }
    }

    // Store signals in database
    if (allSignals.length > 0) {
      const { error: insertError } = await supabase
        .from("monitoring_signals")
        .insert(allSignals);

      if (insertError) {
        console.error("Error inserting signals:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        vendors_scanned: vendors.length,
        signals_generated: allSignals.length,
        signals: allSignals,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Monitoring scanner error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Scanner failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateRuleBasedSignals(vendor: {
  id: string;
  legal_name: string;
  country: string;
  service_category: string;
  tier: string;
  organization_id: string;
}): MonitoringSignal[] {
  const signals: MonitoringSignal[] = [];

  // High-risk geography check
  const highRiskCountries = [
    "Russia",
    "China",
    "Iran",
    "North Korea",
    "Belarus",
    "Myanmar",
  ];
  if (highRiskCountries.some((c) => vendor.country?.includes(c))) {
    signals.push({
      vendor_id: vendor.id,
      organization_id: vendor.organization_id,
      signal_type: "regulatory",
      severity: "critical",
      title: "High-risk jurisdiction exposure",
      summary: `${vendor.legal_name} operates in ${vendor.country}, which is subject to enhanced regulatory scrutiny and sanctions risk.`,
      ai_confidence: 0.95,
    });
  }

  // Critical vendor without recent review
  if (vendor.tier === "tier_5_critical") {
    signals.push({
      vendor_id: vendor.id,
      organization_id: vendor.organization_id,
      signal_type: "regulatory",
      severity: "info",
      title: "Critical vendor monitoring reminder",
      summary: `${vendor.legal_name} is classified as critical (Tier 5). Ensure quarterly monitoring reviews are current per OSFI B-10 requirements.`,
      ai_confidence: 0.9,
    });
  }

  // Cyber risk for tech/data vendors
  if (
    ["cloud_data_services", "it_telecom_services", "info_cyber_security"].includes(
      vendor.service_category
    )
  ) {
    signals.push({
      vendor_id: vendor.id,
      organization_id: vendor.organization_id,
      signal_type: "cyber",
      severity: "info",
      title: "Technology vendor cyber posture review",
      summary: `Recommend periodic review of ${vendor.legal_name}'s security certifications and recent vulnerability disclosures for ${vendor.service_category.replace(/_/g, " ")} services.`,
      ai_confidence: 0.7,
    });
  }

  return signals;
}

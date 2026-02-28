import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RegulatoryUpdate {
  source: string;
  title: string;
  summary: string;
  impact_analysis: string;
  affected_areas: string[];
  severity: "low" | "medium" | "high";
  effective_date?: string;
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

    let updates: RegulatoryUpdate[] = [];

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
          max_tokens: 2000,
          system: `You are a regulatory monitoring analyst specializing in Canadian financial services third-party risk management. Based on your knowledge, identify recent or upcoming regulatory changes relevant to TPRM from these sources:

- OSFI (Office of the Superintendent of Financial Institutions) — B-10 guideline updates
- DORA (Digital Operational Resilience Act) — EU regulation affecting Canadian FIs with EU operations
- OCC (Office of the Comptroller of the Currency) — US third-party risk guidance
- Privacy regulations (PIPEDA amendments, provincial privacy laws)
- ESG and climate risk disclosure requirements
- Cybersecurity regulations affecting vendor management

Return a JSON array of regulatory updates:
[{
  "source": "OSFI" | "DORA" | "OCC" | "Privacy" | "ESG" | "Cyber",
  "title": "Brief title of the change",
  "summary": "2-3 sentence description",
  "impact_analysis": "How this affects TPRM practices",
  "affected_areas": ["assessment", "monitoring", "contracts", "reporting", "exit_strategy"],
  "severity": "low" | "medium" | "high",
  "effective_date": "YYYY-MM-DD or null"
}]

Focus on changes from the past 12 months and upcoming requirements. Return 3-5 updates.`,
          messages: [
            {
              role: "user",
              content:
                "Scan for recent and upcoming regulatory changes affecting third-party risk management for Canadian financial institutions. Focus on OSFI B-10, DORA, privacy, cybersecurity, and ESG requirements.",
            },
          ],
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const text = aiData.content?.[0]?.text || "[]";
        let jsonStr = text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        updates = JSON.parse(jsonStr);
      }
    }

    // Fallback to known regulatory items
    if (updates.length === 0) {
      updates = getKnownRegulatoryUpdates();
    }

    // Store updates
    for (const update of updates) {
      await supabase.from("regulatory_updates").upsert(
        {
          organization_id,
          source: update.source,
          title: update.title,
          summary: update.summary,
          impact_analysis: update.impact_analysis,
          affected_areas: update.affected_areas,
          severity: update.severity,
          effective_date: update.effective_date || null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,title" }
      );
    }

    return new Response(
      JSON.stringify({ success: true, updates_count: updates.length, data: updates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Regulatory monitor failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getKnownRegulatoryUpdates(): RegulatoryUpdate[] {
  return [
    {
      source: "OSFI",
      title: "OSFI B-10 Third-Party Risk Management Guideline Updates",
      summary:
        "OSFI continues to refine expectations for third-party risk management, emphasizing concentration risk monitoring, nth-party oversight, and technology resilience requirements for FRFIs.",
      impact_analysis:
        "Requires enhanced concentration risk analysis, subcontractor oversight documentation, and regular reassessment of critical third parties at defined intervals.",
      affected_areas: ["assessment", "monitoring", "contracts"],
      severity: "high",
    },
    {
      source: "DORA",
      title: "DORA ICT Third-Party Risk Requirements",
      summary:
        "The EU Digital Operational Resilience Act establishes requirements for ICT third-party risk management, incident reporting, and digital operational resilience testing applicable to financial entities.",
      impact_analysis:
        "Canadian FIs with EU operations must align their ICT vendor management with DORA requirements including contractual provisions for ICT services and exit strategy documentation.",
      affected_areas: ["contracts", "monitoring", "exit_strategy"],
      severity: "medium",
      effective_date: "2025-01-17",
    },
    {
      source: "Privacy",
      title: "Enhanced Privacy Requirements for Vendor Data Processing",
      summary:
        "Evolving Canadian privacy legislation (CPPA/Bill C-27 successor) and provincial privacy laws create new requirements for vendor data processing agreements and cross-border data transfers.",
      impact_analysis:
        "Vendors handling personal information require updated data processing agreements, privacy impact assessments, and documented data residency controls.",
      affected_areas: ["contracts", "assessment"],
      severity: "medium",
    },
    {
      source: "Cyber",
      title: "Cybersecurity Incident Reporting Requirements",
      summary:
        "New mandatory cybersecurity incident reporting frameworks require financial institutions to report significant cyber incidents involving third parties within defined timeframes.",
      impact_analysis:
        "Vendor contracts must include incident notification SLAs. Assessment questionnaires should verify vendor incident response capabilities and reporting processes.",
      affected_areas: ["contracts", "monitoring", "reporting"],
      severity: "high",
    },
    {
      source: "ESG",
      title: "Climate-Related Financial Disclosure Requirements",
      summary:
        "OSFI climate risk management guidelines and ISSB standards require financial institutions to assess and disclose climate-related risks in their supply chain, including third-party exposures.",
      impact_analysis:
        "Vendor assessments should incorporate ESG criteria. Board reporting must include third-party ESG risk exposure. Supply chain emissions (Scope 3) require vendor-level tracking.",
      affected_areas: ["assessment", "reporting"],
      severity: "medium",
    },
  ];
}

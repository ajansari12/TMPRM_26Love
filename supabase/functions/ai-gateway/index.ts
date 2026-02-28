import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Supported AI actions
type AIAction =
  | "assess-assist"
  | "document-analyze"
  | "risk-summarize"
  | "risk-predict"
  | "query";

interface AIGatewayRequest {
  action: AIAction;
  payload: Record<string, unknown>;
  vendor_id?: string;
  organization_id: string;
  user_id: string;
}

interface AIGatewayResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  usage?: {
    tokens_input: number;
    tokens_output: number;
  };
}

// --- System Prompts ---

const SYSTEM_PROMPTS: Record<AIAction, string> = {
  "assess-assist": `You are an expert Third-Party Risk Management (TPRM) analyst specializing in OSFI B-10 compliance for Canadian financial institutions.

Given a vendor's profile and the assessment questions, provide suggested answers with confidence levels and reasoning.

IMPORTANT RULES:
- Base suggestions on the vendor's known characteristics (name, industry, service category, country, provider type)
- For reassessments, compare against previous answers and note changes
- Assign confidence: "high" for well-known vendors or clear-cut answers, "medium" for reasonable inferences, "low" for speculative answers
- Always provide brief reasoning (1-2 sentences) for each suggestion
- Format each suggestion as: { question_id, suggested_value, confidence, reasoning }
- If you cannot make a reasonable suggestion, omit that question
- Never fabricate specific certifications, dates, or financial figures — use qualitative assessments instead

Respond ONLY with valid JSON matching this schema:
{
  "suggestions": [
    {
      "question_id": "string",
      "suggested_value": "string | string[]",
      "confidence": "high" | "medium" | "low",
      "reasoning": "string"
    }
  ],
  "vendor_context": "string (1-2 sentence summary of what you know about this vendor)"
}`,

  "document-analyze": `You are an expert document analyst for a Third-Party Risk Management program under OSFI B-10 regulatory framework.

Analyze the provided document text and extract:
1. Document type (SOC 2 report, insurance certificate, contract, policy, audit report, etc.)
2. Key findings and notable items
3. Compliance gaps relative to OSFI B-10 requirements
4. Expiry dates or validity periods
5. Risk flags (anything concerning)
6. Extracted structured data (certifications held, coverage amounts, etc.)

For contracts, check against these 15 OSFI provisions:
scope_of_services, roles_responsibilities, subcontracting, pricing_payment, performance_slas, data_ownership, data_security, incident_notification, dispute_resolution, regulatory_compliance, business_continuity, termination, insurance, audit_rights, osfi_access

Respond ONLY with valid JSON matching this schema:
{
  "document_type": "string",
  "key_findings": ["string"],
  "compliance_gaps": ["string"],
  "expiry_dates": [{ "item": "string", "date": "string", "days_until_expiry": number }],
  "risk_flags": [{ "severity": "high" | "medium" | "low", "description": "string" }],
  "extracted_data": {},
  "osfi_provisions": { "provision_key": "present" | "missing" | "partial" }
}`,

  "risk-summarize": `You are a senior risk advisor writing executive risk summaries for a Canadian financial institution's Third-Party Risk Management program under OSFI B-10.

Given a vendor's complete risk profile (assessment scores, incidents, SLA performance, contract status, OSFI compliance), generate a clear, actionable executive summary.

Structure your response as:
{
  "overview": "2-3 sentence executive summary of the vendor's risk posture",
  "key_risks": ["Top 3-5 risk drivers with specific details"],
  "strengths": ["2-3 positive aspects of the vendor relationship"],
  "recommendations": ["3-5 specific, actionable recommendations"],
  "osfi_gaps": ["Any OSFI B-10 compliance gaps identified"],
  "risk_trend": "improving" | "stable" | "deteriorating",
  "confidence": "high" | "medium" | "low"
}

Be specific and reference actual data points. Avoid generic statements. Write for a board-level audience.`,

  "risk-predict": `You are a predictive risk analyst for a Third-Party Risk Management program.

Given a vendor's historical data (assessment scores over time, incident history, SLA trends, monitoring signals, contract timeline), predict the risk trajectory.

Analyze patterns and provide:
{
  "predicted_score_6m": number (1-25 scale),
  "predicted_score_12m": number (1-25 scale),
  "confidence_interval": { "low": number, "high": number },
  "trajectory": "improving" | "stable" | "deteriorating",
  "risk_factors": [
    { "factor": "string", "direction": "increasing" | "decreasing" | "stable", "impact": "high" | "medium" | "low" }
  ],
  "tier_change_risk": { "likely": boolean, "from_tier": string | null, "to_tier": string | null },
  "reasoning": "string (2-3 sentences explaining the prediction)"
}

Base predictions on observable trends. Be conservative with confidence intervals. Flag when data is insufficient for reliable prediction.`,

  query: `You are a TPRM data analyst helping users query their vendor risk management portfolio.

The user will ask natural language questions about their vendors, assessments, contracts, incidents, and risk metrics. Your database contains:
- vendors (legal_name, service_category, tier, risk_rating, status, country, contract_value_cad, is_critical, next_review_date)
- tiering_assessments (vendor_id, risk_rating, impact_score, likelihood_score, calculated_tier, assessment_type, created_at)
- contracts (vendor_id, title, expiry_date, annual_value_cad, status)
- incidents (vendor_id, title, severity, status, incident_type, detected_date)
- fourth_parties (vendor_id, name, country, criticality)
- risk_exceptions (vendor_id, title, status, expiry_date, residual_risk_level)

Respond with:
{
  "answer": "Natural language answer to the user's question",
  "entities": [{ "type": "vendor" | "assessment" | "contract" | "incident", "id": "uuid or null", "label": "display name" }],
  "data_summary": {} (optional structured data if the question asks for counts, aggregations, etc.),
  "follow_up_suggestions": ["2-3 related questions the user might want to ask next"]
}

If you need data you don't have, explain what additional information would help. Never make up specific vendor names or data — work with what's provided in the context.`,
};

// --- Main Handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ANTHROPIC_API_KEY not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: AIGatewayRequest = await req.json();
    const { action, payload, vendor_id, organization_id, user_id } = body;

    if (!action || !SYSTEM_PROMPTS[action]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid action: ${action}. Valid actions: ${Object.keys(SYSTEM_PROMPTS).join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build the user message from the payload
    const userMessage = JSON.stringify(payload, null, 2);

    // Call Anthropic Claude API
    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPTS[action],
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
      }
    );

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error("Anthropic API error:", errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `AI service error: ${anthropicResponse.status}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiResult = await anthropicResponse.json();
    const responseText =
      aiResult.content?.[0]?.type === "text"
        ? aiResult.content[0].text
        : null;

    if (!responseText) {
      return new Response(
        JSON.stringify({ success: false, error: "No response from AI" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the JSON response from Claude
    let parsedData: unknown;
    try {
      // Extract JSON from markdown code fences if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      parsedData = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, return raw text wrapped in an object
      parsedData = { raw_response: responseText };
    }

    const usage = {
      tokens_input: aiResult.usage?.input_tokens || 0,
      tokens_output: aiResult.usage?.output_tokens || 0,
    };

    // Log usage to database
    const { data: logEntry } = await supabase
      .from("ai_usage_log")
      .insert({
        organization_id,
        user_id,
        action,
        model: aiResult.model || "claude-sonnet-4-20250514",
        tokens_input: usage.tokens_input,
        tokens_output: usage.tokens_output,
        vendor_id: vendor_id || null,
      })
      .select("id")
      .single();

    const response: AIGatewayResponse = {
      success: true,
      data: parsedData,
      usage,
    };

    // Include log_id for feedback linking
    if (logEntry) {
      (response as Record<string, unknown>).log_id = logEntry.id;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI Gateway error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

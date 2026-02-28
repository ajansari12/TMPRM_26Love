import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExpirationResult {
  contracts: { expiring90: number; expiring60: number; expiring30: number; expiring14: number; expiring7: number };
  assessments: { due30: number; due14: number; due7: number; overdue: number };
  dueDiligence: { due30: number; due14: number; due7: number; overdue: number };
  documents: { expiring30: number; expiring14: number; expiring7: number; expired: number; statusUpdated: number };
  notificationsCreated: number;
  emailsSent: number;
}

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
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const result: ExpirationResult = {
      contracts: { expiring90: 0, expiring60: 0, expiring30: 0, expiring14: 0, expiring7: 0 },
      assessments: { due30: 0, due14: 0, due7: 0, overdue: 0 },
      dueDiligence: { due30: 0, due14: 0, due7: 0, overdue: 0 },
      documents: { expiring30: 0, expiring14: 0, expiring7: 0, expired: 0, statusUpdated: 0 },
      notificationsCreated: 0,
      emailsSent: 0,
    };

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, title, vendor_id, expiry_date")
      .not("expiry_date", "is", null)
      .gte("expiry_date", now.toISOString().split("T")[0])
      .lte("expiry_date", in90Days.toISOString().split("T")[0]);

    if (contracts) {
      for (const contract of contracts) {
        const expiryDate = new Date(contract.expiry_date);
        const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let priority = "low";
        let notificationType = "";

        if (daysUntil <= 7) {
          result.contracts.expiring7++;
          priority = "critical";
          notificationType = "contract_expiring_7";
        } else if (daysUntil <= 14) {
          result.contracts.expiring14++;
          priority = "high";
          notificationType = "contract_expiring_14";
        } else if (daysUntil <= 30) {
          result.contracts.expiring30++;
          priority = "high";
          notificationType = "contract_expiring_30";
        } else if (daysUntil <= 60) {
          result.contracts.expiring60++;
          priority = "medium";
          notificationType = "contract_expiring_60";
        } else {
          result.contracts.expiring90++;
          priority = "medium";
          notificationType = "contract_expiring_90";
        }

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("type", notificationType)
          .eq("related_entity_id", contract.id)
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existing) {
          await supabase.from("notifications").insert({
            type: notificationType,
            title: `Contract Expiring in ${daysUntil} Days`,
            message: `Contract "${contract.title}" expires on ${contract.expiry_date}. Review and take action.`,
            priority,
            related_entity_type: "contract",
            related_entity_id: contract.id,
            action_url: `/contracts/${contract.id}`,
            target_role: "risk_manager",
          });
          result.notificationsCreated++;
        }
      }
    }

    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, legal_name, next_review_date")
      .not("next_review_date", "is", null)
      .lte("next_review_date", in30Days.toISOString().split("T")[0]);

    if (vendors) {
      for (const vendor of vendors) {
        const reviewDate = new Date(vendor.next_review_date);
        const daysUntil = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let priority = "medium";
        let notificationType = "assessment_due";

        if (daysUntil < 0) {
          result.assessments.overdue++;
          priority = "critical";
          notificationType = "assessment_overdue";
        } else if (daysUntil <= 7) {
          result.assessments.due7++;
          priority = "high";
        } else if (daysUntil <= 14) {
          result.assessments.due14++;
          priority = "high";
        } else {
          result.assessments.due30++;
        }

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("type", notificationType)
          .eq("related_entity_id", vendor.id)
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existing && daysUntil <= 14) {
          await supabase.from("notifications").insert({
            type: notificationType,
            title: daysUntil < 0 ? "Assessment Overdue" : `Assessment Due in ${daysUntil} Days`,
            message: `Vendor "${vendor.legal_name}" requires assessment review.`,
            priority,
            related_entity_type: "vendor",
            related_entity_id: vendor.id,
            action_url: `/vendors/${vendor.id}/assess`,
            target_role: "risk_manager",
          });
          result.notificationsCreated++;
        }
      }
    }

    const { data: dueDiligence } = await supabase
      .from("due_diligence")
      .select("id, vendor_id, next_due_date, vendors(legal_name)")
      .not("next_due_date", "is", null)
      .lte("next_due_date", in30Days.toISOString().split("T")[0]);

    if (dueDiligence) {
      for (const dd of dueDiligence) {
        const dueDate = new Date(dd.next_due_date);
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) {
          result.dueDiligence.overdue++;
        } else if (daysUntil <= 7) {
          result.dueDiligence.due7++;
        } else if (daysUntil <= 14) {
          result.dueDiligence.due14++;
        } else {
          result.dueDiligence.due30++;
        }
      }
    }

    const { data: documents } = await supabase
      .from("vendor_documents")
      .select("id, vendor_id, file_name, expiry_date, status, document_type:document_types(name), vendors(legal_name, responsible_officer)")
      .eq("is_current", true)
      .not("expiry_date", "is", null)
      .lte("expiry_date", in30Days.toISOString().split("T")[0]);

    if (documents) {
      for (const doc of documents) {
        const expiryDate = new Date(doc.expiry_date);
        const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let priority: "low" | "medium" | "high" | "critical" = "medium";
        let notificationType = "document_expiring_30";

        if (daysUntil < 0) {
          result.documents.expired++;
          priority = "critical";
          notificationType = "document_expired";

          if (doc.status !== "expired") {
            await supabase
              .from("vendor_documents")
              .update({ status: "expired" })
              .eq("id", doc.id);
            result.documents.statusUpdated++;
          }
        } else if (daysUntil <= 7) {
          result.documents.expiring7++;
          priority = "critical";
          notificationType = "document_expiring_7";
        } else if (daysUntil <= 14) {
          result.documents.expiring14++;
          priority = "high";
          notificationType = "document_expiring_14";
        } else {
          result.documents.expiring30++;
          priority = "medium";
          notificationType = "document_expiring_30";
        }

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("type", notificationType)
          .eq("related_entity_id", doc.id)
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existing && daysUntil <= 14) {
          const vendorData = doc.vendors as { legal_name?: string; responsible_officer?: string; organization_id?: string } | null;
          const vendorName = vendorData?.legal_name || "Unknown Vendor";
          const docTypeName = (doc.document_type as { name?: string })?.name || "Document";

          await supabase.from("notifications").insert({
            type: notificationType,
            title: daysUntil < 0
              ? `Document Expired: ${docTypeName}`
              : `Document Expiring in ${daysUntil} Days`,
            message: daysUntil < 0
              ? `${docTypeName} "${doc.file_name}" for ${vendorName} has expired. Please upload a new version.`
              : `${docTypeName} "${doc.file_name}" for ${vendorName} expires on ${doc.expiry_date}. Please renew.`,
            priority,
            related_entity_type: "vendor_document",
            related_entity_id: doc.id,
            action_url: `/vendors/${doc.vendor_id}?tab=documents`,
            target_role: "risk_manager",
          });
          result.notificationsCreated++;

          if (vendorData?.responsible_officer) {
            const { data: responsibleUser } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", vendorData.responsible_officer)
              .maybeSingle();

            if (responsibleUser?.email) {
              const emailSent = await sendWorkflowEmail(supabaseUrl, supabaseServiceKey, {
                event_type: "document_expiry_warning",
                recipient_email: responsibleUser.email,
                recipient_name: responsibleUser.full_name,
                organization_id: vendorData.organization_id || "",
                vendor_name: vendorName,
                document_name: `${docTypeName} - ${doc.file_name}`,
                due_date: doc.expiry_date,
                days_remaining: daysUntil,
                link_url: `/vendors/${doc.vendor_id}?tab=documents`,
              });
              if (emailSent) result.emailsSent++;
            }
          }
        }
      }
    }

    await supabase
      .from("scheduled_jobs")
      .upsert({
        job_name: "expiration_checker",
        job_type: "daily",
        description: "Check for expiring contracts, assessments, and documents",
        is_enabled: true,
        last_run_at: now.toISOString(),
        last_run_status: "success",
        last_run_result: result,
        next_run_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "job_name" });

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Expiration checker error:", error);

    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

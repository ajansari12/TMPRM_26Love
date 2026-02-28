import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationRequest {
  email: string;
  organization_id: string;
  defense_line: string;
  role_title?: string;
  department?: string;
  business_unit?: string;
  inviter_id: string;
  inviter_name: string;
  organization_name: string;
}

function generateToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const randomValues = new Uint8Array(48);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 48; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

function getDefenseLineLabel(line: string): string {
  const labels: Record<string, string> = {
    "1a": "1st Line (Business)",
    "1b": "1st Line (Coordinator)",
    "2nd": "2nd Line (Risk/Compliance)",
    "3rd": "3rd Line (Audit)",
    admin: "Administrator",
  };
  return labels[line] || line;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: InvitationRequest = await req.json();

    if (
      !payload.email ||
      !payload.organization_id ||
      !payload.defense_line ||
      !payload.inviter_id
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingInvitation } = await supabase
      .from("organization_invitations")
      .select("id, status, expires_at")
      .eq("organization_id", payload.organization_id)
      .eq("email", payload.email.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "An active invitation already exists for this email",
          existing_invitation_id: existingInvitation.id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingMember } = await supabase
      .from("organization_users")
      .select("id")
      .eq("organization_id", payload.organization_id)
      .eq("is_active", true)
      .eq(
        "user_id",
        supabase
          .from("profiles")
          .select("id")
          .eq("email", payload.email.toLowerCase())
      )
      .maybeSingle();

    if (existingMember) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "User is already a member of this organization",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: insertError } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: payload.organization_id,
        email: payload.email.toLowerCase(),
        defense_line: payload.defense_line,
        role_title: payload.role_title,
        department: payload.department,
        business_unit: payload.business_unit,
        invited_by: payload.inviter_id,
        inviter_name: payload.inviter_name,
        token: token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create invitation:", insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create invitation",
          details: insertError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://your-app.com";
    const invitationLink = `${appUrl}/accept-invitation/${token}`;
    const roleLabel = getDefenseLineLabel(payload.defense_line);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    let emailSent = false;
    let emailError: string | null = null;

    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "TPRM Platform <noreply@your-domain.com>",
            to: [payload.email],
            subject: `You've been invited to join ${payload.organization_name} on TPRM Platform`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #1e293b; padding: 24px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
                </div>
                <div style="padding: 32px; background-color: #ffffff;">
                  <h2 style="color: #1e293b; margin-bottom: 24px;">You've Been Invited!</h2>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    <strong>${payload.inviter_name}</strong> has invited you to join
                    <strong>${payload.organization_name}</strong> on the Third-Party Risk Management Platform.
                  </p>
                  <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="color: #475569; margin: 0; font-size: 14px;">
                      <strong>Your Role:</strong> ${roleLabel}<br/>
                      ${payload.role_title ? `<strong>Title:</strong> ${payload.role_title}<br/>` : ""}
                      ${payload.department ? `<strong>Department:</strong> ${payload.department}` : ""}
                    </p>
                  </div>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    Click the button below to accept your invitation and set up your account.
                  </p>
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${invitationLink}"
                       style="display: inline-block; background-color: #1e293b; color: white; padding: 14px 32px;
                              text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Accept Invitation
                    </a>
                  </div>
                  <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
                    This invitation will expire in 7 days. If you did not expect this invitation,
                    you can safely ignore this email.
                  </p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                  <p style="color: #94a3b8; font-size: 12px;">
                    If the button doesn't work, copy and paste this link into your browser:<br/>
                    <a href="${invitationLink}" style="color: #3b82f6;">${invitationLink}</a>
                  </p>
                </div>
                <div style="background-color: #f8fafc; padding: 16px; text-align: center;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Third-Party Risk Management Platform
                  </p>
                </div>
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          emailSent = true;
        } else {
          const errorData = await emailResponse.json();
          emailError = `Resend API error: ${JSON.stringify(errorData)}`;
        }
      } catch (e) {
        emailError = `Resend error: ${e.message}`;
      }
    } else {
      emailError = "No email service configured (RESEND_API_KEY)";
      console.warn(emailError);
    }

    await supabase.from("audit_logs").insert({
      organization_id: payload.organization_id,
      user_id: payload.inviter_id,
      action: "user_invitation_sent",
      entity_type: "organization_invitation",
      entity_id: invitation.id,
      changes: {
        email: payload.email,
        defense_line: payload.defense_line,
        role_title: payload.role_title,
        expires_at: expiresAt.toISOString(),
        email_sent: emailSent,
        email_error: emailError,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        invitation_id: invitation.id,
        email_sent: emailSent,
        email_error: emailError,
        invitation_link: invitationLink,
        expires_at: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send invitation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

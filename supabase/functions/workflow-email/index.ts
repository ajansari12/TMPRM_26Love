import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

type EmailEventType =
  | "request_submitted"
  | "request_assigned"
  | "request_returned"
  | "request_approved"
  | "request_rejected"
  | "request_conditionally_approved"
  | "vendor_created"
  | "sla_warning"
  | "sla_breach"
  | "document_expiry_warning"
  | "assessment_due_reminder"
  | "review_reminder"
  | "senior_approval_required"
  | "senior_approved"
  | "senior_approved_with_conditions"
  | "senior_request_info"
  | "senior_rejected";

interface EmailRequest {
  event_type: EmailEventType;
  recipient_email: string;
  recipient_name?: string;
  organization_id: string;
  organization_name?: string;
  request_id?: string;
  request_number?: string;
  vendor_name?: string;
  actor_name?: string;
  notes?: string;
  conditions?: string;
  due_date?: string;
  days_remaining?: number;
  document_name?: string;
  link_url?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
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

function generateEmailTemplate(
  event: EmailEventType,
  data: EmailRequest,
  appUrl: string
): EmailTemplate {
  const requestLink = data.request_id
    ? `${appUrl}/onboarding/${data.request_id}`
    : appUrl;

  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 600px;
    margin: 0 auto;
  `;

  const headerStyles = `
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    padding: 32px;
    text-align: center;
    border-radius: 8px 8px 0 0;
  `;

  const contentStyles = `
    padding: 32px;
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-top: none;
  `;

  const footerStyles = `
    background-color: #f8fafc;
    padding: 20px;
    text-align: center;
    border-radius: 0 0 8px 8px;
    border: 1px solid #e2e8f0;
    border-top: none;
  `;

  const buttonStyles = `
    display: inline-block;
    background-color: #1e293b;
    color: white;
    padding: 14px 28px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  `;

  const alertBoxStyles = {
    info: "background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;",
    warning:
      "background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;",
    error:
      "background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;",
    success:
      "background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0;",
  };

  const templates: Record<EmailEventType, EmailTemplate> = {
    request_submitted: {
      subject: `New Onboarding Request: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
            <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Third-Party Risk Management</p>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">New Onboarding Request Submitted</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              A new third-party onboarding request requires your review.
            </p>
            <div style="${alertBoxStyles.info}">
              <p style="margin: 0; color: #1e40af;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Submitted by:</strong> ${data.actor_name || "Unknown"}<br/>
                <strong>Organization:</strong> ${data.organization_name || "N/A"}
              </p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Review Request</a>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">
              Please review this request at your earliest convenience to maintain SLA compliance.
            </p>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              You're receiving this because you're a reviewer in ${data.organization_name || "your organization"}.
            </p>
          </div>
        </div>
      `,
    },

    request_assigned: {
      subject: `Review Assigned: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Review Assigned to You</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              You have been assigned to review the following onboarding request:
            </p>
            <div style="${alertBoxStyles.info}">
              <p style="margin: 0; color: #1e40af;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                ${data.due_date ? `<strong>Due Date:</strong> ${data.due_date}` : ""}
              </p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Start Review</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    request_returned: {
      subject: `Action Required: ${data.vendor_name} Request Returned [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Request Returned for Revision</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Your onboarding request has been returned and requires additional information.
            </p>
            <div style="${alertBoxStyles.warning}">
              <p style="margin: 0; color: #92400e;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Returned by:</strong> ${data.actor_name || "Reviewer"}
              </p>
            </div>
            ${
              data.notes
                ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Feedback:</p>
              <p style="margin: 0; color: #64748b;">${data.notes}</p>
            </div>
            `
                : ""
            }
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Update Request</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    request_approved: {
      subject: `Approved: ${data.vendor_name} Onboarding Request [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Request Approved</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Great news! Your onboarding request has been approved.
            </p>
            <div style="${alertBoxStyles.success}">
              <p style="margin: 0; color: #166534;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Approved by:</strong> ${data.actor_name || "Approver"}
              </p>
            </div>
            ${
              data.notes
                ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Notes:</p>
              <p style="margin: 0; color: #64748b;">${data.notes}</p>
            </div>
            `
                : ""
            }
            <p style="color: #475569; font-size: 14px;">
              You can now proceed to create the vendor record and begin onboarding activities.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Create Vendor</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    request_rejected: {
      subject: `Rejected: ${data.vendor_name} Onboarding Request [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Request Rejected</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Unfortunately, your onboarding request has been rejected.
            </p>
            <div style="${alertBoxStyles.error}">
              <p style="margin: 0; color: #991b1b;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Rejected by:</strong> ${data.actor_name || "Reviewer"}
              </p>
            </div>
            ${
              data.notes
                ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Reason:</p>
              <p style="margin: 0; color: #64748b;">${data.notes}</p>
            </div>
            `
                : ""
            }
            <p style="color: #475569; font-size: 14px;">
              Please contact your risk management team if you have questions about this decision.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">View Details</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    request_conditionally_approved: {
      subject: `Conditionally Approved: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Request Conditionally Approved</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Your onboarding request has been approved with conditions that must be met.
            </p>
            <div style="${alertBoxStyles.warning}">
              <p style="margin: 0; color: #92400e;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Approved by:</strong> ${data.actor_name || "Approver"}
              </p>
            </div>
            ${
              data.conditions
                ? `
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">Conditions to Fulfill:</p>
              <p style="margin: 0; color: #78350f;">${data.conditions}</p>
            </div>
            `
                : ""
            }
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">View Request</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    vendor_created: {
      subject: `Vendor Created: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Vendor Record Created</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              A new vendor record has been successfully created from the onboarding request.
            </p>
            <div style="${alertBoxStyles.success}">
              <p style="margin: 0; color: #166534;">
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Created by:</strong> ${data.actor_name || "System"}
              </p>
            </div>
            <p style="color: #475569; font-size: 14px;">
              The vendor is now available in the vendor registry and may require a risk assessment.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.link_url || requestLink}" style="${buttonStyles}">View Vendor</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    sla_warning: {
      subject: `SLA Warning: ${data.vendor_name} Review Due Soon [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">SLA Warning - Action Required</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              An onboarding request is approaching its SLA deadline.
            </p>
            <div style="${alertBoxStyles.warning}">
              <p style="margin: 0; color: #92400e;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Due Date:</strong> ${data.due_date}<br/>
                <strong>Days Remaining:</strong> ${data.days_remaining}
              </p>
            </div>
            <p style="color: #475569; font-size: 14px;">
              Please complete your review to avoid an SLA breach.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Complete Review</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    sla_breach: {
      subject: `URGENT: SLA Breach - ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #dc2626; margin: 0 0 16px 0;">SLA Breach - Immediate Action Required</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              An onboarding request has exceeded its SLA deadline.
            </p>
            <div style="${alertBoxStyles.error}">
              <p style="margin: 0; color: #991b1b;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Due Date:</strong> ${data.due_date}<br/>
                <strong>Days Overdue:</strong> ${Math.abs(data.days_remaining || 0)}
              </p>
            </div>
            <p style="color: #dc2626; font-size: 14px; font-weight: 600;">
              This SLA breach will be reported in compliance metrics.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="background-color: #dc2626; ${buttonStyles.replace("background-color: #1e293b;", "")}">Take Action Now</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    document_expiry_warning: {
      subject: `Document Expiring: ${data.document_name} for ${data.vendor_name}`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Document Expiration Notice</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              A vendor document is expiring soon and needs to be renewed.
            </p>
            <div style="${alertBoxStyles.warning}">
              <p style="margin: 0; color: #92400e;">
                <strong>Document:</strong> ${data.document_name}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Expires:</strong> ${data.due_date}<br/>
                <strong>Days Remaining:</strong> ${data.days_remaining}
              </p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.link_url || appUrl}" style="${buttonStyles}">View Document</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    assessment_due_reminder: {
      subject: `Assessment Due: ${data.vendor_name} Risk Assessment`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Risk Assessment Reminder</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              A vendor risk assessment is due and requires your attention.
            </p>
            <div style="${alertBoxStyles.info}">
              <p style="margin: 0; color: #1e40af;">
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Due Date:</strong> ${data.due_date}<br/>
                <strong>Days Remaining:</strong> ${data.days_remaining}
              </p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.link_url || appUrl}" style="${buttonStyles}">Start Assessment</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    review_reminder: {
      subject: `Review Pending: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Review Reminder</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              A pending review requires your attention.
            </p>
            <div style="${alertBoxStyles.info}">
              <p style="margin: 0; color: #1e40af;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                ${data.due_date ? `<strong>Due Date:</strong> ${data.due_date}` : ""}
              </p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Complete Review</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    senior_approval_required: {
      subject: `Senior Approval Required: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
            <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Senior Management Approval</p>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #be123c; margin: 0 0 16px 0;">Senior Management Approval Required</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              A critical vendor onboarding request requires your approval as a designated senior approver.
            </p>
            <div style="background-color: #fff1f2; border-left: 4px solid #be123c; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #9f1239;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Organization:</strong> ${data.organization_name || "N/A"}<br/>
                <strong>Submitted by:</strong> ${data.actor_name || "Unknown"}
              </p>
            </div>
            <p style="color: #475569; font-size: 14px;">
              Per OSFI B-10 Section 2.1.2, critical vendor engagements require approval at an appropriate level of management.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="background-color: #be123c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Review & Approve</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              You're receiving this as a designated senior approver for ${data.organization_name || "your organization"}.
            </p>
          </div>
        </div>
      `,
    },

    senior_approved: {
      subject: `Senior Approval Granted: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Senior Management Approval Granted</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Your critical vendor onboarding request has received senior management approval.
            </p>
            <div style="${alertBoxStyles.success}">
              <p style="margin: 0; color: #166534;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Approved by:</strong> ${data.actor_name || "Senior Management"}
              </p>
            </div>
            ${
              data.notes
                ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Approval Notes:</p>
              <p style="margin: 0; color: #64748b;">${data.notes}</p>
            </div>
            `
                : ""
            }
            <p style="color: #475569; font-size: 14px;">
              You can now proceed to create the vendor record and begin onboarding activities.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Create Vendor</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    senior_approved_with_conditions: {
      subject: `Conditional Senior Approval: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Senior Management Conditional Approval</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Your critical vendor onboarding request has been approved by senior management with conditions.
            </p>
            <div style="${alertBoxStyles.warning}">
              <p style="margin: 0; color: #92400e;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Approved by:</strong> ${data.actor_name || "Senior Management"}
              </p>
            </div>
            ${
              data.conditions
                ? `
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">Conditions to Fulfill:</p>
              <p style="margin: 0; color: #78350f;">${data.conditions}</p>
            </div>
            `
                : ""
            }
            <p style="color: #475569; font-size: 14px;">
              Please ensure all conditions are addressed before proceeding with the vendor engagement.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">View Request</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    senior_request_info: {
      subject: `Information Requested: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #1e293b; margin: 0 0 16px 0;">Additional Information Requested</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Senior management has requested additional information before approving this vendor onboarding request.
            </p>
            <div style="${alertBoxStyles.info}">
              <p style="margin: 0; color: #1e40af;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Requested by:</strong> ${data.actor_name || "Senior Management"}
              </p>
            </div>
            ${
              data.notes
                ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Information Required:</p>
              <p style="margin: 0; color: #64748b;">${data.notes}</p>
            </div>
            `
                : ""
            }
            <p style="color: #475569; font-size: 14px;">
              Please provide the requested information to continue the approval process.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">Update Request</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },

    senior_rejected: {
      subject: `Senior Approval Denied: ${data.vendor_name} [${data.request_number}]`,
      html: `
        <div style="${baseStyles}">
          <div style="${headerStyles}">
            <h1 style="color: white; margin: 0; font-size: 24px;">TPRM Platform</h1>
          </div>
          <div style="${contentStyles}">
            <h2 style="color: #dc2626; margin: 0 0 16px 0;">Senior Management Approval Denied</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Your critical vendor onboarding request has been rejected by senior management.
            </p>
            <div style="${alertBoxStyles.error}">
              <p style="margin: 0; color: #991b1b;">
                <strong>Request:</strong> ${data.request_number}<br/>
                <strong>Vendor:</strong> ${data.vendor_name}<br/>
                <strong>Rejected by:</strong> ${data.actor_name || "Senior Management"}
              </p>
            </div>
            ${
              data.notes
                ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Reason:</p>
              <p style="margin: 0; color: #64748b;">${data.notes}</p>
            </div>
            `
                : ""
            }
            <p style="color: #475569; font-size: 14px;">
              Please contact your risk management team if you have questions about this decision.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${requestLink}" style="${buttonStyles}">View Details</a>
            </div>
          </div>
          <div style="${footerStyles}">
            <p style="color: #64748b; font-size: 12px; margin: 0;">TPRM Platform - Third-Party Risk Management</p>
          </div>
        </div>
      `,
    },
  };

  return templates[event];
}

async function sendEmailViaResend(
  resendApiKey: string,
  to: string,
  subject: string,
  html: string,
  fromEmail: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, id: data.id };
    } else {
      const errorData = await response.json();
      return {
        success: false,
        error: `Resend API error: ${JSON.stringify(errorData)}`,
      };
    }
  } catch (e) {
    return { success: false, error: `Resend error: ${(e as Error).message}` };
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

    const payload: EmailRequest = await req.json();

    if (!payload.event_type || !payload.recipient_email || !payload.organization_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: event_type, recipient_email, organization_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://your-app.com";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("EMAIL_FROM") || "TPRM Platform <noreply@your-domain.com>";

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured",
          email_sent: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const template = generateEmailTemplate(payload.event_type, payload, appUrl);

    const result = await sendEmailViaResend(
      resendApiKey,
      payload.recipient_email,
      template.subject,
      template.html,
      fromEmail
    );

    await supabase.from("audit_logs").insert({
      organization_id: payload.organization_id,
      action: "workflow_email_sent",
      entity_type: "email_notification",
      entity_id: payload.request_id || null,
      changes: {
        event_type: payload.event_type,
        recipient: payload.recipient_email,
        vendor_name: payload.vendor_name,
        email_sent: result.success,
        email_id: result.id,
        email_error: result.error,
      },
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        email_sent: result.success,
        email_id: result.id,
        error: result.error,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Workflow email error:", error);
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

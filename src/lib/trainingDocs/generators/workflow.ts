import jsPDF from 'jspdf';
import {
  DocOptions, CATEGORY_COLORS, MARGIN,
  addCoverPage, addSectionTitle, addSubTitle, addBody, addBullet,
  addTable, applyAllFooters, checkPage, getDateStr, saveDoc,
} from '../helpers';

export function generateOnboardingWorkflowReference(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Workflow'];
  const date = getDateStr();

  addCoverPage(doc, 'Onboarding Workflow Reference', 'Workflow', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Workflow Overview', y, color);
  y = addBody(doc, 'The onboarding workflow governs how a new vendor engagement moves from initial request through risk assessment, due diligence, approval, and ultimately into the active vendor inventory. The workflow is configurable by administrators and the default structure is documented here.', y);
  y = addBody(doc, 'Every onboarding request must pass through all required workflow stages in sequence. No vendor can be activated in the inventory without a completed and approved onboarding request (unless imported as a legacy vendor). All stages, decisions, and comments are recorded in the audit trail.', y);

  y = checkPage(doc, y, 55);
  y = addSectionTitle(doc, '2. Workflow Stages', y, color);
  y = addTable(doc, ['Stage', 'Status Code', 'Owner', 'Description', 'Completion Criteria'],
    [
      ['Initial Submission', 'submitted', '1B Coordinator', 'Request created and submitted with all required vendor information', 'All mandatory fields complete, submitted'],
      ['1B Review', '1b_review', '1B Coordinator', 'Coordinator reviews the request, completes the tiering assessment, and prepares for 2nd Line submission', 'Tiering assessment complete, risk score generated'],
      ['2nd Line Review', '2nd_review', '2nd Line Reviewer', 'Risk & Compliance validates the 1B assessment, reviews due diligence, applies qualitative overlay', 'Validation complete, decision made'],
      ['Pending Senior Approval', 'pending_senior_approval', 'Senior Management', 'Required for Tier 5 critical or high-value vendors; executive sign-off obtained', 'Senior Management approves or rejects'],
      ['Approved', 'approved', 'System', 'Request approved; system creates vendor record in active inventory', 'Vendor record created'],
      ['Rejected', 'rejected', '2nd Line / Senior Mgmt', 'Request rejected; 1B notified with reason', 'Rejection reason documented'],
      ['Vendor Created', 'vendor_created', 'System', 'Vendor record is live in the inventory and operational management begins', 'Record visible in Vendor Inventory'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '3. SLA Hours by Defense Line', y, color);
  y = addBody(doc, 'Each workflow stage has a configured SLA (service level agreement) that defines the maximum time allowed for the responsible party to act. SLA clocks start when a request enters a stage. Approaching and breached SLAs trigger notifications.', y);
  y = addTable(doc, ['Stage', 'Default SLA', 'Warning Notification', 'Escalation Action'],
    [
      ['1B Review', '3 business days', 'At 60% of SLA elapsed', 'Notify 1B supervisor / Admin at 100%'],
      ['2nd Line Review', '5 business days', 'At 60% of SLA elapsed', 'Notify 2nd Line manager / Admin at 100%'],
      ['Pending Senior Approval', '2 business days', 'At 50% of SLA elapsed', 'Notify Admin immediately at 100%'],
      ['Total Onboarding', '10 business days', 'Dashboard warning at 8 days', 'KRI breach flagged at 10+ days'],
    ], y, color);
  y = addBody(doc, 'SLA hours are configurable by the Organization Administrator in Organization > Workflow Configuration. Non-business hours (evenings, weekends, statutory holidays) can be excluded from SLA calculation depending on your configuration.', y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '4. Decision Points', y, color);

  y = addSubTitle(doc, '4.1 2nd Line Decision Options', y);
  y = addTable(doc, ['Decision', 'Outcome', 'When to Use'],
    [
      ['Approve', 'Request moves to Approved / vendor created', 'Assessment is complete, accurate, and within risk appetite'],
      ['Reject', 'Request closed; 1B notified with reason', 'Vendor relationship cannot proceed (risk too high, insufficient information, or business decision)'],
      ['Request Clarification', 'Request returned to 1B Review with comments', 'Assessment incomplete, inconsistencies found, or additional information required'],
      ['Escalate to Senior Management', 'Request moves to Pending Senior Approval', 'Tier 5 critical, high value, or policy requires executive sign-off'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSubTitle(doc, '4.2 Senior Management Decision Options', y);
  y = addTable(doc, ['Decision', 'Outcome'],
    [
      ['Approve', 'Request moves to Approved; vendor record created'],
      ['Reject', 'Request closed; 1B and 2nd Line notified with reason'],
      ['Request More Information', 'Request returned to 2nd Line Review with comments'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '5. Escalation Rules', y, color);
  y = addBody(doc, 'The workflow engine automatically escalates requests based on configured rules. The following escalation triggers apply by default:', y);
  y = addBullet(doc, [
    'SLA breach: requests that exceed their stage SLA are flagged in the Dashboard and trigger a notification to the relevant administrator.',
    'Auto-critical rule trigger: requests where an auto-critical rule fires are automatically flagged as Tier 5 and routed to Senior Management approval upon 2nd Line completion.',
    'High contract value: requests with an estimated contract value above the configured threshold are automatically escalated to Senior Management regardless of tier.',
    'Regulatory outsourcing: requests flagged as regulated outsourcing under OSFI B-10 are escalated to Senior Management and trigger the OSFI notification workflow.',
    'Incident-triggered reassessment: reassessments triggered by a High or Critical incident are escalated to the 2nd Line with priority flagging.',
  ], y);

  y = checkPage(doc, y, 50);
  y = addSectionTitle(doc, '6. Administrator Workflow Configuration', y, color);
  y = addBody(doc, 'Organization Administrators can customize the workflow through Organization > Workflow Configuration. The following settings are available:', y);
  y = addTable(doc, ['Configuration Option', 'Description', 'Impact'],
    [
      ['Stage SLA hours', 'Set business hours allowed per stage', 'Controls SLA notifications and KRI calculations'],
      ['Auto-escalation threshold (contract value)', 'CAD value above which Senior Mgmt approval is required', 'Determines when Senior Mgmt stage is triggered'],
      ['Required review lines', 'Which defense lines must participate in each workflow', 'Can add or remove required stages'],
      ['Auto-assignment rules', 'Route requests to specific reviewers based on vendor attributes', 'Distributes workload automatically'],
      ['Notification preferences', 'Configure email notifications per stage and per event', 'Controls who gets notified and when'],
      ['SLA exclusions', 'Exclude non-business hours from SLA calculation', 'Adjusts effective SLA timing'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '7. Onboarding Templates', y, color);
  y = addBody(doc, 'Administrators can create onboarding templates for common vendor types. Templates pre-populate the onboarding request form with standard values, reducing data entry time and improving consistency.', y);
  y = addBullet(doc, [
    'Navigate to Organization > Workflow Configuration > Templates.',
    'Click "New Template" and select the vendor type (e.g., SaaS Provider, Professional Services, IT Infrastructure).',
    'Pre-populate service category, OSFI classification, and standard risk notes.',
    'Save the template. 1B Coordinators can select it when creating new onboarding requests.',
    'Templates can be cloned and modified to create variants for specific business units.',
  ], y);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `Onboarding_Workflow_Reference_${date}.pdf`);
}

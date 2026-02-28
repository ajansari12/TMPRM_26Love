import jsPDF from 'jspdf';
import {
  DocOptions, CATEGORY_COLORS, MARGIN,
  addCoverPage, addSectionTitle, addSubTitle, addBody, addBullet,
  addTable, applyAllFooters, checkPage, getDateStr, saveDoc,
} from '../helpers';

export function generate1BUserGuide(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['User Guide'];
  const date = getDateStr();

  addCoverPage(doc, '1st Line Coordinator (1B): Full User Guide', 'User Guide', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Your Role as a 1B Coordinator', y, color);
  y = addBody(doc, `As a 1st Line Coordinator (1B) at ${opts.orgName}, you are the first-line risk reviewer responsible for validating vendor onboarding requests submitted by 1st Line Business (1A) users. You apply risk expertise to the 1A's initial assessment, ensure that risk factors are accurately captured, and provide the first formal risk sign-off before a request advances to the 2nd Line.`, y);
  y = addBody(doc, 'You also manage the ongoing operational lifecycle of active vendors — including contracts, SLA tracking, incident reporting, fourth-party management, and exit strategies. The 1A business owner initiates and owns the vendor relationship; your role is to ensure that the associated risk is properly assessed and governed throughout that relationship.', y);

  y = checkPage(doc, y, 30);
  y = addSectionTitle(doc, '2. The Vendor Lifecycle', y, color);
  y = addTable(doc, ['Stage', 'Who Acts', 'Your Role', 'Outcome'],
    [
      ['Identification', '1A Business Owner', 'Receive request in your review queue', 'Request enters workflow queue'],
      ['Assessment Review', '1B Coordinator (you)', 'Review 1A answers; modify if risk expertise warrants', 'Validated risk score and tier recommendation'],
      ['2nd Line Review', '2nd Line Reviewer', 'Provide clarifications if requested', 'Request approved, rejected, or escalated'],
      ['Activation', 'System / Admin', 'Vendor created in active inventory', 'Full vendor record available'],
      ['Ongoing Management', '1B Coordinator (you)', 'Contracts, SLAs, incidents, fourth parties', 'Continuous monitoring maintained'],
      ['Reassessment', '1A submits / 1B reviews', 'Review updated assessment', 'Tier updated to reflect current risk'],
      ['Offboarding', '1B Coordinator (you)', 'Exit strategy activation', 'Vendor transitioned out, record archived'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '3. Reviewing a 1A Assessment', y, color);
  y = addBody(doc, 'When a 1st Line Business (1A) user submits a vendor onboarding request, the request enters your review queue. The 1A has provided the initial assessment answers based on their business knowledge of the vendor. Your job is to apply your risk expertise to validate, challenge, or improve those answers.', y);
  y = addSubTitle(doc, '3.1 Accessing Your Review Queue', y);
  y = addBullet(doc, [
    'Navigate to Onboarding in the left sidebar — requests awaiting your review appear with a "1B Review" status badge.',
    'You will also receive an email notification when a new request is assigned to your queue.',
    'Click on any request to open the full onboarding detail page.',
    'The Assessment Review panel displays all answers provided by the 1A alongside the calculated risk scores.',
    'A side-by-side comparison shows the 1A\'s original answer and the current value if you have made changes.',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSubTitle(doc, '3.2 How to Review and Modify Assessment Answers', y);
  y = addBullet(doc, [
    'Read through each question and the 1A\'s answer carefully.',
    'If an answer is inaccurate or does not fully reflect the vendor\'s risk profile, update it directly in the assessment panel.',
    'All changes you make are tracked — the system records the original 1A answer alongside your revision.',
    'A modification counter at the top of the panel shows how many answers you have changed from the 1A original.',
    'You can revert any individual answer to the 1A\'s original value using the "Revert" button beside each modified question.',
    'Click "Reset All" to discard all your changes and return to the 1A\'s original answers.',
    'Click "Save Assessment Review" to save your review. You must save before confirming sign-off.',
  ], y);

  y = checkPage(doc, y, 25);
  y = addSubTitle(doc, '3.3 What Happens After You Sign Off', y);
  y = addBody(doc, 'After you confirm the 1B review, the request advances to the 2nd Line queue. Your changes are visible to the 2nd Line reviewer along with the original 1A answers, providing full transparency into how the assessment evolved through the first line. For Tier 4 or Tier 5 vendors, the request will escalate to Senior Management after 2nd Line approval.', y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '4. Understanding the Tiering Assessment', y, color);
  y = addBody(doc, 'The tiering assessment determines the vendor\'s risk tier (Tier 1 through Tier 5). The 1A user completes the initial answers based on their knowledge of the vendor\'s services and business relationship. As the 1B reviewer, you evaluate whether those answers accurately reflect the risk factors across all five assessment categories.', y);

  y = addTable(doc, ['Tier', 'Risk Level', 'Description', 'Reassessment Frequency'],
    [
      ['Tier 1', 'Minimal', 'Non-critical, low-value, limited data access', 'Every 3 years'],
      ['Tier 2', 'Low', 'Standard operational vendors, limited risk exposure', 'Every 2 years'],
      ['Tier 3', 'Moderate', 'Material vendors with meaningful data or operational dependency', 'Annually'],
      ['Tier 4', 'High', 'Significant financial or operational dependency, sensitive data access', 'Annually'],
      ['Tier 5', 'Critical', 'Core banking access, regulated outsourcing, or critical infrastructure', 'Semi-annually'],
    ], y, color);

  y = checkPage(doc, y, 20);
  y = addSubTitle(doc, '4.1 Assessment Categories to Review', y);
  y = addBullet(doc, [
    'Operational Risk: dependency level, business continuity exposure, concentration risk, substitutability.',
    'Financial Risk: vendor financial stability, contract value, and revenue dependency.',
    'Data & Cyber Risk: type and sensitivity of data accessed, cybersecurity certifications, data jurisdiction.',
    'Geographic Risk: country of operation, geopolitical risk, regulatory environment.',
    'Regulatory Risk: regulatory classification of services, OSFI notification requirements, licensing status.',
  ], y);

  y = checkPage(doc, y, 20);
  y = addSubTitle(doc, '4.2 Auto-Critical Rules', y);
  y = addBody(doc, 'Certain answer combinations automatically flag a vendor as Tier 5 Critical regardless of the aggregate score. These auto-critical rules are configured by your organization and are visible in the assessment panel. If an auto-critical rule is triggered, review the underlying answer that caused it — if the 1A\'s answer was incorrect, correcting it may clear the flag.', y);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '5. Contract Management', y, color);
  y = addBody(doc, 'All vendor engagements must have a corresponding contract record in the platform. Contract records link the legal agreement to the vendor profile and enable automated renewal tracking.', y);
  y = addBullet(doc, [
    'Navigate to Contracts in the left sidebar.',
    'Click "Add Contract" and link it to the relevant vendor.',
    'Enter the contract start date, end date, contract type, and annual value.',
    'Set the renewal reminder lead time (90 days is standard for material contracts).',
    'Upload the signed contract document in the Documents tab.',
    'Record key SLA commitments, exit provisions, and data processing terms in the notes.',
    'Submit for 2nd Line review if required by your organization\'s workflow configuration.',
  ], y);

  y = checkPage(doc, y, 20);
  y = addBody(doc, 'The Contracts page shows a colour-coded expiry status for all contracts. Contracts approaching expiry are flagged amber (within reminder window) or red (expired). The Dashboard also surfaces upcoming contract expirations.', y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '6. SLA Tracking', y, color);
  y = addBody(doc, 'SLA tracking is required for all Tier 3 and above vendors. Monthly SLA records allow the organization to monitor vendor performance and identify patterns that may indicate deteriorating service quality.', y);
  y = addBullet(doc, [
    'Navigate to a vendor\'s detail page and click the "SLA Tracking" tab.',
    'For each reporting period, record the actual versus target performance for each SLA metric.',
    'Flag any breaches with a breach severity (Minor, Moderate, Major).',
    'Document the vendor\'s response and any remediation actions taken.',
    'Repeated or unresolved breaches should trigger a formal performance review.',
    'Performance reviews are accessible from the vendor detail page under the Performance tab.',
  ], y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '7. Fourth-Party Management', y, color);
  y = addBody(doc, 'Fourth parties are the subcontractors and service providers your vendors rely on to deliver their services to your organization. Identifying and documenting fourth parties is required for Tier 3 and above vendors and is a key OSFI B-10 consideration.', y);
  y = addBullet(doc, [
    'Navigate to a vendor\'s detail page and click the "Fourth Parties" tab.',
    'Click "Add Fourth Party" and enter the name, service provided, and country of operation.',
    'Indicate the criticality of the fourth party to the vendor\'s service delivery.',
    'Note whether the fourth party has access to your organization\'s data.',
    'Fourth-party data feeds into the Concentration Risk dashboard visible to the 2nd Line.',
  ], y);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '8. Incident Reporting', y, color);
  y = addBody(doc, 'Vendor incidents must be reported promptly. Incidents include service disruptions, data breaches, security events, compliance failures, financial distress signals, and any event that materially impacts your organization\'s use of the vendor.', y);
  y = addBullet(doc, [
    'Click the "Report Incident" button in the top navigation bar.',
    'Select the affected vendor from the dropdown.',
    'Choose the incident type (Service Disruption, Cybersecurity, Data Breach, Financial, Compliance, Other).',
    'Select the severity (Low, Medium, High, Critical).',
    'Provide a clear description of the event, the business impact, and immediate actions taken.',
    'Critical and High severity incidents automatically notify 2nd Line reviewers.',
    'Critical incidents may initiate an OSFI notification workflow, which the 2nd Line will manage.',
    'Update the incident record as new information becomes available.',
  ], y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '9. Exit Strategies', y, color);
  y = addBody(doc, 'An exit strategy documents how your organization would transition away from a vendor if required. This is mandatory for all Tier 3 and above vendors and is reviewed during due diligence by the 2nd Line.', y);
  y = addBullet(doc, [
    'Navigate to the vendor\'s detail page and click the "Exit Strategy" tab.',
    'Document the business continuity impact if the vendor were to exit or fail.',
    'Identify at least one substitute provider that could deliver the same or equivalent service.',
    'Estimate the transition timeline (minimum, likely, and maximum scenarios).',
    'Estimate the associated transition costs.',
    'Record the specific exit criteria that would trigger execution of the strategy (e.g., insolvency, SLA breach, regulatory directive).',
    'Assign an exit strategy owner and a review date.',
    'Save and submit for 2nd Line review.',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSectionTitle(doc, '10. Common Questions', y, color);
  y = addTable(doc, ['Question', 'Answer'],
    [
      ['How do I know when a new 1A request is waiting for my review?', 'You will receive an email notification when a request enters your review queue. You can also check the Onboarding Dashboard at any time — requests with a "1B Review" status badge are awaiting your action.'],
      ['Can I change any of the 1A\'s answers?', 'Yes. You may update any assessment answer in the 1B Review panel. All changes are tracked alongside the original 1A answers and are visible to downstream reviewers. Use the "Revert" button to restore individual answers to the 1A\'s original values.'],
      ['How do I know when a contract needs renewal?', 'The Dashboard surfaces upcoming expirations. You will also receive automated notification emails at the configured reminder interval before the renewal date.'],
      ['What triggers an OSFI notification?', 'Critical and High severity incidents, new outsourcing arrangements with material impact, and significant changes to existing critical vendor arrangements may trigger OSFI notification requirements. The 2nd Line manages the formal OSFI notification process.'],
    ], y, color);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `1B_Full_User_Guide_${date}.pdf`);
}

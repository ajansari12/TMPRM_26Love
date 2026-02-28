import jsPDF from 'jspdf';
import {
  DocOptions, CATEGORY_COLORS, MARGIN, PAGE_H, FOOTER_RESERVED,
  addCoverPage, addSectionTitle, addSubTitle, addBody, addBullet,
  addTable, applyAllFooters, checkPage, getDateStr, saveDoc,
} from '../helpers';

export function generateThreeLinesGuide(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Orientation'];
  const date = getDateStr();

  addCoverPage(doc, 'Three Lines of Defense: Platform Role Guide', 'Orientation', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Introduction to the Three Lines of Defense', y, color);
  y = addBody(doc, 'The Three Lines of Defense (3LOD) is a risk governance framework used by financial institutions to establish clear accountability for managing third-party risk. Each "line" represents a distinct layer of oversight, with different responsibilities, authorities, and access levels within this platform.', y);
  y = addBody(doc, 'This platform implements the 3LOD model across six roles: 1st Line Business (1A), 1st Line Coordinator (1B), 2nd Line Risk & Compliance (2nd), 3rd Line Audit (3rd), Senior Management, and Organization Administrator. Understanding how these roles interact is essential to using the platform effectively.', y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '2. Role Overview', y, color);
  y = addTable(doc, ['Role', 'Code', 'Primary Responsibility', 'Access Level'],
    [
      ['1st Line Business', '1A', 'Submit vendor onboarding requests and complete initial risk assessments', 'Operational (Submit)'],
      ['1st Line Coordinator', '1B', 'Review and validate 1A assessments; coordinate first-line risk sign-off; manage ongoing vendor lifecycle', 'Review & Coordinate'],
      ['2nd Line Risk & Compliance', '2nd', 'Independently review, validate, and challenge 1st Line risk assessments', 'Review & Override'],
      ['3rd Line Audit', '3rd', 'Independent observation of all platform data and reports', 'Read-Only (All)'],
      ['Senior Management', 'SM', 'Executive oversight, KRI monitoring, approval of critical vendors', 'Executive View & Approve'],
      ['Organization Administrator', 'Admin', 'Platform configuration, user management, workflow setup', 'Full Administrative'],
    ], y, color);

  y = checkPage(doc, y, 50);
  y = addSectionTitle(doc, '3. Feature Access Matrix', y, color);
  y = addTable(doc, ['Feature', '1A', '1B', '2nd', '3rd', 'Senior Mgmt', 'Admin'],
    [
      ['View Vendor Inventory', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
      ['Submit Onboarding Request', 'Yes', 'Yes', 'No', 'No', 'No', 'Yes'],
      ['Complete Initial Tiering Assessment', 'Yes', 'Yes', 'No', 'No', 'No', 'Yes'],
      ['Review & Modify 1A Assessment (1B Review)', 'No', 'Yes', 'No', 'No', 'No', 'Yes'],
      ['Manage Contracts', 'No', 'Yes', 'Review', 'No', 'No', 'Yes'],
      ['Due Diligence Management', 'No', 'Yes', 'Yes', 'No', 'No', 'Yes'],
      ['Report Incidents', 'No', 'Yes', 'No', 'No', 'No', 'Yes'],
      ['Risk Exceptions', 'No', 'No', 'Yes', 'View', 'Approve', 'Yes'],
      ['Attestations', 'No', 'Submit', 'Review/Approve', 'View', 'No', 'Yes'],
      ['OSFI B-10 Compliance', 'No', 'No', 'Yes', 'View', 'View', 'Yes'],
      ['KRI Dashboard', 'No', 'No', 'Yes', 'View', 'Yes', 'Yes'],
      ['Board Reports', 'No', 'No', 'Generate', 'View', 'Yes', 'Yes'],
      ['Concentration Risk', 'No', 'No', 'Yes', 'View', 'Yes', 'Yes'],
      ['Audit Log', 'No', 'No', 'No', 'Yes', 'No', 'Yes'],
      ['User Management', 'No', 'No', 'No', 'No', 'No', 'Yes'],
      ['Workflow Configuration', 'No', 'No', 'No', 'No', 'No', 'Yes'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;
  y = addSectionTitle(doc, '4. How the Three Lines Interact', y, color);
  y = addBody(doc, 'The three lines work sequentially in the vendor onboarding and risk management lifecycle. The 1st Line initiates requests and performs initial due diligence, with the 1A user submitting and the 1B coordinator reviewing. The 2nd Line independently validates and challenges those findings. The 3rd Line independently monitors the entire process.', y);

  y = addSubTitle(doc, '4.1 Onboarding Workflow Interaction', y);
  y = addBullet(doc, [
    'Step 1 — 1A Business Owner submits a vendor onboarding request and completes the initial tiering assessment based on their business knowledge of the vendor.',
    'Step 2 — 1B Coordinator receives the request in their review queue. They validate the 1A\'s assessment answers, apply risk expertise, and may modify answers where the 1A\'s business perspective needs to be supplemented with risk considerations. All changes are tracked against the original 1A answers.',
    'Step 3 — 2nd Line Reviewer receives the request. They validate the first-line findings (both the 1A\'s original answers and any 1B modifications), may override the tier, and can request additional due diligence documents.',
    'Step 4 — For Critical (Tier 5) or high-value vendors, the request escalates to Senior Management for final approval.',
    'Step 5 — Upon approval, the vendor is created in the active inventory. The 3rd Line can observe all steps at any point.',
  ], y);

  y = checkPage(doc, y, 35);
  y = addSubTitle(doc, '4.2 Ongoing Monitoring Responsibilities', y);
  y = addBullet(doc, [
    '1A Business Owners remain the relationship owners and submit reassessment requests when vendor circumstances change.',
    '1B Coordinators track SLA performance, manage contract renewals, report incidents, review reassessment submissions, and maintain fourth-party registers for their vendors.',
    '2nd Line manages the periodic reassessment schedule, monitors the KRI Dashboard, and governs the due diligence program.',
    'Senior Management reviews concentration risk, approves risk exceptions, and monitors board-level reporting.',
    '3rd Line and Audit access all data for independent review without the ability to create or modify records.',
  ], y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '5. Role-by-Role Detail', y, color);

  const roleDetails = [
    { role: '5.1  1st Line Business (1A)', body: 'The 1A role is for the business owner who identifies the vendor need and initiates the risk management process. They submit vendor onboarding requests, complete the initial tiering assessment using their knowledge of the business relationship, and remain the named relationship owner throughout the vendor\'s lifecycle. The 1A\'s assessment answers are the foundation of the risk record; the 1B Coordinator then applies risk expertise to validate those answers before the request advances.' },
    { role: '5.2  1st Line Coordinator (1B)', body: 'The 1B Coordinator is the first-line risk reviewer. They receive onboarding requests submitted by 1A users, validate the assessment answers against risk policy and standards, and may modify answers where additional risk context is needed. All modifications are tracked alongside the original 1A answers. Once satisfied, the 1B provides the first formal risk sign-off. Beyond onboarding, 1B users manage the ongoing operational lifecycle of active vendors — contracts, SLAs, incidents, fourth-party registers, and exit strategies.' },
    { role: '5.3  2nd Line Risk & Compliance (2nd)', body: 'The 2nd Line provides independent review and challenge of 1st Line activities. They do not own the vendor relationship but are accountable for ensuring the risk assessment is complete, accurate, and in compliance with policy. They manage the formal risk governance processes including attestations, exceptions, and regulatory compliance.' },
    { role: '5.4  3rd Line Audit (3rd)', body: 'The 3rd Line has read-only observation access to every module in the platform. This enables internal audit teams to independently verify that the risk management activities of the 1st and 2nd Lines are being carried out correctly. Audit findings are documented externally and reference vendor IDs from this platform.' },
    { role: '5.5  Senior Management', body: 'Senior Management has executive oversight of the vendor risk portfolio. They monitor key risk indicators, review concentration risk, approve exceptions and critical vendor requests, and have access to board-level reporting. Their role focuses on portfolio-level decisions rather than individual vendor management.' },
    { role: '5.6  Organization Administrator', body: 'The Admin role is responsible for platform configuration. They manage users and their roles, configure the onboarding workflow, set defense line SLA hours, and review the full audit log. Administrators have access to all modules and can act on behalf of any role when troubleshooting.' },
  ];

  for (const rd of roleDetails) {
    y = checkPage(doc, y, 28);
    y = addSubTitle(doc, rd.role, y);
    y = addBody(doc, rd.body, y);
    y += 2;
  }

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `Three_Lines_of_Defense_Platform_Role_Guide_${date}.pdf`);
}

export function generate1AOrientationGuide(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Orientation'];
  const date = getDateStr();

  addCoverPage(doc, '1st Line Business (1A): Quick Orientation Guide', 'Orientation', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Welcome to the TPRM Platform', y, color);
  y = addBody(doc, `Welcome to ${opts.orgName}'s Third-Party Risk Management (TPRM) platform. This platform is your organization's central system for managing and monitoring the risks associated with all third-party vendors, suppliers, and service providers.`, y);
  y = addBody(doc, 'As a 1st Line Business (1A) user, you are the business owner of the vendor relationship. You identify the business need, submit the vendor onboarding request, and complete the initial risk assessment based on your direct knowledge of the vendor and the services they will provide. Your inputs form the foundation of the risk record that the 1st Line Coordinator (1B) and 2nd Line will review.', y);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '2. Navigating the Platform', y, color);
  y = addBody(doc, 'The left sidebar is your primary navigation. The sections available to your role are:', y);
  y = addTable(doc, ['Section', 'What You Can Do', 'Location'],
    [
      ['Vendors', 'Browse the full vendor list, filter by business unit, view vendor detail pages', 'Left sidebar > Vendors'],
      ['Dashboard', 'View summary statistics, status distributions, and key metrics for your organization', 'Left sidebar > Dashboard'],
      ['Onboarding', 'Submit new vendor onboarding requests, track the status of your submissions', 'Left sidebar > Onboarding'],
      ['Inventory Reports', 'Download the full vendor registry as CSV or PDF, including status, tier, and ownership', 'Reports > Inventory Reports'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '3. Submitting a Vendor Onboarding Request', y, color);
  y = addBody(doc, 'All new vendor relationships must begin with a formal onboarding request. This ensures proper governance and risk assessment before any engagement commences.', y);
  y = addSubTitle(doc, '3.1 How to Submit', y);
  y = addBullet(doc, [
    'Click "New Request" in the left sidebar under the Workflow section, or navigate to Onboarding > New Request.',
    'Enter the vendor\'s full legal name, trading name, registered country, and website.',
    'Select the service category (e.g., IT Software, IT Infrastructure, Professional Services, Financial Services).',
    'Select the provider type (e.g., domestic, foreign, subsidiary, affiliated).',
    'Enter the estimated annual contract value in Canadian dollars (CAD).',
    'Classify the data access level the vendor will have (None, Non-Sensitive, Sensitive, Core Banking, Regulated).',
    'Indicate whether the arrangement qualifies as outsourcing under OSFI B-10 guidelines.',
    'Add the primary business contact name, the owning business unit, and any relevant notes.',
    'Click "Submit" to place the request in the workflow queue.',
  ], y);

  y = checkPage(doc, y, 25);
  y = addSubTitle(doc, '3.2 What Happens After You Submit', y);
  y = addBody(doc, 'After submission, the request moves into the 1B Coordinator\'s review queue. The 1B will review your assessment answers, apply their risk expertise, and may modify certain answers to ensure the risk picture is complete. All changes made by the 1B are tracked against your original answers, so nothing is lost. You can monitor your submission\'s status in real time from the Onboarding Dashboard.', y);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '4. Completing the Initial Tiering Assessment', y, color);
  y = addBody(doc, 'When submitting a vendor onboarding request, you will be asked to answer a series of risk questions. These questions cover five categories: Operational, Financial, Data & Cyber, Geographic, and Regulatory. Answer based on your direct business knowledge of the vendor — accuracy here directly affects the risk tier assigned to the vendor.', y);
  y = addBullet(doc, [
    'Answer each question as accurately and completely as possible based on your knowledge of the vendor\'s services.',
    'If you are unsure of an answer, select the most conservative option and add a note — the 1B reviewer will validate your inputs.',
    'The system calculates a risk score in real time as you answer — this is a guide, not a final determination.',
    'Some questions appear conditionally based on earlier answers; this is normal.',
    'You can save your progress and return to complete the assessment before submitting.',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSectionTitle(doc, '5. Sections Not Available to Your Role', y, color);
  y = addBody(doc, 'The following sections are managed by the 1B Coordinator and are not available to 1A users. This separation ensures that ongoing risk governance (contracts, SLA tracking, incident management) is handled by your organization\'s risk coordination function.', y);
  y = addTable(doc, ['Restricted Section', 'Managed By', 'Reason'],
    [
      ['Contracts', '1B, 2nd, Admin', 'Ongoing contract governance managed by 1B Coordinator'],
      ['Due Diligence', '1B, 2nd, Admin', 'Document collection and review coordinated by 1B and 2nd Line'],
      ['SLA Tracking', '1B, Admin', 'Performance monitoring managed by 1B Coordinator'],
      ['Incidents', '1B, Admin', 'Incident reporting and tracking managed by 1B Coordinator'],
      ['Compliance / OSFI', '2nd, 3rd, Admin', 'Regulatory data with strict access controls'],
      ['KRI Dashboard', '2nd, Senior Mgmt, Admin', 'Executive risk monitoring tool'],
      ['User Management', 'Admin only', 'Sensitive configuration and access control data'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '6. Tracking Your Submissions', y, color);
  y = addBullet(doc, [
    'Navigate to Onboarding in the left sidebar to see all requests you have submitted.',
    'Each request shows its current status (1B Review, 2nd Line Review, Approved, etc.).',
    'Click on any request to see the full detail, including any notes from the 1B or 2nd Line reviewers.',
    'You will receive email notifications when your request advances to a new stage or requires your attention.',
    'Once approved, the vendor appears in the active vendor inventory.',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSectionTitle(doc, '7. Finding Your Business Unit\'s Vendors', y, color);
  y = addBody(doc, 'To see only the vendors that belong to your business area:', y);
  y = addBullet(doc, [
    'Go to Vendors in the left sidebar.',
    'Use the "Business Unit" filter at the top of the vendor list.',
    'Select your business unit from the dropdown.',
    'The vendor list will refresh to show only vendors owned by that unit.',
    'The vendor detail page shows the owning business unit and primary contact for each vendor.',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSectionTitle(doc, '8. Requesting Additional Access', y, color);
  y = addBody(doc, 'If your business responsibilities require access to sections currently managed by the 1B role (such as contracts or SLA tracking), contact your Organization Administrator. Administrators can update your role to 1B Coordinator if a documented business justification exists.', y);
  y = addBody(doc, 'Do not share login credentials or attempt to access the platform using another user\'s account. All actions are logged in the audit trail with user identification.', y);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `1A_Quick_Orientation_Guide_${date}.pdf`);
}

import { DefenseLine } from '../../types/organization';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQGroup {
  role: DefenseLine;
  label: string;
  color: string;
  faqs: FAQItem[];
}

export interface GuideItem {
  title: string;
  description: string;
  steps: string[];
  audience: DefenseLine[];
  icon: string;
  duration: string;
}

export interface TrainingDoc {
  title: string;
  description: string;
  audience: DefenseLine[];
  category: string;
  pages: number;
}

export interface QuickStartContent {
  title: string;
  subtitle: string;
  actions: { label: string; path: string; primary: boolean }[];
}

export const QUICK_START: Record<DefenseLine, QuickStartContent> = {
  '1a': {
    title: 'Welcome, 1st Line Business User',
    subtitle:
      'You are the business owner of vendor relationships. Submit vendor onboarding requests, complete the initial risk assessment with your business knowledge, and track your submissions through the approval workflow.',
    actions: [
      { label: 'New Onboarding Request', path: '/onboarding/new', primary: true },
      { label: 'View Vendors', path: '/vendors', primary: false },
    ],
  },
  '1b': {
    title: 'Welcome, 1st Line Coordinator',
    subtitle:
      'You review and validate vendor assessments submitted by 1A users, applying risk expertise before requests advance to the 2nd Line. You also manage the ongoing operational lifecycle of active vendors.',
    actions: [
      { label: 'My Review Queue', path: '/onboarding', primary: true },
      { label: 'Active Vendors', path: '/vendors', primary: false },
    ],
  },
  '2nd': {
    title: 'Welcome, 2nd Line Risk & Compliance',
    subtitle:
      'You review and validate vendor risk assessments submitted by the 1st Line. Monitor the risk matrix, manage due diligence, handle attestations, and ensure OSFI B-10 compliance.',
    actions: [
      { label: 'Pending Reviews', path: '/onboarding', primary: true },
      { label: 'Compliance Overview', path: '/compliance', primary: false },
    ],
  },
  '3rd': {
    title: 'Welcome, 3rd Line Audit',
    subtitle:
      'You have read-only observation access to all modules. Review vendor risk information, assessments, contracts, and reports without making changes to any records.',
    actions: [
      { label: 'Risk Matrix', path: '/risk-matrix', primary: true },
      { label: 'Board Reports', path: '/reports/board', primary: false },
    ],
  },
  'senior_management': {
    title: 'Welcome, Senior Management',
    subtitle:
      'You have executive oversight of vendor risk. Monitor key risk indicators, review concentration risk, approve critical vendor requests, and access board-level reporting.',
    actions: [
      { label: 'KRI Dashboard', path: '/kri', primary: true },
      { label: 'Board Reports', path: '/reports/board', primary: false },
    ],
  },
  'admin': {
    title: 'Welcome, Organization Administrator',
    subtitle:
      'You configure and manage the platform for your organization. Set up users, configure workflow rules, manage defense line settings, and review audit logs.',
    actions: [
      { label: 'User Management', path: '/org/users', primary: true },
      { label: 'Organization Setup', path: '/org/setup', primary: false },
    ],
  },
};

export const FAQ_GROUPS: FAQGroup[] = [
  {
    role: '1a',
    label: '1st Line Business (1A)',
    color: 'blue',
    faqs: [
      {
        question: 'How do I start a new vendor onboarding request?',
        answer:
          'Click "New Onboarding Request" from the Help Center quick start panel, or navigate to Onboarding > New Request in the left sidebar. Complete the multi-step form with the vendor\'s details, service category, estimated contract value, and data access classification. Once submitted, the request enters the 1B Coordinator\'s review queue.',
      },
      {
        question: 'What happens to my assessment answers after I submit?',
        answer:
          'After you submit, a 1B Coordinator reviews your answers and applies their risk expertise. They may modify certain answers to supplement your business knowledge with risk considerations — all changes are tracked against your original answers, so nothing is overwritten without a record. You can view the final approved assessment once the request is approved.',
      },
      {
        question: 'How do I track the status of a request I submitted?',
        answer:
          'Navigate to Onboarding in the left sidebar to see all requests you have submitted and their current status (1B Review, 2nd Line Review, Approved, etc.). You will also receive email notifications when your request advances to a new stage or if the reviewer needs clarification from you.',
      },
      {
        question: 'Why can\'t I see the Contracts, SLA, or Incidents sections?',
        answer:
          'These sections are managed by the 1B Coordinator role, which handles the ongoing operational lifecycle of active vendors. Your role focuses on initiating vendor relationships and completing the initial risk assessment. If you need access to those sections for a specific business reason, contact your Organization Administrator.',
      },
      {
        question: 'How do I view a vendor\'s current status?',
        answer:
          'Navigate to Vendors in the left sidebar. Each vendor card displays its current status (Active, Under Review, Onboarding, etc.). Click on any vendor to see the full detail page, including lifecycle stage, tier classification, and key contacts.',
      },
      {
        question: 'How do I know which vendors belong to my business unit?',
        answer:
          'On the Vendors page, use the filters at the top to filter by Business Unit. This will show only the vendors associated with your area. The vendor detail page also shows the owning business unit and primary contact.',
      },
    ],
  },
  {
    role: '1b',
    label: '1st Line Coordinator (1B)',
    color: 'sky',
    faqs: [
      {
        question: 'How do I access a 1A assessment that is waiting for my review?',
        answer:
          'Navigate to Onboarding in the left sidebar. Requests submitted by 1A users that are in "1B Review" status will appear in your queue. You will also receive an email notification when a new request is assigned to you. Click on any request to open the full onboarding detail page and the Assessment Review panel.',
      },
      {
        question: 'Can I modify the answers provided by the 1A user?',
        answer:
          'Yes. You may update any assessment answer in the 1B Review panel. All changes are tracked — the system records the original 1A answer alongside your revision. A counter at the top of the panel shows how many answers have been changed from the 1A original. You can revert individual answers or reset all changes back to the 1A\'s original values at any time.',
      },
      {
        question: 'What happens after I complete my review and sign off?',
        answer:
          'The request advances to the 2nd Line review queue. Your modifications are visible to the 2nd Line alongside the original 1A answers, providing full transparency into how the assessment evolved through the first line. For Tier 4 or Tier 5 vendors, the request will escalate to Senior Management after 2nd Line approval.',
      },
      {
        question: 'How do I manage contracts for my vendors?',
        answer:
          'Navigate to Contracts in the sidebar. You can add new contracts, link them to vendors, set renewal dates, and upload supporting documents. The system will automatically alert you when contracts are approaching expiry based on your configured reminder settings.',
      },
      {
        question: 'How do I know when a contract needs renewal?',
        answer:
          'The Dashboard shows upcoming contract expirations. You will also receive automated notifications at configurable intervals before the renewal date. The Contracts page shows a colour-coded expiry status for all active contracts.',
      },
      {
        question: 'How do I report a vendor incident?',
        answer:
          'Click the "Report Incident" button in the top navigation bar (the orange button). Select the vendor, incident type, severity, and provide a description. Critical and High severity incidents trigger automatic notifications to 2nd Line reviewers and may initiate an OSFI notification workflow.',
      },
      {
        question: 'What are fourth-party risks and how do I manage them?',
        answer:
          'Fourth parties are the subcontractors and service providers your vendors rely on. Navigate to a vendor\'s detail page and click the "Fourth Parties" tab to log and track these dependencies. This information feeds into concentration risk calculations.',
      },
      {
        question: 'How do I set up an exit strategy for a vendor?',
        answer:
          'From the vendor detail page, navigate to the "Exit Strategy" tab. Document the business continuity plan, identify substitute providers, estimate transition timelines, and record the exit criteria. This is required for all Tier 3 and above vendors.',
      },
      {
        question: 'How do I track SLA performance for a vendor?',
        answer:
          'Navigate to the vendor\'s detail page and click "SLA Tracking", or access the SLA page directly from the vendor context. Record monthly SLA metrics, flag breaches, and document remediation actions. Repeated breaches escalate to performance reviews.',
      },
    ],
  },
  {
    role: '2nd',
    label: '2nd Line Risk & Compliance',
    color: 'cyan',
    faqs: [
      {
        question: 'How do I review a 1st Line tiering assessment?',
        answer:
          'Open the onboarding request from your queue in the Onboarding Dashboard. The Assessment Display Panel shows the original 1A answers and any modifications made by the 1B Coordinator, alongside your validation fields. You can override tier recommendations, add risk notes, and either approve, reject, or request clarification. Your decision is logged in the audit trail.',
      },
      {
        question: 'What is the risk exception process?',
        answer:
          'Navigate to Risk Exceptions. When a vendor\'s risk profile exceeds appetite thresholds but the business relationship must continue, submit a formal exception. Include business justification, compensating controls, and a review date. Exceptions require Senior Management sign-off for critical tier vendors.',
      },
      {
        question: 'How do I manage due diligence document requests?',
        answer:
          'Navigate to Due Diligence. Create a document collection request for a vendor, specifying required documents (e.g., SOC 2 Type II, penetration test reports, financial statements). Set due dates and send automated reminders. Track receipt and review status for each item.',
      },
      {
        question: 'How does the attestation workflow work?',
        answer:
          'Navigate to Compliance > Attestations. During an attestation period, 1B Coordinators respond to compliance questionnaires. You review, accept, or reject their submissions. Rejected responses require a remediation plan. Completed attestations are stored for regulatory examination.',
      },
      {
        question: 'How do I generate compliance reports for OSFI B-10?',
        answer:
          'Navigate to Compliance > OSFI B-10. This page provides a structured view of all OSFI-relevant vendor relationships, assessment completeness, notification history, and outsourcing arrangements. Use the export function to produce the annexure required for regulatory submissions.',
      },
      {
        question: 'How do I configure auto-critical rules for risk flagging?',
        answer:
          'In the Assessment Wizard, the Settings tab includes Auto-Critical Rules. These rules automatically flag a vendor as critical (Tier 5) when specific conditions are met, such as access to core banking data or regulatory-mandated services. You can customize these rules per your organization\'s risk appetite.',
      },
      {
        question: 'How do I monitor concentration risk?',
        answer:
          'Navigate to Monitoring > Concentration Risk. This dashboard shows vendor concentration by service category, geography, and provider type. Threshold breaches are highlighted. You can set custom thresholds and receive alerts when concentration limits are approached.',
      },
    ],
  },
  {
    role: '3rd',
    label: '3rd Line Audit',
    color: 'orange',
    faqs: [
      {
        question: 'Can I make changes to any vendor records or assessments?',
        answer:
          'No. 3rd Line Audit users have read-only observation access across all modules. You can view all data but cannot create, edit, or delete any records. This ensures audit independence. If you need to document findings, use your external audit management system and reference the vendor IDs from this platform.',
      },
      {
        question: 'What does "observation mode" mean?',
        answer:
          'Observation mode means you can see all data as it currently exists in the system, including assessments, risk scores, documents, contracts, and workflow history, but the interface disables all action buttons and forms. A banner at the top of each page confirms you are in read-only mode.',
      },
      {
        question: 'How do I access the full audit trail for a vendor?',
        answer:
          'Navigate to a vendor\'s detail page. The Audit Log tab (accessible via Organization > Audit Log for the full log) shows all actions taken on records including who made each change, what changed, and when. You can filter by date range, user, or action type.',
      },
      {
        question: 'Can I export data for audit purposes?',
        answer:
          'Yes. Export functions are available on all report and list pages. You can export vendor inventory, assessment history, contract registers, incident logs, and compliance data in CSV or PDF format. These exports include timestamps and data source metadata.',
      },
      {
        question: 'How do I access board-level and regulatory reports?',
        answer:
          'Navigate to Reports in the sidebar. You have access to Board Reports, Regulatory Reports, Inventory Reports, and Assessment Analytics. These provide aggregated, management-level views suitable for audit evidence packages.',
      },
      {
        question: 'How do I review KRI trends over time?',
        answer:
          'Navigate to Monitoring > KRI Dashboard. This shows key risk indicators with trend lines, threshold statuses, and historical data. You can adjust the date range and drill into individual indicators to see the underlying data and calculation methodology.',
      },
    ],
  },
  {
    role: 'senior_management',
    label: 'Senior Management',
    color: 'rose',
    faqs: [
      {
        question: 'How do I view the board-level risk summary?',
        answer:
          'Navigate to Reports > Board Reports. This page generates a board-ready presentation view of the vendor risk portfolio including tier distribution, critical vendor list, outstanding exceptions, and incident summary. Reports can be exported to PDF or PowerPoint format.',
      },
      {
        question: 'What are KRIs and how are they calculated?',
        answer:
          'Key Risk Indicators (KRIs) are metrics that signal changes in the organization\'s vendor risk exposure. Navigate to Monitoring > KRI Dashboard. Each KRI has a defined threshold and is calculated from live platform data (e.g., percentage of critical vendors with overdue assessments). Red/amber/green status is shown with trend arrows.',
      },
      {
        question: 'How do I monitor vendor concentration risk?',
        answer:
          'Navigate to Monitoring > Concentration Risk. This dashboard highlights where your organization is over-reliant on a single vendor, service category, or geography. Breaches of configured appetite thresholds are flagged. This is a key OSFI B-10 compliance consideration.',
      },
      {
        question: 'How do I review and approve critical vendor requests?',
        answer:
          'Requests requiring Senior Management approval appear in your Onboarding Dashboard queue with a "Pending Senior Approval" status badge. Open the request to review the full assessment, 2nd Line validation notes, and risk scoring before approving or escalating.',
      },
      {
        question: 'How do I view all active risk exceptions?',
        answer:
          'Navigate to Risk Exceptions (under Risk Assessment). Exceptions granted to vendors whose risk profile exceeds appetite are listed here with their justification, compensating controls, and review dates. Exceptions nearing their review date are highlighted.',
      },
      {
        question: 'How do I view incident trends and severity distribution?',
        answer:
          'Navigate to Monitoring > Incidents. Use the filters and charts to view incidents by severity, type, vendor, and time period. The summary panel shows open versus resolved counts and average time to resolution for each severity level.',
      },
    ],
  },
  {
    role: 'admin',
    label: 'Organization Administrator',
    color: 'slate',
    faqs: [
      {
        question: 'How do I add new users to the organization?',
        answer:
          'Navigate to Organization > User Management. Click "Invite User", enter their email address, select their defense line role (1A, 1B, 2nd, 3rd, Senior Management), and configure their permissions. An invitation email will be sent to the user with a link to complete registration.',
      },
      {
        question: 'How do I configure the onboarding workflow?',
        answer:
          'Navigate to Organization > Workflow Configuration. Here you can define which defense lines are required for each workflow step, set SLA hours, configure escalation rules, and create auto-assignment rules based on vendor attributes such as service category or estimated value.',
      },
      {
        question: 'How do I set up defense line configurations?',
        answer:
          'Navigate to Organization > Setup and select the Defense Lines tab. For each line, you can set the display name, review SLA hours, escalation thresholds, and notification preferences. These settings control how the workflow engine routes and escalates requests.',
      },
      {
        question: 'How do I view the full audit log?',
        answer:
          'Navigate to Organization > Audit Log. This provides a complete chronological record of all actions taken in the system, including who performed each action, what changed, and when. Filter by date range, user, module, or action type for targeted review.',
      },
      {
        question: 'How do I configure auto-critical rules for tiering?',
        answer:
          'Auto-critical rules are configured per assessment type. Navigate to any assessment wizard and access the Settings panel. Rules can be based on data access level, service category, contract value, and regulatory classification. When triggered, the vendor is automatically classified as Tier 5 Critical.',
      },
      {
        question: 'How do I manage organization settings and risk appetite?',
        answer:
          'Navigate to Settings (gear icon). Here you can update organization details, set risk appetite thresholds (maximum critical vendors, concentration limits), configure due diligence reminder intervals, and manage the default assessment review frequency.',
      },
    ],
  },
];

export const HOW_TO_GUIDES: GuideItem[] = [
  {
    title: 'Submit a New Vendor Onboarding Request',
    description:
      'Walk through creating a complete vendor onboarding request and completing the initial risk assessment.',
    audience: ['1a', '1b'],
    icon: 'FileText',
    duration: '5 min',
    steps: [
      'Navigate to Workflow > New Request in the sidebar.',
      'Enter the vendor\'s legal name, trading name, and website.',
      'Select the service category and provider type.',
      'Enter the estimated annual contract value in CAD.',
      'Classify the data access level the vendor will have.',
      'Indicate if the arrangement is outsourcing under OSFI B-10.',
      'Add the primary business contact and owning business unit.',
      'Answer the risk assessment questions based on your business knowledge of the vendor.',
      'Click Submit to place the request in the 1B Coordinator\'s review queue.',
    ],
  },
  {
    title: 'Review and Validate a 1A Assessment (1B Coordinator)',
    description:
      'Understand how to conduct a thorough 1B review of an onboarding request submitted by a 1A Business user.',
    audience: ['1b'],
    icon: 'Calculator',
    duration: '10 min',
    steps: [
      'Navigate to Onboarding in the sidebar — requests with "1B Review" status are awaiting your action.',
      'Click on a request to open the full detail page and Assessment Review panel.',
      'Read through each question and the 1A\'s answer carefully.',
      'Update any answers that do not accurately reflect the vendor\'s risk profile.',
      'All changes are tracked against the 1A\'s original answers — use "Revert" to undo individual changes.',
      'Review the auto-critical rule indicators if any are flagged.',
      'Click "Save Assessment Review" to save your changes.',
      'Confirm the 1B sign-off to advance the request to the 2nd Line queue.',
    ],
  },
  {
    title: 'Review and Validate a 1st Line Assessment (2nd Line)',
    description:
      'Understand how to conduct a thorough 2nd Line review of an onboarding request and tiering assessment.',
    audience: ['2nd'],
    icon: 'ClipboardCheck',
    duration: '8 min',
    steps: [
      'Open the onboarding request from your Pending Reviews queue.',
      'Review the original 1A answers and any modifications made by the 1B Coordinator in the Assessment Display Panel.',
      'Check the tiering score against the documented risk factors.',
      'Use the Second Line Validation Panel to record your findings.',
      'Override the tier classification if warranted and document your rationale.',
      'Flag any missing due diligence documents using the document request tool.',
      'Set any risk conditions or mitigating controls required before approval.',
      'Approve, reject, or escalate the request to Senior Management.',
    ],
  },
  {
    title: 'Manage Vendor Contracts',
    description:
      'Add, track, and maintain vendor contracts including renewal dates and document storage.',
    audience: ['1b', '2nd'],
    icon: 'FileSearch',
    duration: '5 min',
    steps: [
      'Navigate to Contracts in the sidebar.',
      'Click "Add Contract" or open an existing contract.',
      'Link the contract to the corresponding vendor.',
      'Enter contract start date, end date, and contract type.',
      'Set the renewal reminder lead time (e.g., 90 days before expiry).',
      'Upload the signed contract document in the Documents tab.',
      'Add key clauses, SLA commitments, and exit provisions in the notes.',
      'Submit for 2nd Line review if required by your workflow configuration.',
    ],
  },
  {
    title: 'Conduct a Due Diligence Document Collection',
    description:
      'Create and manage a due diligence document request package for a vendor.',
    audience: ['1b', '2nd'],
    icon: 'FolderOpen',
    duration: '7 min',
    steps: [
      'Navigate to Due Diligence in the Risk Assessment section.',
      'Click "New Collection" and select the target vendor.',
      'Choose the required document types from the standard list (SOC 2, pen test, financials, etc.).',
      'Set due dates for each document category.',
      'Send the collection request; automated reminders will follow.',
      'As documents arrive, upload them and mark each item as received.',
      'Review each document for adequacy and record your assessment notes.',
      'Mark the collection as complete once all required items are reviewed.',
    ],
  },
  {
    title: 'Set Up an Exit Strategy',
    description:
      'Document a vendor exit strategy as required for all Tier 3 and above vendors.',
    audience: ['1b'],
    icon: 'LogOut',
    duration: '6 min',
    steps: [
      'Navigate to the vendor\'s detail page.',
      'Click the "Exit Strategy" tab.',
      'Document the business continuity impact if the vendor were to exit.',
      'Identify one or more substitute providers.',
      'Estimate the transition timeline and associated costs.',
      'Record the specific exit criteria (e.g., breach of SLA, insolvency).',
      'Add the exit strategy owner and review date.',
      'Save and submit for review.',
    ],
  },
  {
    title: 'Generate a Board Report',
    description:
      'Produce a board-ready vendor risk report for executive and governance use.',
    audience: ['2nd', '3rd', 'senior_management'],
    icon: 'BarChart2',
    duration: '4 min',
    steps: [
      'Navigate to Reports > Board Reports.',
      'Select the reporting period (quarter/year).',
      'Review the auto-populated sections: vendor portfolio summary, tier distribution, critical vendor list.',
      'Add any commentary or management notes in the text fields.',
      'Review the KRI dashboard summary and exception list.',
      'Preview the formatted report.',
      'Export as PDF for board distribution or PowerPoint for presentations.',
    ],
  },
  {
    title: 'Invite and Onboard a New User',
    description:
      'Add a new team member to your organization with the appropriate role and permissions.',
    audience: ['admin'],
    icon: 'UserPlus',
    duration: '3 min',
    steps: [
      'Navigate to Organization > User Management.',
      'Click "Invite User".',
      'Enter the new user\'s email address and full name.',
      'Select their defense line role (1A, 1B, 2nd Line, 3rd Line, Senior Management).',
      'Assign their business unit and department.',
      'Configure specific permissions (can review, can approve, approval limit).',
      'Click "Send Invitation"; the user will receive an email with a setup link.',
      'The user appears as "Pending" until they complete registration.',
    ],
  },
];

export const TRAINING_DOCS: TrainingDoc[] = [
  {
    title: 'Three Lines of Defense: Platform Role Guide',
    description:
      'A comprehensive overview of all six roles in this platform (1A, 1B, 2nd Line, 3rd Line, Senior Management, Admin), what each role can access, and how they interact in the vendor lifecycle workflow.',
    audience: ['1a', '1b', '2nd', '3rd', 'senior_management', 'admin'],
    category: 'Orientation',
    pages: 18,
  },
  {
    title: '1st Line Business (1A): Quick Orientation Guide',
    description:
      'An orientation guide for 1A Business users — the relationship owners who submit vendor onboarding requests and complete the initial risk assessment. Covers how to submit requests, complete the tiering assessment, track submissions, and navigate the platform.',
    audience: ['1a'],
    category: 'Orientation',
    pages: 8,
  },
  {
    title: '1st Line Coordinator (1B): Full User Guide',
    description:
      'The complete reference guide for 1B Coordinators. Covers the 1B review role — validating and modifying 1A assessments — plus the full ongoing vendor lifecycle: contracts, SLA tracking, fourth-party management, incident reporting, and exit strategies.',
    audience: ['1b'],
    category: 'User Guide',
    pages: 42,
  },
  {
    title: 'OSFI B-10 Compliance Reference',
    description:
      'Explains how this platform supports OSFI B-10 obligations including outsourcing inventory requirements, notification thresholds, risk assessment obligations, and regulatory reporting. Includes mapping of platform fields to B-10 annexures.',
    audience: ['2nd', '3rd', 'senior_management', 'admin'],
    category: 'Compliance',
    pages: 28,
  },
  {
    title: 'Vendor Tiering Methodology',
    description:
      'Detailed explanation of the five-tier risk classification system. Covers the scoring methodology, category weightings, auto-critical rule conditions, and the qualitative overlay process for 2nd Line validation.',
    audience: ['1b', '2nd', '3rd'],
    category: 'Risk Management',
    pages: 15,
  },
  {
    title: 'Onboarding Workflow Reference',
    description:
      'Step-by-step documentation of the standard onboarding workflow, including all decision points, escalation triggers, SLA commitments for each line, and configuration options available to administrators.',
    audience: ['1a', '1b', '2nd', 'admin'],
    category: 'Workflow',
    pages: 22,
  },
  {
    title: 'Risk Assessment Framework',
    description:
      'The underlying risk assessment framework including all question categories, scoring tables, tier thresholds, and the rationale behind each risk factor. Reference document for understanding how tier recommendations are generated.',
    audience: ['1b', '2nd', '3rd', 'admin'],
    category: 'Risk Management',
    pages: 35,
  },
  {
    title: 'Contract Management Best Practices',
    description:
      'Guidance on creating and maintaining vendor contracts within the platform, including required fields for OSFI compliance, renewal management, and integrating contract terms with the risk assessment process.',
    audience: ['1b', '2nd'],
    category: 'Contracts',
    pages: 12,
  },
  {
    title: 'TPRM Regulatory Requirements Summary',
    description:
      'A summary of applicable Canadian regulatory requirements for third-party risk management, including OSFI B-10, OSFI E-21, and FINTRAC guidance. Maps each requirement to the corresponding platform feature.',
    audience: ['2nd', '3rd', 'senior_management'],
    category: 'Compliance',
    pages: 20,
  },
  {
    title: 'Platform Glossary of Terms',
    description:
      'Definitions for all terminology used in this platform, including TPRM-specific terms (outsourcing, fourth party, concentration risk), regulatory terms (FRFI, OSFI, B-10), and platform-specific concepts (defense line, tiering, attestation).',
    audience: ['1a', '1b', '2nd', '3rd', 'senior_management', 'admin'],
    category: 'Reference',
    pages: 9,
  },
];

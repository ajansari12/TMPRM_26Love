import jsPDF from 'jspdf';
import {
  DocOptions, CATEGORY_COLORS, MARGIN,
  addCoverPage, addSectionTitle, addSubTitle, addBody, addBullet,
  addTable, applyAllFooters, checkPage, getDateStr, saveDoc,
} from '../helpers';

export function generateContractManagementGuide(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Contracts'];
  const date = getDateStr();

  addCoverPage(doc, 'Contract Management Best Practices', 'Contracts', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Introduction', y, color);
  y = addBody(doc, 'Vendor contracts are the legal foundation of every third-party relationship. Effective contract management ensures that commercial terms, risk protections, and regulatory obligations are documented, enforced, and kept current throughout the vendor lifecycle.', y);
  y = addBody(doc, `This guide provides best practices for creating and maintaining vendor contract records in the ${opts.orgName} TPRM platform, including the specific fields required for OSFI B-10 compliance and how contract data integrates with the vendor risk assessment process.`, y);

  y = checkPage(doc, y, 45);
  y = addSectionTitle(doc, '2. Required Fields for OSFI Compliance', y, color);
  y = addBody(doc, 'OSFI B-10 specifies minimum contract requirements for outsourcing arrangements. The following fields must be populated for any vendor classified as outsourcing:', y);
  y = addTable(doc, ['Field', 'OSFI Requirement', 'Platform Location'],
    [
      ['Contract start date', 'Required — establishes arrangement date', 'Contract record > Start Date'],
      ['Contract end date / term', 'Required — for outsourcing arrangements', 'Contract record > End Date'],
      ['Service description', 'Required — must specify nature of services', 'Contract record > Description'],
      ['Governing law', 'Required — jurisdiction of contract', 'Contract record > Legal Terms tab'],
      ['Audit rights clause', 'Required — FRFI right to audit the vendor', 'Contract record > OSFI Checklist'],
      ['Data return clause', 'Required — obligation to return data on termination', 'Contract record > OSFI Checklist'],
      ['Termination provisions', 'Required — conditions for termination', 'Contract record > OSFI Checklist'],
      ['Sub-contracting restrictions', 'Required — restrictions on fourth-party use', 'Contract record > OSFI Checklist'],
      ['Business continuity obligations', 'Required — vendor BCP requirements', 'Contract record > OSFI Checklist'],
      ['Regulatory access clause', 'Required — OSFI right to access vendor records', 'Contract record > OSFI Checklist'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '3. Contract Lifecycle Management', y, color);
  y = addSubTitle(doc, '3.1 Creating a Contract Record', y);
  y = addBullet(doc, [
    'Navigate to Contracts in the left sidebar and click "Add Contract".',
    'Link the contract to the relevant vendor by searching for the vendor name.',
    'Select the contract type: Master Services Agreement, Statement of Work, Amendment, or Other.',
    'Enter the contract start date, end date, and estimated annual value in CAD.',
    'Set the renewal reminder lead time. 90 days is standard for material contracts; 30 days for minor contracts.',
    'Upload the executed contract document in the Documents tab.',
    'Complete the OSFI Checklist tab to confirm required clauses are present.',
    'Add key SLA commitments, performance metrics, and pricing terms in the notes field.',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSubTitle(doc, '3.2 Contract Review Process', y);
  y = addBody(doc, 'For vendors classified as outsourcing or Tier 3 and above, contract records should be reviewed by the 2nd Line before execution. The contract review workflow is separate from the onboarding workflow but can be linked.', y);
  y = addBullet(doc, [
    'Navigate to Contracts > Contract Reviews from the sidebar.',
    'Click "Submit for Review" on the relevant contract record.',
    'The contract enters the 2nd Line queue as a Contract Review task.',
    '2nd Line completes the review checklist and either approves, rejects, or requests changes.',
    'All review comments and decisions are stored in the contract record audit trail.',
  ], y);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '4. Renewal Management', y, color);
  y = addBody(doc, 'Contract renewals are a critical risk management control. Allowing contracts to lapse without renewal review creates both legal and regulatory exposure. The platform automates renewal tracking and notification.', y);
  y = addTable(doc, ['Vendor Tier', 'Recommended Reminder Lead Time', 'Who Receives Notification', 'Action Required'],
    [
      ['Tier 1–2', '30 days', '1B Coordinator', 'Review and renew or terminate'],
      ['Tier 3', '60 days', '1B Coordinator, 2nd Line (FYI)', 'Reassessment + renewal review'],
      ['Tier 4', '90 days', '1B Coordinator, 2nd Line', 'Full reassessment + contract review + 2nd Line approval'],
      ['Tier 5', '90 days + OSFI notification', '1B, 2nd Line, Senior Mgmt', 'Full process + Senior Mgmt + OSFI notification if material change'],
    ], y, color);

  y = checkPage(doc, y, 30);
  y = addBody(doc, 'When a contract expires without renewal action, the vendor\'s status changes to "Contract Expired" in the inventory. This status triggers a KRI alert and appears in the Dashboard. Expired contracts for Tier 3+ vendors are escalated to the 2nd Line automatically.', y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '5. OSFI-Relevant Clause Checklist', y, color);
  y = addTable(doc, ['Clause Type', 'Required For', 'What to Verify'],
    [
      ['Audit Rights', 'All outsourcing', 'FRFI has right to audit vendor\'s books and operations related to the services'],
      ['OSFI Access Rights', 'All outsourcing', 'OSFI has right to access vendor records related to the FRFI\'s business'],
      ['Data Return on Termination', 'All outsourcing with data access', 'Vendor must return all data within defined period on contract end'],
      ['Data Destruction', 'All outsourcing with data access', 'Vendor must securely destroy data not returned within defined timeframe'],
      ['Sub-contracting Restrictions', 'All outsourcing', 'Vendor must obtain consent before sub-contracting material services'],
      ['Business Continuity', 'Material outsourcing (Tier 3+)', 'Vendor must maintain BCP covering the services provided to the FRFI'],
      ['Termination for Regulatory Reason', 'All outsourcing', 'FRFI can terminate if OSFI directs or regulatory compliance requires'],
      ['Change of Control Notification', 'All outsourcing', 'Vendor must notify FRFI of ownership changes that affect service delivery'],
      ['Information Security Obligations', 'Any data access', 'Minimum security standards and breach notification timeline defined'],
    ], y, color);

  y = checkPage(doc, y, 30);
  y = addSectionTitle(doc, '6. Integration with Risk Assessment', y, color);
  y = addBody(doc, 'Contract data integrates directly with the vendor risk assessment. The platform uses contract information to:', y);
  y = addBullet(doc, [
    'Pre-populate contract value fields in the tiering assessment (used in financial risk scoring).',
    'Auto-trigger reassessment tasks at contract renewal dates for Tier 3+ vendors.',
    'Flag missing OSFI contract clauses as a risk finding in the 2nd Line validation panel.',
    'Include contract expiry dates in the KRI calculation for "vendors with expired contracts".',
    'Surface contracts without the OSFI checklist completed as compliance exceptions in the OSFI B-10 dashboard.',
  ], y);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `Contract_Management_Best_Practices_${date}.pdf`);
}

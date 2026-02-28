import jsPDF from 'jspdf';
import {
  DocOptions, CATEGORY_COLORS, MARGIN,
  addCoverPage, addSectionTitle, addSubTitle, addBody, addBullet,
  addTable, applyAllFooters, checkPage, getDateStr, saveDoc,
} from '../helpers';

export function generateOSFIB10Reference(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Compliance'];
  const date = getDateStr();

  addCoverPage(doc, 'OSFI B-10 Compliance Reference', 'Compliance', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Regulatory Context', y, color);
  y = addBody(doc, 'OSFI Guideline B-10 (Technology and Cyber Risk Management) and the OSFI Third-Party Risk Management (TPRM) requirements establish the regulatory framework for how federally regulated financial institutions (FRFIs) in Canada must manage the risks arising from their use of third-party service providers.', y);
  y = addBody(doc, 'This platform is designed to support full compliance with OSFI B-10 obligations. Every feature in the platform corresponds to one or more regulatory requirements. This document maps those requirements to the platform and provides guidance on maintaining a compliant vendor risk program.', y);

  y = checkPage(doc, y, 45);
  y = addSectionTitle(doc, '2. Key OSFI B-10 Obligations', y, color);
  y = addTable(doc, ['Obligation', 'Requirement Summary', 'Platform Support'],
    [
      ['Outsourcing Inventory', 'Maintain a comprehensive inventory of all outsourcing arrangements', 'Vendor Inventory with outsourcing flag'],
      ['Risk Assessment', 'Conduct risk-based due diligence before engaging and ongoing', 'Tiering Assessment Wizard'],
      ['Material Outsourcing', 'Enhanced requirements for "material" outsourcing arrangements', 'Tier 4–5 enhanced workflow'],
      ['OSFI Notification', 'Notify OSFI before entering material outsourcing arrangements', 'OSFI Notification workflow'],
      ['Contract Requirements', 'Specific contract terms required for outsourcing arrangements', 'Contract management with OSFI field checklist'],
      ['Concentration Risk', 'Monitor and manage third-party concentration risk', 'Concentration Risk Dashboard'],
      ['Ongoing Monitoring', 'Continuous monitoring of critical vendors', 'SLA tracking, KRI Dashboard, incident management'],
      ['Fourth-Party Risk', 'Identify and assess subcontractors of critical vendors', 'Fourth-Party register per vendor'],
      ['Exit Strategies', 'Documented business continuity and exit plans for critical vendors', 'Exit Strategy module'],
      ['Board Reporting', 'Regular reporting to Board on TPRM program effectiveness', 'Board Reports module'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '3. Outsourcing Categories', y, color);
  y = addBody(doc, 'OSFI B-10 distinguishes between different types of outsourcing arrangements. The classification affects the level of due diligence required and whether OSFI notification is needed.', y);
  y = addTable(doc, ['Category', 'Definition', 'Platform Tier Mapping', 'OSFI Notification'],
    [
      ['Non-Material Outsourcing', 'Third-party services that do not significantly affect the FRFI\'s risk profile', 'Tier 1–2', 'Not Required'],
      ['Material Outsourcing', 'Outsourcing that involves significant reliance or risk exposure', 'Tier 3–4', 'Not Required (but enhanced DD)'],
      ['Critical Outsourcing', 'Material outsourcing where disruption would significantly impact operations', 'Tier 5', 'Required — notify OSFI'],
      ['Regulated Activity Outsourcing', 'Outsourcing of activities subject to OSFI regulation', 'Tier 5', 'Required — notify OSFI'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '4. OSFI Notification Requirements', y, color);
  y = addBody(doc, 'Before entering into a new outsourcing arrangement that OSFI classifies as material, FRFIs must notify OSFI and receive acknowledgment. The platform supports this process through the OSFI Notification workflow available to 2nd Line users.', y);
  y = addTable(doc, ['Trigger', 'Notification Timing', 'Platform Location'],
    [
      ['New critical outsourcing arrangement', 'Before contract execution', 'OSFI B-10 > Notifications'],
      ['Material change to existing arrangement', 'Before change is effective', 'OSFI B-10 > Notifications'],
      ['Critical vendor incident', 'Within 72 hours of discovery', 'Incidents > OSFI Notification'],
      ['Termination of critical arrangement', 'Reasonable advance notice', 'OSFI B-10 > Notifications'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '5. Platform-to-B-10 Field Mapping', y, color);
  y = addTable(doc, ['B-10 Annexure Field', 'Platform Location', 'Completion Required For'],
    [
      ['Vendor legal name and address', 'Vendor Profile > Basic Information', 'All vendors'],
      ['Service description', 'Onboarding Request > Service Category & Description', 'All vendors'],
      ['Contract start and end dates', 'Contracts > Contract Record', 'All vendors with contracts'],
      ['Annual contract value', 'Onboarding Request > Contract Value', 'All vendors'],
      ['Outsourcing classification', 'Onboarding Request > OSFI Classification', 'All outsourced vendors'],
      ['Risk tier', 'Tiering Assessment > Final Tier', 'All vendors'],
      ['Country of service delivery', 'Vendor Profile > Geographic Risk > Countries of Operation', 'All vendors'],
      ['Fourth-party information', 'Vendor Profile > Fourth Parties tab', 'Tier 3+ vendors'],
      ['Business continuity plan', 'Vendor Profile > Exit Strategy tab', 'Tier 3+ vendors'],
      ['Last assessment date', 'Tiering Assessment > Completion Date', 'All assessed vendors'],
      ['Next assessment due date', 'Assessment Tasks > Scheduled Date', 'All vendors'],
      ['OSFI notification date', 'OSFI B-10 > Notification Record > Sent Date', 'Critical/regulated vendors'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '6. OSFI Annexure Compliance Checklist', y, color);
  y = addSubTitle(doc, '6.1 For Every Vendor in the Inventory', y);
  y = addBullet(doc, [
    'Vendor profile is complete with legal name, registered country, and service category.',
    'Onboarding request has been submitted and approved (not legacy records without requests).',
    'Tiering assessment has been completed within the prescribed frequency for the vendor\'s tier.',
    'At least one active contract record with correct start/end dates is linked to the vendor.',
    'OSFI outsourcing classification field is populated (Yes/No/Type).',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSubTitle(doc, '6.2 For Tier 3 and Above Vendors', y);
  y = addBullet(doc, [
    'Fourth-party register is populated with all material subcontractors.',
    'Exit strategy is documented with substitute providers and transition timeline.',
    'SLA tracking records are current (updated monthly).',
    'Annual performance review has been conducted.',
    'Due diligence document collection is complete and current (SOC 2, pen test, financials as applicable).',
  ], y);

  y = checkPage(doc, y, 25);
  y = addSubTitle(doc, '6.3 For Critical (Tier 5) Vendors', y);
  y = addBullet(doc, [
    'OSFI pre-notification has been completed and acknowledgment received.',
    'Senior Management approval is on record for the vendor relationship.',
    'Semi-annual reassessment is scheduled and up to date.',
    'Board Report includes the vendor in the critical vendor list.',
    'Concentration risk analysis has been conducted.',
    'Risk exception, if applicable, is formally documented with compensating controls.',
  ], y);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `OSFI_B10_Compliance_Reference_${date}.pdf`);
}

export function generateRegulatoryRequirementsSummary(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Compliance'];
  const date = getDateStr();

  addCoverPage(doc, 'TPRM Regulatory Requirements Summary', 'Compliance', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Overview of Applicable Regulations', y, color);
  y = addBody(doc, 'Canadian federally regulated financial institutions (FRFIs) are subject to multiple regulatory requirements related to third-party risk management. The primary regulations are OSFI Guideline B-10, OSFI Guideline E-21, and FINTRAC guidance. This document summarizes each and maps the requirements to features in this platform.', y);

  y = checkPage(doc, y, 45);
  y = addSectionTitle(doc, '2. OSFI Guideline B-10: Technology and Cyber Risk Management', y, color);
  y = addBody(doc, 'OSFI B-10 provides expectations for how FRFIs manage technology and cyber risks, including risks arising from the use of third-party technology providers. Key TPRM-relevant requirements include:', y);
  y = addBullet(doc, [
    'Maintain a comprehensive, current inventory of all technology-related outsourcing arrangements.',
    'Conduct risk-based due diligence before engaging and on an ongoing basis.',
    'Notify OSFI before entering new material outsourcing arrangements and before material changes.',
    'Ensure contractual protections including audit rights, data return, and termination provisions.',
    'Manage concentration risk arising from reliance on a small number of third-party providers.',
    'Maintain documented exit strategies for material outsourcing arrangements.',
    'Identify and manage fourth-party risks (subcontractors of material vendors).',
    'Report to the Board regularly on the state of the TPRM program.',
  ], y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '3. OSFI Guideline E-21: Operational Risk and Resilience', y, color);
  y = addBody(doc, 'OSFI E-21 addresses operational resilience more broadly, with third-party risk management as a key component. TPRM-relevant requirements include:', y);
  y = addBullet(doc, [
    'Third-party arrangements must be subject to the same operational resilience standards as internal operations.',
    'Business continuity plans must account for the failure or disruption of critical third parties.',
    'Scenario testing should include third-party failure scenarios for critical vendors.',
    'Recovery time objectives (RTOs) for services provided by third parties must be defined and tested.',
    'Incident management processes must cover third-party-related incidents.',
  ], y);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '4. FINTRAC Guidance', y, color);
  y = addBody(doc, 'The Financial Transactions and Reports Analysis Centre of Canada (FINTRAC) issues guidance relevant to FRFIs that engage third parties in activities related to anti-money laundering (AML) and counter-terrorist financing (CTF). Key considerations include:', y);
  y = addBullet(doc, [
    'Third parties engaged in activities that touch AML/CTF obligations (e.g., KYC processes, transaction monitoring) must be risk-assessed for compliance capability.',
    'The FRFI remains responsible for AML/CTF compliance even when activities are outsourced.',
    'Contractual agreements with third parties handling AML-relevant functions must include compliance obligations.',
    'Annual review of AML-related outsourcing arrangements is recommended best practice.',
  ], y);

  y = checkPage(doc, y, 55);
  y = addSectionTitle(doc, '5. Requirements-to-Platform Feature Mapping', y, color);
  y = addTable(doc, ['Regulatory Requirement', 'Source', 'Platform Feature', 'Location'],
    [
      ['Outsourcing inventory maintenance', 'B-10', 'Vendor Inventory', 'Vendors / Inventory Reports'],
      ['Risk-based due diligence', 'B-10, E-21', 'Tiering Assessment Wizard', 'Risk Assessment > Tiering'],
      ['OSFI pre-notification', 'B-10', 'OSFI Notification workflow', 'Compliance > OSFI B-10'],
      ['Contract protections', 'B-10', 'Contract management with OSFI checklist', 'Contracts'],
      ['Concentration risk monitoring', 'B-10, E-21', 'Concentration Risk Dashboard', 'Monitoring > Concentration'],
      ['Exit strategy documentation', 'B-10, E-21', 'Exit Strategy module', 'Vendor Detail > Exit Strategy'],
      ['Fourth-party identification', 'B-10', 'Fourth-Party register', 'Vendor Detail > Fourth Parties'],
      ['Board reporting', 'B-10, E-21', 'Board Reports', 'Reports > Board Reports'],
      ['Operational resilience', 'E-21', 'Exit Strategy + SLA Tracking + Incidents', 'Multiple modules'],
      ['Incident reporting', 'B-10, E-21', 'Incident management', 'Monitoring > Incidents'],
      ['Annual performance review', 'B-10', 'Performance Reviews', 'Vendor Detail > Performance'],
      ['AML/CTF third-party risk', 'FINTRAC', 'Risk Assessment > Regulatory Risk category', 'Tiering Assessment'],
    ], y, color);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '6. Regulatory Reporting Calendar', y, color);
  y = addTable(doc, ['Activity', 'Frequency', 'Primary Owner', 'Platform Support'],
    [
      ['Vendor tiering assessment — Tier 5', 'Semi-annual', '1B Coordinator', 'Assessment Tasks module'],
      ['Vendor tiering assessment — Tier 3–4', 'Annual', '1B Coordinator', 'Assessment Tasks module'],
      ['Vendor tiering assessment — Tier 1–2', 'Every 2–3 years', '1B Coordinator', 'Assessment Tasks module'],
      ['Attestation cycle', 'Annual (minimum)', '2nd Line', 'Compliance > Attestations'],
      ['KRI review', 'Monthly', '2nd Line / Senior Mgmt', 'Monitoring > KRI Dashboard'],
      ['Concentration risk review', 'Quarterly', '2nd Line / Senior Mgmt', 'Monitoring > Concentration'],
      ['Board Report', 'Quarterly', '2nd Line / Senior Mgmt', 'Reports > Board Reports'],
      ['OSFI B-10 annexure update', 'Annual (minimum)', '2nd Line / Admin', 'Compliance > OSFI B-10'],
      ['Due diligence refresh — SOC 2, pen test', 'Annual', '1B / 2nd Line', 'Due Diligence module'],
    ], y, color);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `TPRM_Regulatory_Requirements_Summary_${date}.pdf`);
}

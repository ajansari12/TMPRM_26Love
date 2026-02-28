import jsPDF from 'jspdf';
import {
  DocOptions, CATEGORY_COLORS, MARGIN,
  addCoverPage, addSectionTitle, addBody, addTable, applyAllFooters, getDateStr, saveDoc,
} from '../helpers';

export function generatePlatformGlossary(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Reference'];
  const date = getDateStr();

  addCoverPage(doc, 'Platform Glossary of Terms', 'Reference', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, 'About This Glossary', y, color);
  y = addBody(doc, 'This glossary defines all terminology used in the TPRM platform. Terms are organized alphabetically and grouped by category: Platform Concepts, TPRM Industry Terms, and Regulatory Terms. Use this document as a reference when unfamiliar terms appear in the platform interface or in related training materials.', y);
  y += 3;

  y = addSectionTitle(doc, 'A – C', y, color);
  y = addTable(doc, ['Term', 'Definition', 'Related Platform Feature'],
    [
      ['Assessment Task', 'A scheduled or triggered activity requiring completion of a vendor tiering assessment.', 'Risk Assessment > Assessment Tasks'],
      ['Attestation', 'A formal compliance statement made by a 1B Coordinator confirming adherence to organizational risk policies for their vendor portfolio.', 'Compliance > Attestations'],
      ['Audit Log', 'A complete, immutable record of all actions performed in the platform, including who acted, what changed, and when.', 'Organization > Audit Log'],
      ['Auto-Critical Rule', 'A configured condition that automatically assigns a vendor to Tier 5 (Critical) when triggered, regardless of composite score.', 'Tiering Assessment > Settings'],
      ['Business Unit', 'An organizational division within the FRFI that owns a vendor relationship.', 'Vendor Profile > Ownership'],
      ['Board Report', 'An executive summary report of the vendor risk portfolio generated for presentation to the Board of Directors.', 'Reports > Board Reports'],
      ['Concentration Risk', 'The risk arising from excessive reliance on a single vendor, service category, geography, or provider type.', 'Monitoring > Concentration Risk'],
      ['Contract Review', 'A formal 2nd Line review of a vendor contract to verify OSFI-required clauses and risk protections.', 'Contracts > Contract Reviews'],
      ['Critical Vendor', 'A vendor classified as Tier 5 whose failure or disruption would significantly impact the FRFI\'s operations or regulatory compliance.', 'Vendor Inventory (is_critical flag)'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, 'D – F', y, color);
  y = addTable(doc, ['Term', 'Definition', 'Related Platform Feature'],
    [
      ['Defense Line', 'A role category in the Three Lines of Defense governance model (1A, 1B, 2nd, 3rd, Senior Management, Admin).', 'Organization > User Management'],
      ['Due Diligence', 'The process of collecting and reviewing evidence (documents, certifications, financial statements) to validate a vendor\'s risk profile.', 'Risk Assessment > Due Diligence'],
      ['Exit Strategy', 'A documented plan for transitioning away from a vendor, including substitute providers, transition timelines, and trigger conditions.', 'Vendor Detail > Exit Strategy'],
      ['Fourth Party', 'A subcontractor or service provider engaged by a vendor to deliver services to the FRFI.', 'Vendor Detail > Fourth Parties'],
      ['FRFI', 'Federally Regulated Financial Institution — a bank, insurance company, or trust company regulated by OSFI.', 'N/A (regulatory term)'],
    ], y, color);

  y = addSectionTitle(doc, 'I – K', y, color);
  y = addTable(doc, ['Term', 'Definition', 'Related Platform Feature'],
    [
      ['Incident', 'A vendor-related event that has or may negatively impact the FRFI\'s operations, data, or regulatory standing.', 'Monitoring > Incidents'],
      ['Key Risk Indicator (KRI)', 'A metric used to signal changes in the organization\'s vendor risk exposure relative to defined thresholds.', 'Monitoring > KRI Dashboard'],
      ['KRI Threshold', 'The target or limit value for a KRI that, when breached, indicates elevated risk requiring management attention.', 'Monitoring > KRI Dashboard'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, 'M – O', y, color);
  y = addTable(doc, ['Term', 'Definition', 'Related Platform Feature'],
    [
      ['Material Outsourcing', 'An outsourcing arrangement that involves significant reliance or risk exposure as defined by OSFI B-10.', 'Onboarding Request > OSFI Classification'],
      ['Observation Mode', 'The read-only access mode for 3rd Line Audit users, allowing viewing of all data without the ability to create or modify records.', 'Platform-wide (3rd Line role)'],
      ['Offboarding', 'The process of formally ending a vendor relationship, including executing the exit strategy and archiving the vendor record.', 'Vendor Lifecycle'],
      ['Onboarding Request', 'A formal request to engage a new vendor, submitted by a 1B Coordinator and reviewed through the workflow.', 'Workflow > Onboarding'],
      ['OSFI', 'Office of the Superintendent of Financial Institutions — the Canadian federal regulator of banks, insurers, and other financial institutions.', 'Compliance > OSFI B-10'],
      ['OSFI B-10', 'OSFI Guideline B-10: Technology and Cyber Risk Management — the primary regulatory guideline governing TPRM for FRFIs.', 'Compliance > OSFI B-10'],
      ['OSFI E-21', 'OSFI Guideline E-21: Operational Risk and Resilience — complementary guideline addressing broader operational resilience.', 'Multiple modules'],
      ['Outsourcing', 'An arrangement in which a third party performs an activity on behalf of the FRFI on an ongoing basis.', 'Onboarding Request > OSFI Classification'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, 'P – R', y, color);
  y = addTable(doc, ['Term', 'Definition', 'Related Platform Feature'],
    [
      ['Performance Review', 'A formal evaluation of a vendor\'s service delivery performance, including SLA achievement and issue resolution.', 'Vendor Detail > Performance'],
      ['Platform Admin', 'A system-level administrator with access to manage multiple organizations within the platform.', 'Platform Administration'],
      ['Reassessment', 'A repeat of the tiering assessment for an existing vendor, triggered by schedule or by a material event.', 'Risk Assessment > Assessment Tasks'],
      ['Risk Appetite', 'The level and type of risk the organization is willing to accept in pursuit of its objectives, used as a threshold for escalation.', 'Settings > Risk Appetite'],
      ['Risk Exception', 'A formal approval to continue a vendor relationship whose risk profile exceeds the organization\'s risk appetite, with documented compensating controls.', 'Risk Assessment > Risk Exceptions'],
      ['Risk Matrix', 'A visual tool showing the distribution of vendors by likelihood and impact, used by the 2nd Line to prioritize monitoring.', 'Risk Assessment > Risk Matrix'],
    ], y, color);

  y = addSectionTitle(doc, 'S – Z', y, color);
  y = addTable(doc, ['Term', 'Definition', 'Related Platform Feature'],
    [
      ['SLA (Service Level Agreement)', 'A contractual commitment defining the performance standards a vendor must meet.', 'Vendor Detail > SLA Tracking'],
      ['SLA Breach', 'An instance where a vendor fails to meet a contracted performance standard.', 'Vendor Detail > SLA Tracking'],
      ['SOC 2 Type II', 'Service Organization Control 2 Type II — an audit report attesting to the design and operating effectiveness of a vendor\'s security controls over a defined period.', 'Due Diligence > Document Types'],
      ['Tier', 'A risk classification (1–5) assigned to a vendor based on the tiering assessment. Tier 5 is Critical.', 'Tiering Assessment'],
      ['Tiering Assessment', 'The structured risk assessment process that assigns a tier to a vendor based on scored responses to standardized risk questions.', 'Risk Assessment > Tiering Assessments'],
      ['TPRM', 'Third-Party Risk Management — the discipline of identifying, assessing, and managing the risks arising from the use of third-party service providers.', 'Platform-wide concept'],
      ['Vendor', 'Any external organization engaged by the FRFI to provide goods, services, or technology.', 'Vendors module'],
      ['Workflow', 'The configured sequence of review and approval steps that a vendor onboarding request must pass through.', 'Workflow > Onboarding Dashboard'],
    ], y, color);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `Platform_Glossary_of_Terms_${date}.pdf`);
}

import jsPDF from 'jspdf';
import {
  DocOptions, CATEGORY_COLORS, MARGIN,
  addCoverPage, addSectionTitle, addSubTitle, addBody, addBullet,
  addTable, applyAllFooters, checkPage, getDateStr, saveDoc,
} from '../helpers';

export function generateTieringMethodology(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Risk Management'];
  const date = getDateStr();

  addCoverPage(doc, 'Vendor Tiering Methodology', 'Risk Management', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Introduction', y, color);
  y = addBody(doc, 'The vendor tiering methodology is the risk classification system used to determine the level of scrutiny, due diligence, and ongoing monitoring applied to each vendor relationship. A higher tier reflects greater risk to the organization and triggers more stringent governance requirements.', y);
  y = addBody(doc, 'Tiers are assigned based on a structured scoring process completed in the Tiering Assessment Wizard. Scores are derived from responses to standardized questions across five risk categories. The final tier may also be overridden by auto-critical rules or by the 2nd Line reviewer.', y);

  y = checkPage(doc, y, 45);
  y = addSectionTitle(doc, '2. Five-Tier Risk Classification', y, color);
  y = addTable(doc, ['Tier', 'Score Range', 'Risk Level', 'Governance Requirements'],
    [
      ['Tier 1', '0–20', 'Minimal', 'Basic onboarding, no DD documents required, 3-year reassessment'],
      ['Tier 2', '21–40', 'Low', 'Standard onboarding, limited DD, 2-year reassessment'],
      ['Tier 3', '41–60', 'Moderate', 'Enhanced DD, exit strategy required, fourth-party register, annual reassessment'],
      ['Tier 4', '61–79', 'High', 'Full DD package, Senior Mgmt notification, annual reassessment, SLA tracking'],
      ['Tier 5', '80–100 or auto-critical', 'Critical', 'Full DD, OSFI notification, Senior Mgmt approval, semi-annual reassessment, all modules required'],
    ], y, color);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '3. Scoring Categories and Weightings', y, color);
  y = addTable(doc, ['Category', 'Weight', 'Key Risk Factors'],
    [
      ['Operational Risk', '30%', 'Business dependency, criticality, substitutability, concentration'],
      ['Financial Risk', '15%', 'Contract value, vendor financial stability, revenue dependency'],
      ['Data & Cyber Risk', '25%', 'Data sensitivity, access level, cyber certifications, data jurisdiction'],
      ['Geographic Risk', '15%', 'Country risk, geopolitical exposure, regulatory environment'],
      ['Regulatory Risk', '15%', 'Regulated activity outsourcing, licensing, AML/CTF relevance'],
    ], y, color);

  y = checkPage(doc, y, 30);
  y = addBody(doc, 'Each category contains multiple scored questions. Question responses are mapped to a numeric score (typically 0–4 per question). Category scores are weighted and summed to produce a composite score out of 100. The composite score determines the initial tier recommendation.', y);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '4. Auto-Critical Rules', y, color);
  y = addBody(doc, 'Auto-critical rules override the scored tier and automatically classify a vendor as Tier 5 (Critical) when specific high-risk conditions are present, regardless of the composite score. These rules reflect scenarios where the risk is so significant that the normal scoring scale is insufficient.', y);

  y = addTable(doc, ['Auto-Critical Condition', 'Rationale'],
    [
      ['Data access level = Core Banking', 'Direct access to core banking systems presents systemic risk'],
      ['Service category = Critical Infrastructure', 'Infrastructure failures can cause institution-wide disruption'],
      ['Regulated activity = Yes (OSFI-regulated functions)', 'Regulatory accountability remains with the FRFI regardless of outsourcing'],
      ['Contract value > $10M CAD (configurable)', 'High financial dependency warrants critical oversight'],
      ['Vendor provides services to > 50% of business units', 'Concentration threshold indicating systemic dependency'],
      ['Vendor is the sole provider (no substitutes)', 'Single-source arrangements create extreme concentration risk'],
      ['Data jurisdiction = High-risk country (configurable list)', 'Regulatory and geopolitical risk to data sovereignty'],
    ], y, color);

  y = checkPage(doc, y, 25);
  y = addBody(doc, 'Auto-critical rules are configured by the Organization Administrator and can be customized to reflect your organization\'s specific risk appetite and regulatory obligations. When an auto-critical rule is triggered, the assessment wizard displays a clear notification and requires the assessor to acknowledge the trigger.', y);

  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, '5. Qualitative Overlay — 2nd Line Validation', y, color);
  y = addBody(doc, 'The scored tier is a quantitative starting point. The 2nd Line reviewer applies a qualitative overlay to consider factors that may not be fully captured by the scoring questions. The 2nd Line may override the tier upward or downward, with documented rationale.', y);
  y = addBullet(doc, [
    'Upward override: used when the scored tier understates the actual risk (e.g., a vendor in a sensitive niche with no viable substitutes scores Tier 2 but the 2nd Line deems the business dependency to be Tier 3).',
    'Downward override: used when strong compensating controls materially reduce the risk (e.g., a vendor with high data access scores Tier 4 but holds SOC 2 Type II and ISO 27001 certifications with no findings).',
    'All overrides require a written rationale that is stored in the audit trail.',
    'Downward overrides for Tier 5 critical classification require Senior Management concurrence.',
  ], y);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `Vendor_Tiering_Methodology_${date}.pdf`);
}

export function generateRiskAssessmentFramework(opts: DocOptions): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const color = CATEGORY_COLORS['Risk Management'];
  const date = getDateStr();

  addCoverPage(doc, 'Risk Assessment Framework', 'Risk Management', opts.orgName, date, color);

  doc.addPage();
  let y = MARGIN + 6;

  y = addSectionTitle(doc, '1. Framework Overview', y, color);
  y = addBody(doc, 'The Risk Assessment Framework underpins the vendor tiering methodology. It defines the questions, scoring logic, category weightings, and tier thresholds used in every assessment completed on the platform. This document provides the reference information needed to understand how tier recommendations are generated and how the scores map to organizational risk.', y);
  y = addBody(doc, 'The framework is aligned with OSFI B-10 requirements and draws on industry standards including NIST Cybersecurity Framework, ISO 31000, and ISACA\'s COBIT framework for IT risk management.', y);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '2. Operational Risk Category', y, color);
  y = addBody(doc, 'Operational risk assesses the degree to which the organization depends on the vendor for its day-to-day operations and what the consequences of a service disruption would be.', y);
  y = addTable(doc, ['Question Area', 'Score 0', 'Score 1', 'Score 2', 'Score 3', 'Score 4'],
    [
      ['Business dependency', 'No operational role', 'Minor support function', 'Important but replaceable', 'Core business support', 'Mission-critical'],
      ['Number of business units served', '1', '2–3', '4–5', '6–8', '9+'],
      ['Substitutability', 'Multiple alternatives readily available', 'Alternatives exist (3–6 months to transition)', 'Limited alternatives (6–12 months)', 'Very few alternatives (12–24 months)', 'No viable substitute'],
      ['Disruption impact', 'Minimal / cosmetic', 'Minor operational', 'Moderate operational', 'Significant operational', 'Catastrophic / regulatory'],
      ['Concentration (revenue %)', '< 5%', '5–15%', '15–25%', '25–40%', '> 40%'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '3. Financial Risk Category', y, color);
  y = addTable(doc, ['Question Area', 'Score 0', 'Score 1', 'Score 2', 'Score 3', 'Score 4'],
    [
      ['Annual contract value', '< $100K', '$100K–$500K', '$500K–$2M', '$2M–$10M', '> $10M'],
      ['Vendor financial stability', 'Large, publicly listed', 'Mid-size, audited financials', 'Private, limited disclosure', 'Early-stage or private', 'Financial distress signals present'],
      ['Revenue dependency (vendor side)', 'Our org < 5% of revenue', '5–15%', '15–30%', '30–50%', '> 50% — vendor dependent on us'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '4. Data & Cyber Risk Category', y, color);
  y = addTable(doc, ['Question Area', 'Score 0', 'Score 1', 'Score 2', 'Score 3', 'Score 4'],
    [
      ['Data access level', 'No data access', 'Non-sensitive / aggregated only', 'Sensitive personal data (non-financial)', 'Financial personal data', 'Core banking / regulated data'],
      ['Volume of data processed', 'None', 'Minimal (< 1,000 records)', 'Moderate (1,000–10,000)', 'Large (10,000–100,000)', 'Very large (100,000+)'],
      ['Cybersecurity certification', 'SOC 2 Type II + ISO 27001 current', 'SOC 2 Type II current', 'SOC 2 Type I or equivalent', 'Self-assessment only', 'No evidence of security controls'],
      ['Data jurisdiction', 'Canada only', 'Canada + Five Eyes allies', 'Other low-risk countries', 'Mixed including moderate-risk', 'High-risk jurisdictions'],
      ['Penetration testing frequency', 'Annual external pentest + bug bounty', 'Annual external pentest', 'Biennial external pentest', 'Internal testing only', 'No pentest evidence'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '5. Geographic Risk Category', y, color);
  y = addTable(doc, ['Question Area', 'Score 0', 'Score 1', 'Score 2', 'Score 3', 'Score 4'],
    [
      ['Country of service delivery', 'Canada only', 'Canada + stable G7 country', 'Other OECD member', 'Non-OECD stable', 'High-risk / sanctioned jurisdiction'],
      ['Geopolitical risk', 'None identified', 'Low — established democracies', 'Moderate — emerging markets', 'Elevated — political instability', 'High — active conflict / sanctions'],
      ['Regulatory environment alignment', 'Equivalent to Canadian standards', 'Strong regulatory oversight', 'Developing regulatory framework', 'Minimal regulatory oversight', 'Inadequate / non-existent oversight'],
    ], y, color);

  y = checkPage(doc, y, 35);
  y = addSectionTitle(doc, '6. Regulatory Risk Category', y, color);
  y = addTable(doc, ['Question Area', 'Score 0', 'Score 1', 'Score 2', 'Score 3', 'Score 4'],
    [
      ['Regulated activity outsourcing', 'Non-regulated activity', 'Regulated activity — limited scope', 'Regulated activity — moderate scope', 'Core regulated function', 'Regulated function with OSFI notification required'],
      ['Licensing and registration', 'Fully licensed in all jurisdictions', 'Licensed in primary jurisdictions', 'License pending or grandfathered', 'Exemptions / special status', 'Unlicensed in material jurisdictions'],
      ['AML/CTF relevance', 'No AML/CTF overlap', 'Indirect (data only)', 'Indirect (process support)', 'Direct (transaction monitoring or KYC support)', 'Core AML/CTF function outsourced'],
    ], y, color);

  doc.addPage();
  y = MARGIN + 6;

  y = addSectionTitle(doc, '7. Score Aggregation and Tier Assignment', y, color);
  y = addBody(doc, 'After all questions are answered, the platform calculates a weighted composite score:', y);
  y = addBullet(doc, [
    'Each category score is normalized to a 0–100 scale based on the maximum possible score in that category.',
    'Category weights are applied: Operational 30%, Cyber/Data 25%, Financial 15%, Geographic 15%, Regulatory 15%.',
    'The weighted scores are summed to produce the composite score (0–100).',
    'The composite score is mapped to a tier using the tier threshold table.',
    'If any auto-critical rule is triggered, the tier is automatically set to Tier 5 regardless of composite score.',
    'The 2nd Line reviewer can override the scored tier with documented rationale.',
  ], y);

  y = checkPage(doc, y, 30);
  y = addSectionTitle(doc, '8. Assessment Frequency and Triggers', y, color);
  y = addTable(doc, ['Trigger Type', 'Description', 'Action Required'],
    [
      ['Periodic reassessment', 'Scheduled based on tier (semi-annual for T5, annual for T3–4, 2–3 years for T1–2)', 'Full reassessment in wizard'],
      ['Material change', 'Significant change in vendor\'s service, data access, or contract scope', 'Reassessment + 2nd Line review'],
      ['Contract renewal', 'Renewal of a contract for a Tier 3+ vendor', 'Reassessment prior to renewal'],
      ['Incident-triggered', 'High or Critical severity incident affecting the vendor', 'Expedited reassessment'],
      ['Regulatory directive', 'OSFI or other regulator directs reassessment', 'Immediate reassessment'],
    ], y, color);

  applyAllFooters(doc, opts.orgName);
  saveDoc(doc, `Risk_Assessment_Framework_${date}.pdf`);
}

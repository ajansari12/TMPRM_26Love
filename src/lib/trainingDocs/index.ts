import { DocOptions } from './helpers';
import { generateThreeLinesGuide, generate1AOrientationGuide } from './generators/orientation';
import { generate1BUserGuide } from './generators/coordinator';
import { generateOSFIB10Reference, generateRegulatoryRequirementsSummary } from './generators/compliance';
import { generateTieringMethodology, generateRiskAssessmentFramework } from './generators/risk';
import { generateOnboardingWorkflowReference } from './generators/workflow';
import { generateContractManagementGuide } from './generators/contracts';
import { generatePlatformGlossary } from './generators/glossary';

export type DocGenerator = (opts: DocOptions) => void;

export const TRAINING_DOC_GENERATORS: Record<string, DocGenerator> = {
  'Three Lines of Defense: Platform Role Guide': generateThreeLinesGuide,
  '1st Line Business (1A): Quick Orientation Guide': generate1AOrientationGuide,
  '1st Line Coordinator (1B): Full User Guide': generate1BUserGuide,
  'OSFI B-10 Compliance Reference': generateOSFIB10Reference,
  'Vendor Tiering Methodology': generateTieringMethodology,
  'Onboarding Workflow Reference': generateOnboardingWorkflowReference,
  'Risk Assessment Framework': generateRiskAssessmentFramework,
  'Contract Management Best Practices': generateContractManagementGuide,
  'TPRM Regulatory Requirements Summary': generateRegulatoryRequirementsSummary,
  'Platform Glossary of Terms': generatePlatformGlossary,
};

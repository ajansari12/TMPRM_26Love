import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';
import {
  OnboardingAssessmentData,
  calculateNextReviewDateFromTier,
  extractAssessmentFieldsForVendor,
} from './assessmentValidation';
import { notifyRequestor } from './workflowEmail';
import type { OnboardingRequest } from '../types/workflow';

export interface VendorCreationContext {
  organizationId: string;
  organizationName: string;
  profileId: string;
  profileName: string;
  profileEmail: string;
  defenseLine?: string;
}

export interface VendorCreationResult {
  vendorId: string;
  globalLinkInfo: {
    matched: boolean;
    globalPartyId?: string;
    globalPartyName?: string;
    created?: boolean;
  } | null;
  assessmentTaskInfo: {
    taskId: string;
    dueDate: string;
    priority: string;
  } | null;
}

function mapRiskTierToVendorTier(riskTier: string | undefined): string | null {
  if (!riskTier) return null;
  const tierMap: Record<string, string> = {
    critical: 'tier_5_critical',
    high: 'tier_4_high',
    medium: 'tier_3_moderate',
    low: 'tier_2_low',
  };
  return tierMap[riskTier] || null;
}

function calculateAssessmentDueDate(riskTier: string | undefined): { dueDate: Date; priority: string } {
  const now = new Date();
  let daysToAdd = 14;
  let priority = 'normal';

  switch (riskTier) {
    case 'critical':
      daysToAdd = 7;
      priority = 'urgent';
      break;
    case 'high':
      daysToAdd = 10;
      priority = 'high';
      break;
    case 'medium':
      daysToAdd = 14;
      priority = 'normal';
      break;
    case 'low':
    default:
      daysToAdd = 21;
      priority = 'low';
      break;
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + daysToAdd);
  return { dueDate, priority };
}

export async function createVendorFromApprovedRequest(
  supabase: SupabaseClient,
  request: OnboardingRequest,
  ctx: VendorCreationContext
): Promise<VendorCreationResult> {
  const requestData = request as unknown as OnboardingAssessmentData;
  const effectiveTier =
    requestData.validated_tier ||
    requestData.calculated_tier ||
    mapRiskTierToVendorTier(request.preliminary_risk_tier);
  const hasCompletedAssessment =
    requestData.assessment_validated || requestData.assessment_completed;
  const nextReviewDate = calculateNextReviewDateFromTier(effectiveTier || 'tier_3_moderate');

  const vendorData = {
    organization_id: ctx.organizationId,
    legal_name: request.vendor_legal_name,
    trading_name: request.vendor_trading_name || null,
    country: request.vendor_country,
    province_state: request.vendor_province_state || null,
    city: request.vendor_city || null,
    website: request.vendor_website || null,
    service_category: request.service_category,
    service_description: request.service_description || null,
    provider_type: request.provider_type,
    business_unit: request.requesting_business_unit,
    is_critical:
      request.is_critical_service ||
      requestData.is_auto_critical ||
      effectiveTier === 'tier_5_critical',
    tier: effectiveTier,
    status: hasCompletedAssessment ? 'active' : 'pending_assessment',
    lifecycle_stage: 'onboarding',
    handles_sensitive_data: request.handles_sensitive_data,
    has_system_access: request.has_system_access,
    uses_subcontractors: request.uses_subcontractors,
    data_location: request.data_location || null,
    contract_value_cad: request.estimated_contract_value_cad || null,
    primary_contact_name: request.vendor_primary_contact_name || null,
    primary_contact_email: request.vendor_primary_contact_email || null,
    primary_contact_phone: request.vendor_primary_contact_phone || null,
    number_of_employees: request.vendor_number_of_employees || null,
    years_in_operation: request.vendor_years_in_operation || null,
    onboarding_request_id: request.id,
    created_by: ctx.profileId,
    assessment_source: hasCompletedAssessment ? 'onboarding' : 'tiering_assessment',
    initial_onboarding_request_id: request.id,
    onboarding_assessment_date: hasCompletedAssessment ? new Date().toISOString() : null,
    last_review_date: hasCompletedAssessment ? new Date().toISOString().split('T')[0] : null,
    next_review_date: hasCompletedAssessment && nextReviewDate ? nextReviewDate : null,
    impact_score: requestData.calculated_impact_score || null,
    likelihood_score: requestData.calculated_likelihood_score || null,
    risk_rating: requestData.calculated_risk_rating || null,
  };

  const { data: vendorResult, error: vendorError } = await supabase
    .from('vendors')
    .insert(vendorData)
    .select('id')
    .single();

  if (vendorError) throw vendorError;

  let assessmentTaskInfo: VendorCreationResult['assessmentTaskInfo'] = null;

  if (hasCompletedAssessment) {
    const assessmentFields = extractAssessmentFieldsForVendor(requestData);
    const tieringAssessmentData = {
      vendor_id: vendorResult.id,
      organization_id: ctx.organizationId,
      assessment_type: 'initial',
      assessment_date: new Date().toISOString().split('T')[0],
      status: 'completed',
      ...assessmentFields,
      impact_score: requestData.calculated_impact_score,
      likelihood_score: requestData.calculated_likelihood_score,
      risk_rating: requestData.calculated_risk_rating,
      calculated_tier: effectiveTier,
      is_auto_critical: requestData.is_auto_critical,
      auto_critical_rule_name: requestData.auto_critical_rule_name,
      assessor_name: ctx.profileName || ctx.profileEmail,
      completed_by: ctx.profileId,
      completed_at: new Date().toISOString(),
      validation_notes: requestData.tier_adjustment_reason,
    };

    const { error: assessmentError } = await supabase
      .from('tiering_assessments')
      .insert(tieringAssessmentData);

    if (assessmentError) {
      logger.warn('Could not create tiering assessment record:', assessmentError);
    }
  } else {
    const { dueDate, priority } = calculateAssessmentDueDate(request.preliminary_risk_tier);

    const { data: taskResult, error: taskError } = await supabase
      .from('assessment_tasks')
      .insert({
        organization_id: ctx.organizationId,
        vendor_id: vendorResult.id,
        task_type: 'initial_assessment',
        status: 'pending',
        priority,
        assigned_defense_line: '2nd',
        due_date: dueDate.toISOString().split('T')[0],
        notes: `Initial risk assessment required for newly onboarded vendor: ${request.vendor_legal_name}. Preliminary risk tier: ${request.preliminary_risk_tier || 'Not assessed'}.`,
      })
      .select('id')
      .single();

    if (!taskError && taskResult) {
      assessmentTaskInfo = {
        taskId: taskResult.id,
        dueDate: dueDate.toISOString().split('T')[0],
        priority,
      };
    }
  }

  const globalLinkInfo = await linkToGlobalRegistry(
    supabase,
    vendorResult.id,
    request,
    ctx
  );

  const { error: updateError } = await supabase
    .from('onboarding_requests')
    .update({
      status: 'vendor_created',
      created_vendor_id: vendorResult.id,
      vendor_created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  if (updateError) throw updateError;

  await supabase.from('onboarding_audit_log').insert({
    organization_id: ctx.organizationId,
    request_id: request.id,
    action_type: 'vendor_created',
    action_description: `Vendor record created: ${request.vendor_legal_name}`,
    previous_status: request.status,
    new_status: 'vendor_created',
    performed_by: ctx.profileId,
    performed_by_name: ctx.profileName || ctx.profileEmail,
    performed_by_defense_line: ctx.defenseLine,
    new_values: {
      vendor_id: vendorResult.id,
      global_link: globalLinkInfo,
    },
  });

  if (request.requested_by) {
    notifyRequestor(request.requested_by, ctx.organizationId, {
      event_type: 'vendor_created',
      request_id: request.id,
      request_number: request.request_number || '',
      vendor_name: request.vendor_legal_name,
      actor_name: ctx.profileName || ctx.profileEmail || '',
      organization_name: ctx.organizationName,
      link_url: `/vendors/${vendorResult.id}`,
    });
  }

  return {
    vendorId: vendorResult.id,
    globalLinkInfo,
    assessmentTaskInfo,
  };
}

async function linkToGlobalRegistry(
  supabase: SupabaseClient,
  vendorId: string,
  request: OnboardingRequest,
  ctx: VendorCreationContext
): Promise<VendorCreationResult['globalLinkInfo']> {
  const { data: globalMatch } = await supabase
    .from('global_third_parties')
    .select('id, legal_name')
    .ilike('legal_name', request.vendor_legal_name)
    .maybeSingle();

  if (globalMatch) {
    const { error: linkError } = await supabase
      .from('vendor_global_links')
      .insert({
        vendor_id: vendorId,
        global_third_party_id: globalMatch.id,
        organization_id: ctx.organizationId,
        link_confidence: 'auto_matched',
        linked_by: ctx.profileId,
      });

    if (!linkError) {
      return {
        matched: true,
        globalPartyId: globalMatch.id,
        globalPartyName: globalMatch.legal_name,
      };
    }
  } else {
    const { data: newGlobalParty, error: createError } = await supabase
      .from('global_third_parties')
      .insert({
        legal_name: request.vendor_legal_name,
        trading_names: request.vendor_trading_name
          ? [request.vendor_trading_name]
          : null,
        headquarters_country: request.vendor_country,
        website: request.vendor_website || null,
        primary_service_categories: request.service_category
          ? [request.service_category]
          : null,
        created_by: ctx.profileId,
        verification_status: 'pending_review',
      })
      .select('id')
      .maybeSingle();

    if (!createError && newGlobalParty) {
      await supabase.from('vendor_global_links').insert({
        vendor_id: vendorId,
        global_third_party_id: newGlobalParty.id,
        organization_id: ctx.organizationId,
        link_confidence: 'high',
        linked_by: ctx.profileId,
      });

      return {
        matched: false,
        globalPartyId: newGlobalParty.id,
        created: true,
      };
    }

    return { matched: false, created: false };
  }

  return null;
}

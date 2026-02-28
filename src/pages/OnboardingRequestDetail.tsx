import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { logger } from '../lib/logger';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  Globe,
  DollarSign,
  Calendar,
  User,
  FileText,
  MessageSquare,
  Send,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  ChevronRight,
  Paperclip,
  Shield,
  BadgeCheck,
  UserPlus,
  ExternalLink,
  Link2,
  BarChart3,
  Briefcase,
  HelpCircle,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  OnboardingRequest,
  OnboardingComment,
  OnboardingAuditEntry,
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  RISK_TIER_LABELS,
  RISK_TIER_COLORS,
  RiskTier,
  SENIOR_REVIEW_DECISION_LABELS,
  SeniorApprover,
} from '../types/workflow';
import { DEFENSE_LINE_LABELS } from '../types/organization';
import { supabase } from '../lib/supabase';
import { AssessmentDisplayPanel, FirstLineReviewPanel, SecondLineValidationPanel, ValidationData } from '../components/onboarding';
import { OnboardingAssessmentData, TIER_DISPLAY_CONFIG } from '../lib/assessmentValidation';
import OnboardingDocuments from '../components/OnboardingDocuments';
import OnboardingProgressTracker from '../components/OnboardingProgressTracker';
import { notifyReviewers, notifyRequestor } from '../lib/workflowEmail';
import { findLeastLoadedReviewer, findSeniorApprover } from '../lib/reviewerAssignment';
import { createVendorFromApprovedRequest } from '../lib/vendorCreation';
import { useDefenseLineAccess } from '../hooks/useDefenseLineAccess';

export default function OnboardingRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentMembership, currentOrganization, isAdmin } = useOrganization();
  const { profile } = useAuth();
  const access = useDefenseLineAccess();

  const [request, setRequest] = useState<OnboardingRequest | null>(null);
  const [comments, setComments] = useState<OnboardingComment[]>([]);
  const [auditLog, setAuditLog] = useState<OnboardingAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'details' | 'assessment' | 'comments' | 'documents' | 'timeline'
  >('details');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [reviewAction, setReviewAction] = useState<
    | 'confirm'
    | 'return'
    | 'accept'
    | 'reject'
    | 'accept_with_conditions'
    | 'fast_track_approve'
    | 'senior_approve'
    | 'senior_approve_with_conditions'
    | 'senior_request_info'
    | 'senior_reject'
    | 'reforward_2nd'
    | null
  >(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewConditions, setReviewConditions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seniorApprovers, setSeniorApprovers] = useState<SeniorApprover[]>([]);
  const [isSeniorApprover, setIsSeniorApprover] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);

  const [showVendorCreatedModal, setShowVendorCreatedModal] = useState(false);
  const [createdVendorId, setCreatedVendorId] = useState<string | null>(null);
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [globalLinkInfo, setGlobalLinkInfo] = useState<{
    matched: boolean;
    globalPartyId?: string;
    globalPartyName?: string;
    created?: boolean;
  } | null>(null);
  const [assessmentTaskInfo, setAssessmentTaskInfo] = useState<{
    taskId: string;
    dueDate: string;
    priority: string;
  } | null>(null);

  const fetchRequest = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const { data: requestData, error: requestError } = await supabase
        .from('onboarding_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (requestError) throw requestError;

      if (!requestData) {
        setRequest(null);
        return;
      }

      const mappedRequest: OnboardingRequest = {
        ...requestData,
        estimated_contract_value_cad: requestData.estimated_contract_value_cad
          ? parseFloat(requestData.estimated_contract_value_cad)
          : undefined,
        requesting_business_unit: requestData.requesting_business_unit,
        preliminary_risk_tier: mapRiskTier(requestData.preliminary_risk_tier),
      };

      setRequest(mappedRequest);

      const { data: commentsData, error: commentsError } = await supabase
        .from('onboarding_comments')
        .select('*')
        .eq('request_id', id)
        .order('created_at', { ascending: true });

      if (commentsError) {
        logger.error('Error fetching comments:', commentsError);
      } else {
        const mappedComments: OnboardingComment[] = (commentsData || []).map(
          (c) => ({
            id: c.id,
            organization_id: c.organization_id,
            request_id: c.request_id,
            task_id: c.task_id,
            parent_comment_id: c.parent_comment_id,
            comment_type: c.comment_type || 'general',
            defense_line: c.defense_line,
            content: c.content,
            is_internal: c.is_internal || false,
            visible_to_lines: c.visible_to_lines || [],
            author_id: c.author_id,
            author_name: c.author_name,
            author_role: c.author_role,
            mentioned_users: c.mentioned_users,
            attachment_ids: c.attachment_ids,
            is_edited: c.is_edited || false,
            edited_at: c.edited_at,
            created_at: c.created_at,
          })
        );
        setComments(mappedComments);
      }

      const { data: auditData, error: auditError } = await supabase
        .from('onboarding_audit_log')
        .select('*')
        .eq('request_id', id)
        .order('performed_at', { ascending: true });

      if (auditError) {
        logger.error('Error fetching audit log:', auditError);
      } else {
        const mappedAudit: OnboardingAuditEntry[] = (auditData || []).map(
          (a) => ({
            id: a.id,
            organization_id: a.organization_id,
            request_id: a.request_id,
            action_type: a.action_type,
            action_description: a.action_description,
            previous_status: a.previous_status,
            new_status: a.new_status,
            previous_defense_line: a.previous_defense_line,
            new_defense_line: a.new_defense_line,
            changed_fields: a.changed_fields,
            previous_values: a.previous_values,
            new_values: a.new_values,
            performed_by: a.performed_by,
            performed_by_name: a.performed_by_name,
            performed_by_defense_line: a.performed_by_defense_line,
            ip_address: a.ip_address,
            user_agent: a.user_agent,
            performed_at: a.performed_at,
          })
        );
        setAuditLog(mappedAudit);
      }

      const { count: docCount } = await supabase
        .from('onboarding_documents')
        .select('*', { count: 'exact', head: true })
        .eq('request_id', id)
        .eq('is_current', true);
      setDocumentCount(docCount || 0);
    } catch (err) {
      logger.error('Error fetching request:', err);
      setError('Failed to load request details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  useEffect(() => {
    const fetchSeniorApprovers = async () => {
      if (!currentOrganization?.id || !profile?.id) return;

      const { data, error } = await supabase
        .from('senior_approvers')
        .select('*, user:auth.users(id, email)')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true);

      if (!error && data) {
        setSeniorApprovers(data);
        const isApprover = data.some((a) => a.user_id === profile.id && a.is_available);
        setIsSeniorApprover(isApprover);
      }
    };

    fetchSeniorApprovers();
  }, [currentOrganization?.id, profile?.id]);

  const mapRiskTier = (tier: string | null): RiskTier | undefined => {
    if (!tier) return undefined;
    const tierMap: Record<string, RiskTier> = {
      tier_5_critical: 'critical',
      tier_4_high: 'high',
      tier_3_moderate: 'medium',
      tier_2_low: 'low',
      tier_1_informational: 'low',
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    return tierMap[tier] || undefined;
  };

  const canReview = () => {
    if (!request || !currentMembership) return false;
    if (access.isReadOnly) return false;

    if (isAdmin) {
      return ['1b_review', '2nd_review', '2nd_returned', 'pending_senior_approval'].includes(request.status);
    }

    if (request.status === '1b_review' && currentMembership.defense_line === '1b') {
      return true;
    }

    if (request.status === '2nd_returned' && currentMembership.defense_line === '1b') {
      return true;
    }

    if (request.status === '2nd_review' && currentMembership.defense_line === '2nd') {
      return true;
    }

    if (request.status === 'pending_senior_approval' && isSeniorApprover) {
      return true;
    }

    return false;
  };

  const canWithdraw = () => {
    if (!request || !profile) return false;
    if (access.isReadOnly) return false;
    const isRequestor = request.requested_by === profile.id;
    if (!isRequestor && !isAdmin) return false;
    return ['draft', 'submitted', '1b_review', '1b_returned', '2nd_returned'].includes(request.status);
  };

  const isLowRiskVendor = () => {
    if (!request) return false;
    const requestData = request as unknown as OnboardingAssessmentData;
    const tier = requestData.validated_tier || requestData.calculated_tier;
    return tier === 'tier_1_informational' || tier === 'tier_2_low';
  };

  const canFastTrackApprove = () => {
    if (!request || !currentMembership || !currentOrganization) return false;

    const is1bReviewer = currentMembership.defense_line === '1b' && request.status === '1b_review';

    if (!is1bReviewer && !isAdmin) return false;

    const settings = currentOrganization.settings as Record<string, unknown> | undefined;
    const fastTrackEnabled = settings?.enable_fast_track_approval !== false;

    return fastTrackEnabled && isLowRiskVendor();
  };

  const canAdjustTier = () => {
    if (!request || !currentMembership) return false;
    if (access.isReadOnly) return false;

    const is2ndLine = currentMembership.defense_line === '2nd';
    const isInReview = request.status === '2nd_review';

    return (is2ndLine || isAdmin) && isInReview;
  };

  const canConductIndependentAssessment = () => {
    if (!request || !currentMembership) return false;
    if (access.isReadOnly) return false;

    const is2ndLine = currentMembership.defense_line === '2nd';
    const isInReview = request.status === '2nd_review';

    return (is2ndLine || isAdmin) && isInReview;
  };

  const getAvailableActions = () => {
    if (!request || !currentMembership) return [];
    if (access.isReadOnly) return [];

    if (request.status === '1b_review' && (currentMembership.defense_line === '1b' || isAdmin)) {
      const actions = ['confirm', 'return'];
      if (canFastTrackApprove()) {
        actions.unshift('fast_track_approve');
      }
      return actions;
    }

    if (request.status === '2nd_returned' && (currentMembership.defense_line === '1b' || isAdmin)) {
      return ['reforward_2nd', 'return'];
    }

    if (request.status === '2nd_review' && (currentMembership.defense_line === '2nd' || isAdmin)) {
      return ['accept', 'accept_with_conditions', 'reject', 'return'];
    }

    if (request.status === 'pending_senior_approval' && (isSeniorApprover || isAdmin)) {
      return ['senior_approve', 'senior_approve_with_conditions', 'senior_request_info', 'senior_reject'];
    }

    return [];
  };

  const handleReviewAction = async () => {
    if (!reviewAction || !reviewNotes.trim() || !request || !currentOrganization)
      return;

    setSubmitting(true);
    try {
      let newStatus = request.status;
      let newDefenseLine = request.current_defense_line;
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      const is1bRole = currentMembership?.defense_line === '1b' ||
        (isAdmin && (request.status === '1b_review' || request.status === '2nd_returned'));
      const is2ndRole = currentMembership?.defense_line === '2nd' ||
        (isAdmin && request.status === '2nd_review');
      const is1bOnReturned = is1bRole && request.status === '2nd_returned';

      if (is1bRole) {
        if (reviewAction === 'fast_track_approve') {
          newStatus = 'approved';
          newDefenseLine = '1b';
          updateData.reviewed_by_1b = profile?.id;
          updateData.reviewed_at_1b = new Date().toISOString();
          updateData.review_decision_1b = 'fast_track_approved';
          updateData.review_notes_1b = reviewNotes;
          updateData.completeness_confirmed = true;
          updateData.business_need_validated = true;
          updateData.initial_risk_acknowledged = true;
          updateData.final_status = 'approved';
          updateData.final_decision_by = profile?.id;
          updateData.final_decision_at = new Date().toISOString();
          updateData.fast_track_approved = true;
        } else if (reviewAction === 'confirm') {
          newStatus = request.requires_2nd_line_review ? '2nd_review' : 'approved';
          newDefenseLine = request.requires_2nd_line_review ? '2nd' : '1b';
          updateData.reviewed_by_1b = profile?.id;
          updateData.reviewed_at_1b = new Date().toISOString();
          updateData.review_decision_1b = 'confirmed';
          updateData.review_notes_1b = reviewNotes;
          updateData.completeness_confirmed = true;
          updateData.business_need_validated = true;
          updateData.initial_risk_acknowledged = true;
          if (request.requires_2nd_line_review) {
            const assigned2nd = await findLeastLoadedReviewer(
              currentOrganization.id,
              '2nd',
              request.requesting_business_unit as string
            );
            if (assigned2nd) {
              updateData.assigned_2nd_reviewer = assigned2nd;
              updateData.assigned_2nd_at = new Date().toISOString();
            }
          }
        } else if (reviewAction === 'return' && !is1bOnReturned) {
          newStatus = '1b_returned';
          newDefenseLine = '1a';
          updateData.review_decision_1b = 'returned';
          updateData.review_notes_1b = reviewNotes;
        } else if (reviewAction === 'reforward_2nd' && is1bOnReturned) {
          newStatus = '2nd_review';
          newDefenseLine = '2nd';
          updateData.review_notes_1b = reviewNotes;
          updateData.reviewed_by_2nd = null;
          updateData.reviewed_at_2nd = null;
          updateData.review_decision_2nd = null;
          updateData.review_notes_2nd = null;
          updateData.assigned_2nd_reviewer = null;
          updateData.assigned_2nd_at = null;
          const assigned2nd = await findLeastLoadedReviewer(
            currentOrganization.id,
            '2nd',
            request.requesting_business_unit as string
          );
          if (assigned2nd) {
            updateData.assigned_2nd_reviewer = assigned2nd;
            updateData.assigned_2nd_at = new Date().toISOString();
          }
        } else if (reviewAction === 'return' && is1bOnReturned) {
          newStatus = '1b_returned';
          newDefenseLine = '1a';
          updateData.review_notes_1b = reviewNotes;
        }
      } else if (is2ndRole) {
        if (reviewAction === 'accept') {
          const effectiveTier = validationData?.validatedTier ||
            (request as unknown as OnboardingAssessmentData).calculated_tier ||
            request.preliminary_risk_tier;
          const requiresSeniorApproval = effectiveTier === 'tier_5_critical' ||
            effectiveTier === 'critical' ||
            request.requires_senior_approval;

          if (requiresSeniorApproval) {
            newStatus = 'pending_senior_approval';
            newDefenseLine = 'senior_management';
            updateData.requires_senior_approval = true;
            const assignedSenior = await findSeniorApprover(
              currentOrganization.id,
              effectiveTier as string
            );
            if (assignedSenior) {
              updateData.assigned_senior_approver = assignedSenior;
              updateData.assigned_senior_at = new Date().toISOString();
            }
          } else {
            newStatus = 'approved';
            updateData.final_status = 'approved';
            updateData.final_decision_by = profile?.id;
            updateData.final_decision_at = new Date().toISOString();
          }
          updateData.reviewed_by_2nd = profile?.id;
          updateData.reviewed_at_2nd = new Date().toISOString();
          updateData.review_decision_2nd = 'accepted';
          updateData.review_notes_2nd = reviewNotes;
          if (validationData) {
            updateData.assessment_validated = true;
            updateData.assessment_validated_by = profile?.id;
            updateData.assessment_validated_at = new Date().toISOString();
            updateData.validated_tier = validationData.validatedTier;
            updateData.tier_adjustment_reason = validationData.tierAdjustmentReason || null;
            updateData.independent_assessment_conducted = validationData.conductIndependentAssessment;
            updateData.due_diligence_requirements = validationData.selectedDueDiligence;
          }
        } else if (reviewAction === 'accept_with_conditions') {
          newStatus = 'conditionally_approved';
          updateData.reviewed_by_2nd = profile?.id;
          updateData.reviewed_at_2nd = new Date().toISOString();
          updateData.review_decision_2nd = 'conditionally_approved';
          updateData.review_notes_2nd = reviewNotes;
          updateData.approval_conditions = [reviewConditions];
          if (validationData) {
            updateData.assessment_validated = true;
            updateData.assessment_validated_by = profile?.id;
            updateData.assessment_validated_at = new Date().toISOString();
            updateData.validated_tier = validationData.validatedTier;
            updateData.tier_adjustment_reason = validationData.tierAdjustmentReason || null;
            updateData.independent_assessment_conducted = validationData.conductIndependentAssessment;
            updateData.due_diligence_requirements = validationData.selectedDueDiligence;
          }
        } else if (reviewAction === 'reject') {
          newStatus = 'rejected';
          updateData.reviewed_by_2nd = profile?.id;
          updateData.reviewed_at_2nd = new Date().toISOString();
          updateData.review_decision_2nd = 'rejected';
          updateData.review_notes_2nd = reviewNotes;
          updateData.final_status = 'rejected';
          updateData.final_decision_by = profile?.id;
          updateData.final_decision_at = new Date().toISOString();
        } else if (reviewAction === 'return') {
          newStatus = '2nd_returned';
          newDefenseLine = '1b';
          updateData.review_decision_2nd = 'returned';
          updateData.review_notes_2nd = reviewNotes;
        }
      }

      const isSeniorRole = isSeniorApprover || isAdmin;
      if (isSeniorRole && request.status === 'pending_senior_approval') {
        if (reviewAction === 'senior_approve') {
          newStatus = 'approved';
          newDefenseLine = 'senior_management';
          updateData.reviewed_by_senior = profile?.id;
          updateData.reviewed_at_senior = new Date().toISOString();
          updateData.review_decision_senior = 'approved';
          updateData.review_notes_senior = reviewNotes;
          updateData.final_status = 'approved';
          updateData.final_decision_by = profile?.id;
          updateData.final_decision_at = new Date().toISOString();
        } else if (reviewAction === 'senior_approve_with_conditions') {
          newStatus = 'conditionally_approved';
          newDefenseLine = 'senior_management';
          updateData.reviewed_by_senior = profile?.id;
          updateData.reviewed_at_senior = new Date().toISOString();
          updateData.review_decision_senior = 'approved_with_conditions';
          updateData.review_notes_senior = reviewNotes;
          updateData.senior_approval_conditions = reviewConditions;
        } else if (reviewAction === 'senior_request_info') {
          newStatus = '2nd_returned';
          newDefenseLine = '2nd';
          updateData.review_decision_senior = 'request_info';
          updateData.review_notes_senior = reviewNotes;
        } else if (reviewAction === 'senior_reject') {
          newStatus = 'rejected';
          newDefenseLine = 'senior_management';
          updateData.reviewed_by_senior = profile?.id;
          updateData.reviewed_at_senior = new Date().toISOString();
          updateData.review_decision_senior = 'rejected';
          updateData.review_notes_senior = reviewNotes;
          updateData.final_status = 'rejected';
          updateData.final_decision_by = profile?.id;
          updateData.final_decision_at = new Date().toISOString();
        }
      }

      updateData.status = newStatus;
      updateData.current_defense_line = newDefenseLine;

      const { error: updateError } = await supabase
        .from('onboarding_requests')
        .update(updateData)
        .eq('id', request.id);

      if (updateError) throw updateError;

      await supabase.from('onboarding_audit_log').insert({
        organization_id: currentOrganization.id,
        request_id: request.id,
        action_type: `review_${reviewAction}`,
        action_description: `${currentMembership?.defense_line?.toUpperCase()} review: ${reviewAction}`,
        previous_status: request.status,
        new_status: newStatus,
        previous_defense_line: request.current_defense_line,
        new_defense_line: newDefenseLine,
        performed_by: profile?.id,
        performed_by_name: profile?.full_name || profile?.email,
        performed_by_defense_line: currentMembership?.defense_line,
        new_values: { notes: reviewNotes, conditions: reviewConditions },
      });

      const emailParams = {
        request_id: request.id,
        request_number: request.request_number || '',
        vendor_name: request.vendor_legal_name,
        actor_name: profile?.full_name || profile?.email || '',
        organization_name: currentOrganization.name,
        notes: reviewNotes,
        conditions: reviewConditions,
      };

      if (reviewAction === 'confirm' && newStatus === '2nd_review') {
        notifyReviewers(currentOrganization.id, '2nd', {
          event_type: 'request_submitted',
          ...emailParams,
        });
      } else if (reviewAction === 'reforward_2nd' && newStatus === '2nd_review') {
        notifyReviewers(currentOrganization.id, '2nd', {
          event_type: 'request_submitted',
          ...emailParams,
          notes: `Re-forwarded after addressing 2nd Line feedback. 1B Notes: ${reviewNotes}`,
        });
      } else if (reviewAction === 'return' && request.requested_by) {
        notifyRequestor(request.requested_by, currentOrganization.id, {
          event_type: 'request_returned',
          ...emailParams,
        });
      } else if (reviewAction === 'accept' && newStatus === 'pending_senior_approval') {
        notifyReviewers(currentOrganization.id, 'senior_management', {
          event_type: 'senior_approval_required',
          ...emailParams,
        });
      } else if ((reviewAction === 'accept' || reviewAction === 'fast_track_approve' || reviewAction === 'senior_approve') && request.requested_by) {
        notifyRequestor(request.requested_by, currentOrganization.id, {
          event_type: 'request_approved',
          ...emailParams,
        });
      } else if ((reviewAction === 'reject' || reviewAction === 'senior_reject') && request.requested_by) {
        notifyRequestor(request.requested_by, currentOrganization.id, {
          event_type: 'request_rejected',
          ...emailParams,
        });
      } else if ((reviewAction === 'accept_with_conditions' || reviewAction === 'senior_approve_with_conditions') && request.requested_by) {
        notifyRequestor(request.requested_by, currentOrganization.id, {
          event_type: 'request_conditionally_approved',
          ...emailParams,
        });
      } else if (reviewAction === 'senior_request_info') {
        notifyReviewers(currentOrganization.id, '2nd', {
          event_type: 'senior_info_requested',
          ...emailParams,
        });
      }

      setShowReviewModal(false);
      setReviewAction(null);
      setReviewNotes('');
      setReviewConditions('');

      if (['approved', 'conditionally_approved'].includes(newStatus) && profile) {
        try {
          const result = await createVendorFromApprovedRequest(
            supabase,
            { ...request, status: newStatus as OnboardingRequest['status'] },
            {
              organizationId: currentOrganization.id,
              organizationName: currentOrganization.name,
              profileId: profile.id,
              profileName: profile.full_name || '',
              profileEmail: profile.email,
              defenseLine: currentMembership?.defense_line,
            }
          );
          setCreatedVendorId(result.vendorId);
          setGlobalLinkInfo(result.globalLinkInfo);
          setAssessmentTaskInfo(result.assessmentTaskInfo);
          setShowVendorCreatedModal(true);
          toast.success(`Vendor record created for ${request.vendor_legal_name}`);
          await fetchRequest();
          return;
        } catch (vendorErr) {
          logger.error('Auto vendor creation failed after approval:', vendorErr);
          toast.warning('Request approved, but automatic vendor creation failed. Use the Create Vendor button to retry.');
        }
      }

      navigate('/onboarding');
    } catch (err) {
      logger.error('Error processing review:', err);
      toast.error('Error processing review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !request || !currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('onboarding_comments')
        .insert({
          organization_id: currentOrganization.id,
          request_id: request.id,
          comment_type: 'general',
          defense_line: currentMembership?.defense_line || '1a',
          content: newComment.trim(),
          is_internal: isInternalComment,
          visible_to_lines: isInternalComment
            ? [currentMembership?.defense_line || '1a']
            : ['1a', '1b', '2nd', '3rd', 'admin'],
          author_id: profile?.id,
          author_name: profile?.full_name || profile?.email || 'Unknown',
          author_role: currentMembership?.defense_line
            ? DEFENSE_LINE_LABELS[currentMembership.defense_line]
            : 'User',
        })
        .select()
        .single();

      if (error) throw error;

      const newCommentData: OnboardingComment = {
        id: data.id,
        organization_id: data.organization_id,
        request_id: data.request_id,
        comment_type: data.comment_type || 'general',
        defense_line: data.defense_line,
        content: data.content,
        is_internal: data.is_internal || false,
        visible_to_lines: data.visible_to_lines || [],
        author_id: data.author_id,
        author_name: data.author_name,
        author_role: data.author_role,
        is_edited: false,
        created_at: data.created_at,
      };

      setComments([...comments, newCommentData]);
      setNewComment('');
      setIsInternalComment(false);
    } catch (err) {
      logger.error('Error adding comment:', err);
      toast.error('Failed to add comment. Please try again.');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawReason.trim() || !request || !currentOrganization || !profile) return;

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('onboarding_requests')
        .update({
          status: 'withdrawn',
          final_status: 'withdrawn',
          final_decision_by: profile.id,
          final_decision_at: new Date().toISOString(),
          final_decision_notes: withdrawReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      await supabase.from('onboarding_audit_log').insert({
        organization_id: currentOrganization.id,
        request_id: request.id,
        action_type: 'request_withdrawn',
        action_description: `Request withdrawn by ${profile.full_name || profile.email}`,
        previous_status: request.status,
        new_status: 'withdrawn',
        performed_by: profile.id,
        performed_by_name: profile.full_name || profile.email,
        performed_by_defense_line: currentMembership?.defense_line,
        new_values: { reason: withdrawReason },
      });

      if (request.assigned_1b_reviewer) {
        notifyRequestor(request.assigned_1b_reviewer, currentOrganization.id, {
          event_type: 'request_returned',
          request_id: request.id,
          request_number: request.request_number || '',
          vendor_name: request.vendor_legal_name,
          actor_name: profile.full_name || profile.email || '',
          organization_name: currentOrganization.name,
          notes: `Request withdrawn: ${withdrawReason}`,
        });
      }

      setShowWithdrawModal(false);
      setWithdrawReason('');
      toast.success('Request withdrawn');
      navigate('/onboarding');
    } catch (err) {
      logger.error('Error withdrawing request:', err);
      toast.error('Failed to withdraw request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVendor = async () => {
    if (!request || !currentOrganization || !profile) return;

    setCreatingVendor(true);
    setGlobalLinkInfo(null);
    setAssessmentTaskInfo(null);
    try {
      const result = await createVendorFromApprovedRequest(
        supabase,
        request,
        {
          organizationId: currentOrganization.id,
          organizationName: currentOrganization.name,
          profileId: profile.id,
          profileName: profile.full_name || '',
          profileEmail: profile.email,
          defenseLine: currentMembership?.defense_line,
        }
      );
      setCreatedVendorId(result.vendorId);
      setGlobalLinkInfo(result.globalLinkInfo);
      setAssessmentTaskInfo(result.assessmentTaskInfo);
      setShowVendorCreatedModal(true);
      toast.success(`Vendor record created for ${request.vendor_legal_name}`);
      await fetchRequest();
    } catch (err) {
      logger.error('Error creating vendor:', err);
      toast.error('Failed to create vendor. Please try again.');
    } finally {
      setCreatingVendor(false);
    }
  };

  const canCreateVendor = () => {
    if (!request) return false;
    return (
      ['approved', 'conditionally_approved'].includes(request.status) &&
      !request.created_vendor_id
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Request not found</h3>
        <p className="mt-1 text-sm text-gray-500">The onboarding request you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/onboarding" className="text-blue-600 hover:text-blue-500">
            ← Back to Onboarding Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const statusClasses = ONBOARDING_STATUS_COLORS[request.status];
  const riskClasses = request.preliminary_risk_tier
    ? RISK_TIER_COLORS[request.preliminary_risk_tier as RiskTier]
    : 'bg-gray-100 text-gray-800';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/onboarding" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Onboarding Dashboard
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{request.vendor_legal_name}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses}`}
              >
                {ONBOARDING_STATUS_LABELS[request.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {request.request_number} • Created {formatDate(request.created_at)}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
          {/* Withdraw Button */}
          {canWithdraw() && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              <X className="w-4 h-4 mr-2" />
              Withdraw
            </button>
          )}

          {/* Review Actions */}
          {canReview() && (
            <>
              {getAvailableActions().includes('reforward_2nd') && (
                <button
                  onClick={() => {
                    setReviewAction('reforward_2nd');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Re-forward to 2nd Line
                </button>
              )}

              {getAvailableActions().includes('return') && (
                <button
                  onClick={() => {
                    setReviewAction('return');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-white hover:bg-orange-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Return
                </button>
              )}

              {getAvailableActions().includes('reject') && (
                <button
                  onClick={() => {
                    setReviewAction('reject');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Reject
                </button>
              )}

              {getAvailableActions().includes('accept_with_conditions') && (
                <button
                  onClick={() => {
                    setReviewAction('accept_with_conditions');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-yellow-300 rounded-md shadow-sm text-sm font-medium text-yellow-700 bg-white hover:bg-yellow-50"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Accept with Conditions
                </button>
              )}

              {getAvailableActions().includes('fast_track_approve') && (
                <button
                  onClick={() => {
                    setReviewAction('fast_track_approve');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-emerald-300 rounded-md shadow-sm text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                >
                  <BadgeCheck className="w-4 h-4 mr-2" />
                  Fast-Track Approve
                </button>
              )}

              {(getAvailableActions().includes('confirm') ||
                getAvailableActions().includes('accept')) && (
                <button
                  onClick={() => {
                    setReviewAction(
                      getAvailableActions().includes('confirm')
                        ? 'confirm'
                        : 'accept'
                    );
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  {getAvailableActions().includes('confirm')
                    ? 'Confirm & Forward'
                    : 'Accept'}
                </button>
              )}

              {getAvailableActions().includes('senior_request_info') && (
                <button
                  onClick={() => {
                    setReviewAction('senior_request_info');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Request Info
                </button>
              )}

              {getAvailableActions().includes('senior_reject') && (
                <button
                  onClick={() => {
                    setReviewAction('senior_reject');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Reject
                </button>
              )}

              {getAvailableActions().includes('senior_approve_with_conditions') && (
                <button
                  onClick={() => {
                    setReviewAction('senior_approve_with_conditions');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-yellow-300 rounded-md shadow-sm text-sm font-medium text-yellow-700 bg-white hover:bg-yellow-50"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Approve with Conditions
                </button>
              )}

              {getAvailableActions().includes('senior_approve') && (
                <button
                  onClick={() => {
                    setReviewAction('senior_approve');
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-700"
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  Senior Approve
                </button>
              )}
            </>
          )}

          {/* Create Vendor Action */}
          {canCreateVendor() && (
            <button
              onClick={handleCreateVendor}
              disabled={creatingVendor}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {creatingVendor ? 'Creating...' : 'Create Vendor'}
            </button>
          )}

          {/* Vendor Already Created */}
          {request.created_vendor_id && (
            <Link
              to={`/vendors/${request.created_vendor_id}`}
              className="inline-flex items-center px-4 py-2 border border-emerald-300 rounded-md shadow-sm text-sm font-medium text-emerald-700 bg-white hover:bg-emerald-50"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Vendor
            </Link>
          )}
          </div>
        </div>
      </div>

      {/* Workflow Progress */}
      <OnboardingProgressTracker currentStatus={request.status} className="mb-6" />

      {/* Returned Banner */}
      {(request.status === '1b_returned' || request.status === '2nd_returned') && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <RotateCcw className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                {request.status === '1b_returned' ? 'Returned by 1B Coordinator' : 'Returned by 2nd Line Risk'}
              </h3>
              {(request.status === '1b_returned' && request.review_notes_1b) && (
                <div className="mt-2 p-3 bg-white rounded border border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-1">Return Reason</p>
                  <p className="text-sm text-amber-900">{request.review_notes_1b}</p>
                  {request.reviewed_at_1b && (
                    <p className="text-xs text-amber-600 mt-2">{formatDate(request.reviewed_at_1b)}</p>
                  )}
                </div>
              )}
              {(request.status === '2nd_returned' && request.review_notes_2nd) && (
                <div className="mt-2 p-3 bg-white rounded border border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-1">Return Reason</p>
                  <p className="text-sm text-amber-900">{request.review_notes_2nd}</p>
                  {request.reviewed_at_2nd && (
                    <p className="text-xs text-amber-600 mt-2">{formatDate(request.reviewed_at_2nd)}</p>
                  )}
                </div>
              )}
              {!access.isReadOnly && request.requested_by === profile?.id && (
                <Link
                  to={`/onboarding/${request.id}/edit`}
                  className="mt-3 inline-flex items-center px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700"
                >
                  <ArrowUpRight className="w-4 h-4 mr-1.5" />
                  Edit & Resubmit
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Risk Alert Banner */}
      {request.preliminary_risk_tier &&
        ['critical', 'high'].includes(request.preliminary_risk_tier) && (
          <div
            className={`mb-6 rounded-md p-4 ${
              request.preliminary_risk_tier === 'critical'
                ? 'bg-red-50'
                : 'bg-orange-50'
            }`}
          >
            <div className="flex">
              <AlertTriangle
                className={`h-5 w-5 ${
                  request.preliminary_risk_tier === 'critical'
                    ? 'text-red-400'
                    : 'text-orange-400'
                }`}
              />
              <div className="ml-3">
                <h3
                  className={`text-sm font-medium ${
                    request.preliminary_risk_tier === 'critical'
                      ? 'text-red-800'
                      : 'text-orange-800'
                  }`}
                >
                  {request.preliminary_risk_tier === 'critical'
                    ? 'Critical'
                    : 'High'}{' '}
                  Risk Vendor
                </h3>
                <p
                  className={`mt-1 text-sm ${
                    request.preliminary_risk_tier === 'critical'
                      ? 'text-red-700'
                      : 'text-orange-700'
                  }`}
                >
                  This vendor has a preliminary risk score of{' '}
                  {request.preliminary_risk_score}. Enhanced due diligence and
                  senior management approval may be required.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${riskClasses.split(' ')[0]}`}>
              <Shield
                className={`w-5 h-5 ${riskClasses.split(' ')[1]?.replace('text-', 'text-') || 'text-gray-600'}`}
              />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Risk Tier</p>
              <p className={`text-lg font-semibold ${riskClasses.split(' ')[1] || 'text-gray-600'}`}>
                {request.preliminary_risk_tier
                  ? RISK_TIER_LABELS[request.preliminary_risk_tier as RiskTier]
                  : 'Not Assessed'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Contract Value</p>
              <p className="text-lg font-semibold text-gray-900">
                {request.estimated_contract_value_cad != null && !isNaN(request.estimated_contract_value_cad)
                  ? formatCurrency(request.estimated_contract_value_cad)
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-purple-100">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Duration</p>
              <p className="text-lg font-semibold text-gray-900">
                {request.contract_duration?.replace('_', ' ') || 'Not specified'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg bg-${PRIORITY_COLORS[request.priority]}-100`}>
              <Clock className={`w-5 h-5 text-${PRIORITY_COLORS[request.priority]}-600`} />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Priority</p>
              <p className={`text-lg font-semibold text-${PRIORITY_COLORS[request.priority]}-600`}>
                {PRIORITY_LABELS[request.priority]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Progress */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Workflow Progress</h3>
        {(() => {
          const requiresSenior = request.requires_senior_approval ||
            request.preliminary_risk_tier === 'critical' ||
            (request as unknown as OnboardingAssessmentData).calculated_tier === 'tier_5_critical';
          const workflowSteps = requiresSenior
            ? ['draft', 'submitted', '1b_review', '2nd_review', 'pending_senior_approval', 'approved']
            : ['draft', 'submitted', '1b_review', '2nd_review', 'approved'];

          const isReturned = request.status === '1b_returned' || request.status === '2nd_returned';
          const returnedStep = request.status === '1b_returned' ? '1b_review' : request.status === '2nd_returned' ? '2nd_review' : null;

          return (
            <div className="flex items-center justify-between">
              {workflowSteps.map((step, index) => {
                const completedSteps = ['draft', 'submitted'];
                if (
                  ['2nd_review', '2nd_returned', 'pending_senior_approval', 'approved', 'conditionally_approved'].includes(request.status)
                ) {
                  completedSteps.push('1b_review');
                }
                if (['pending_senior_approval', 'approved', 'conditionally_approved'].includes(request.status)) {
                  completedSteps.push('2nd_review');
                }
                if (['approved', 'conditionally_approved'].includes(request.status) && requiresSenior) {
                  completedSteps.push('pending_senior_approval');
                }
                if (['approved', 'conditionally_approved', 'vendor_created'].includes(request.status)) {
                  completedSteps.push('approved');
                }
                if (request.status === '1b_returned') {
                  completedSteps.length = 0;
                  completedSteps.push('draft', 'submitted');
                }

                const isCompleted = completedSteps.includes(step);
                const isCurrent = step === request.status;
                const isReturnedStep = isReturned && step === returnedStep;

                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${
                          isReturnedStep
                            ? 'bg-amber-500 text-white'
                            : isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                                ? step === 'pending_senior_approval'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-500'
                        }
                      `}
                      >
                        {isReturnedStep ? (
                          <RotateCcw className="w-5 h-5" />
                        ) : isCompleted ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : step === 'pending_senior_approval' ? (
                          <Briefcase className="w-5 h-5" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium text-center max-w-[80px] ${
                          isReturnedStep
                            ? 'text-amber-600'
                            : isCurrent
                              ? step === 'pending_senior_approval'
                                ? 'text-rose-600'
                                : 'text-blue-600'
                              : 'text-gray-500'
                        }`}
                      >
                        {isReturnedStep
                          ? 'Returned'
                          : step === 'pending_senior_approval'
                            ? 'Senior Approval'
                            : ONBOARDING_STATUS_LABELS[step as keyof typeof ONBOARDING_STATUS_LABELS]}
                      </span>
                    </div>
                    {index < workflowSteps.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 ${
                        isReturnedStep ? 'bg-amber-400' : isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            {[
              { id: 'details', label: 'Details', icon: FileText },
              { id: 'assessment', label: 'Risk Assessment', icon: BarChart3 },
              { id: 'comments', label: 'Comments', icon: MessageSquare, count: comments.length },
              { id: 'documents', label: 'Documents', icon: Paperclip, count: documentCount },
              { id: 'timeline', label: 'Timeline', icon: Clock, count: auditLog.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center px-6 py-4 text-sm font-medium border-b-2 
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Assessment Tab */}
          {activeTab === 'assessment' && (
            <div className="space-y-6">
              {(() => {
                const requestData = request as unknown as OnboardingAssessmentData;
                const hasAssessmentData = requestData.calculated_tier || requestData.q15_supports_essential_operations;
                const is2ndLineReviewer = currentMembership?.defense_line === '2nd' && request.status === '2nd_review';
                const is1bReviewer = currentMembership?.defense_line === '1b' && request.status === '1b_review';
                const adminAs1b = isAdmin && request.status === '1b_review';
                const adminAs2nd = isAdmin && request.status === '2nd_review';

                if (!hasAssessmentData) {
                  return (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                      <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-700 mb-2">No Assessment Data</h3>
                      <p className="text-slate-500 max-w-md mx-auto">
                        Risk assessment has not been completed for this onboarding request.
                        The requestor needs to complete the assessment during the onboarding process.
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    {(is1bReviewer || adminAs1b) ? (
                      <FirstLineReviewPanel
                        requestId={request.id}
                        assessmentData={requestData}
                        organizationId={currentOrganization!.id}
                        reviewerUserId={profile?.id || ''}
                        onAssessmentSaved={fetchRequest}
                      />
                    ) : (
                      <AssessmentDisplayPanel
                        assessmentData={requestData}
                        completedBy={requestData.assessment_completed_by}
                        completedAt={requestData.assessment_completed_at}
                        original1aAnswers={
                          requestData.assessment_modified_by_1b
                            ? (requestData.original_1a_assessment_answers as Record<string, unknown> | undefined)
                            : undefined
                        }
                        modifiedBy1b={requestData.assessment_modified_by_1b || false}
                        modifiedAt1b={requestData.assessment_modified_at_1b as string | undefined}
                        changeSummary={
                          requestData.assessment_1b_change_summary as Record<string, { old: unknown; new: unknown }> | undefined
                        }
                      />
                    )}

                    {(is2ndLineReviewer || adminAs2nd) && (
                      <SecondLineValidationPanel
                        assessmentData={requestData}
                        onValidationChange={setValidationData}
                        disabled={false}
                      />
                    )}

                    {requestData.assessment_validated && !is2ndLineReviewer && !adminAs2nd && (
                      <div className="mt-6 p-5 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3 mb-4">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <h3 className="text-lg font-semibold text-green-900">Assessment Validated by 2nd Line</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-green-700 uppercase tracking-wide">Validated Tier</p>
                            {requestData.validated_tier && TIER_DISPLAY_CONFIG[requestData.validated_tier] && (
                              <span className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-sm font-medium ${
                                TIER_DISPLAY_CONFIG[requestData.validated_tier].bgClass
                              }`}>
                                {TIER_DISPLAY_CONFIG[requestData.validated_tier].label}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-green-700 uppercase tracking-wide">Validated At</p>
                            <p className="mt-1 text-sm text-green-900">
                              {requestData.assessment_validated_at
                                ? new Date(requestData.assessment_validated_at).toLocaleString()
                                : '-'}
                            </p>
                          </div>
                          {requestData.tier_adjustment_reason && (
                            <div className="col-span-2">
                              <p className="text-xs text-green-700 uppercase tracking-wide">Adjustment Reason</p>
                              <p className="mt-1 text-sm text-green-900">{requestData.tier_adjustment_reason}</p>
                            </div>
                          )}
                          {requestData.due_diligence_requirements && requestData.due_diligence_requirements.length > 0 && (
                            <div className="col-span-2">
                              <p className="text-xs text-green-700 uppercase tracking-wide mb-2">Due Diligence Requirements</p>
                              <div className="flex flex-wrap gap-2">
                                {requestData.due_diligence_requirements.map((req: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                    {req.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Vendor Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                  <Building2 className="w-4 h-4 mr-2" />
                  Vendor Information
                </h4>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Legal Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{request.vendor_legal_name}</dd>
                  </div>
                  {request.vendor_trading_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Trading Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{request.vendor_trading_name}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Country</dt>
                    <dd className="mt-1 text-sm text-gray-900">{request.vendor_country}</dd>
                  </div>
                  {request.vendor_website && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Website</dt>
                      <dd className="mt-1 text-sm text-blue-600">
                        <a href={request.vendor_website} target="_blank" rel="noopener noreferrer">
                          {request.vendor_website}
                        </a>
                      </dd>
                    </div>
                  )}
                  {request.vendor_description && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Description</dt>
                      <dd className="mt-1 text-sm text-gray-900">{request.vendor_description}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Service Details */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                  <Globe className="w-4 h-4 mr-2" />
                  Service Details
                </h4>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Service Category</dt>
                    <dd className="mt-1 text-sm text-gray-900">{request.service_category?.replace(/_/g, ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Service Description</dt>
                    <dd className="mt-1 text-sm text-gray-900">{request.service_description}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Business Unit</dt>
                    <dd className="mt-1 text-sm text-gray-900">{request.business_unit?.replace(/_/g, ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Business Justification</dt>
                    <dd className="mt-1 text-sm text-gray-900">{request.business_justification}</dd>
                  </div>
                </dl>
              </div>

              {/* Risk Indicators */}
              <div className="lg:col-span-2">
                <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Risk Indicators
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Handles Sensitive Data', value: request.handles_sensitive_data },
                    { label: 'System Access', value: request.has_system_access },
                    { label: 'Critical Service', value: request.is_critical_service },
                    { label: 'Outsourcing Arrangement', value: request.is_outsourcing },
                    { label: 'Uses Subcontractors', value: request.uses_subcontractors },
                    { label: 'Offshore Component', value: request.offshore_components },
                  ].map((indicator) => (
                    <div key={indicator.label} className="flex items-center space-x-2">
                      {indicator.value ? (
                        <CheckCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300" />
                      )}
                      <span className="text-sm text-gray-700">{indicator.label}</span>
                    </div>
                  ))}
                </div>
                {request.known_subcontractors && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium text-gray-700">Subcontractor Details:</p>
                    <p className="text-sm text-gray-600">{request.known_subcontractors}</p>
                  </div>
                )}
              </div>

              {/* Review History */}
              {(request.reviewed_by_1b || request.reviewed_by_2nd) && (
                <div className="lg:col-span-2">
                  <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                    <BadgeCheck className="w-4 h-4 mr-2" />
                    Review History
                  </h4>
                  <div className="space-y-4">
                    {request.reviewed_by_1b && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-900">1B Review</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            request.review_status_1b === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {request.review_status_1b}
                          </span>
                        </div>
                        {request.review_notes_1b && (
                          <p className="text-sm text-blue-800">{request.review_notes_1b}</p>
                        )}
                        <p className="text-xs text-blue-600 mt-2">
                          {formatDate(request.reviewed_at_1b!)}
                        </p>
                      </div>
                    )}
                    
                    {request.reviewed_by_2nd && (
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-purple-900">2nd Line Review</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            request.review_decision_2nd === 'accepted' ? 'bg-green-100 text-green-800' : 
                            request.review_decision_2nd === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {request.review_decision_2nd}
                          </span>
                        </div>
                        {request.review_notes_2nd && (
                          <p className="text-sm text-purple-800">{request.review_notes_2nd}</p>
                        )}
                        {request.approval_conditions && (
                          <div className="mt-2 p-2 bg-yellow-50 rounded">
                            <p className="text-xs font-medium text-yellow-800">Conditions:</p>
                            <p className="text-sm text-yellow-900">{request.approval_conditions}</p>
                          </div>
                        )}
                        <p className="text-xs text-purple-600 mt-2">
                          {formatDate(request.reviewed_at_2nd!)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div>
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No comments yet</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={`p-4 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {comment.author_name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {comment.defense_line
                                ? DEFENSE_LINE_LABELS[comment.defense_line]
                                : comment.author_role || 'User'}{' '}
                              • {formatDate(comment.created_at)}
                            </p>
                          </div>
                        </div>
                        {comment.is_internal && (
                          <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded">Internal</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 ml-10">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
              
              {!access.isReadOnly && (
                <div className="border-t pt-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-600">Internal comment (not visible to requestor)</span>
                    </label>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Add Comment
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <OnboardingDocuments
              requestId={request.id}
              organizationId={currentOrganization?.id}
              readOnly={request.status === 'vendor_created' || request.status === 'rejected'}
            />
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="flow-root">
              <ul className="-mb-8">
                {auditLog.map((entry, index) => (
                  <li key={entry.id}>
                    <div className="relative pb-8">
                      {index !== auditLog.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`
                            h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white
                            ${entry.action_type.includes('created') ? 'bg-gray-400' :
                              entry.action_type.includes('submitted') ? 'bg-blue-500' :
                              entry.action_type.includes('status_changed') ? 'bg-yellow-500' :
                              'bg-green-500'}
                          `}>
                            {entry.action_type.includes('created') ? <FileText className="w-4 h-4 text-white" /> :
                             entry.action_type.includes('submitted') ? <Send className="w-4 h-4 text-white" /> :
                             <ChevronRight className="w-4 h-4 text-white" />}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium text-gray-900 capitalize">{entry.action_type.replace(/_/g, ' ')}</span>
                              {entry.previous_status && (
                                <span> from {entry.previous_status} to {entry.new_status}</span>
                              )}
                            </p>
                            {entry.action_description && (
                              <p className="text-xs text-gray-500 mt-1">
                                {entry.action_description}
                              </p>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-gray-500">
                            {formatDate(entry.performed_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {reviewAction === 'confirm' && 'Confirm & Forward to 2nd Line'}
              {reviewAction === 'accept' && 'Accept Request'}
              {reviewAction === 'accept_with_conditions' && 'Accept with Conditions'}
              {reviewAction === 'reject' && 'Reject Request'}
              {reviewAction === 'return' && 'Return Request'}
              {reviewAction === 'fast_track_approve' && 'Fast-Track Approval'}
              {reviewAction === 'reforward_2nd' && 'Re-forward to 2nd Line Review'}
              {reviewAction === 'senior_approve' && 'Senior Management - Approve'}
              {reviewAction === 'senior_approve_with_conditions' && 'Senior Management - Approve with Conditions'}
              {reviewAction === 'senior_request_info' && 'Senior Management - Request Additional Information'}
              {reviewAction === 'senior_reject' && 'Senior Management - Reject'}
            </h3>

            {reviewAction === 'fast_track_approve' && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <BadgeCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Low-Risk Vendor - Fast Track Eligible</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      This vendor qualifies for fast-track approval based on the low risk tier assessment.
                      Approval will bypass 2nd Line review.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Review Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  placeholder={
                    reviewAction === 'return'
                      ? 'Please explain what information is missing or needs to be corrected...'
                      : reviewAction === 'reject'
                        ? 'Please provide the reason for rejection...'
                        : 'Add your review notes...'
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {(reviewAction === 'accept_with_conditions' || reviewAction === 'senior_approve_with_conditions') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Conditions <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reviewConditions}
                    onChange={(e) => setReviewConditions(e.target.value)}
                    rows={3}
                    placeholder="Specify the conditions that must be met..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              )}

              {reviewAction === 'reforward_2nd' && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-sm text-teal-800">
                    This request was returned by 2nd Line Risk. Explain how the feedback has been addressed before re-forwarding.
                  </p>
                </div>
              )}

              {reviewAction === 'senior_request_info' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    The request will be returned to 2nd Line Risk for additional information gathering based on your notes.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewAction(null);
                  setReviewNotes('');
                  setReviewConditions('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAction}
                disabled={
                  !reviewNotes.trim() ||
                  ((reviewAction === 'accept_with_conditions' || reviewAction === 'senior_approve_with_conditions') &&
                    !reviewConditions.trim()) ||
                  submitting
                }
                className={`
                  px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50
                  ${
                    reviewAction === 'reject' || reviewAction === 'senior_reject'
                      ? 'bg-red-600 hover:bg-red-700'
                      : reviewAction === 'return'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : reviewAction === 'reforward_2nd'
                          ? 'bg-teal-600 hover:bg-teal-700'
                          : reviewAction === 'senior_approve' || reviewAction === 'senior_approve_with_conditions'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-green-600 hover:bg-green-700'
                  }
                `}
              >
                {submitting ? 'Processing...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Withdraw Request</h3>
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-sm text-slate-700">
                This will permanently withdraw the onboarding request for <span className="font-semibold">{request.vendor_legal_name}</span>. This action cannot be undone.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Reason for withdrawal <span className="text-red-500">*</span>
              </label>
              <textarea
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                rows={3}
                placeholder="Explain why this request is being withdrawn..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={!withdrawReason.trim() || submitting}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Withdrawing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Created Success Modal */}
      {showVendorCreatedModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Vendor Created Successfully
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                The vendor record for{' '}
                <span className="font-medium">{request.vendor_legal_name}</span>{' '}
                has been created and requires a risk assessment.
              </p>
            </div>

            {assessmentTaskInfo && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 mt-0.5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Assessment Task Created
                    </p>
                    <p className="text-xs mt-0.5 text-blue-700">
                      Due: {new Date(assessmentTaskInfo.dueDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Priority:{' '}
                      <span className={`font-medium ${
                        assessmentTaskInfo.priority === 'urgent' ? 'text-red-600' :
                        assessmentTaskInfo.priority === 'high' ? 'text-orange-600' :
                        'text-blue-600'
                      }`}>
                        {assessmentTaskInfo.priority.charAt(0).toUpperCase() + assessmentTaskInfo.priority.slice(1)}
                      </span>
                      {' '} - Assigned to 2nd Line Risk
                    </p>
                  </div>
                </div>
              </div>
            )}

            {globalLinkInfo && (
              <div
                className={`mt-4 p-3 rounded-lg flex items-start gap-3 ${
                  globalLinkInfo.matched
                    ? 'bg-emerald-50 border border-emerald-200'
                    : globalLinkInfo.created
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <Link2
                  className={`w-5 h-5 mt-0.5 ${
                    globalLinkInfo.matched
                      ? 'text-emerald-600'
                      : globalLinkInfo.created
                        ? 'text-amber-600'
                        : 'text-gray-500'
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      globalLinkInfo.matched
                        ? 'text-emerald-900'
                        : globalLinkInfo.created
                          ? 'text-amber-900'
                          : 'text-gray-700'
                    }`}
                  >
                    {globalLinkInfo.matched
                      ? 'Linked to Global Registry'
                      : globalLinkInfo.created
                        ? 'New Global Registry Entry'
                        : 'Global Registry Pending'}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      globalLinkInfo.matched
                        ? 'text-emerald-700'
                        : globalLinkInfo.created
                          ? 'text-amber-700'
                          : 'text-gray-500'
                    }`}
                  >
                    {globalLinkInfo.matched
                      ? `Matched with existing entry: ${globalLinkInfo.globalPartyName}`
                      : globalLinkInfo.created
                        ? 'A new entry was created and is pending platform admin review'
                        : 'Could not link to global registry. Manual review may be required.'}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col space-y-3">
              <Link
                to={`/assessments/new?vendorId=${createdVendorId}`}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Shield className="w-4 h-4 mr-2" />
                Start Assessment Now
              </Link>
              <Link
                to={`/vendors/${createdVendorId}`}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-emerald-300 rounded-md shadow-sm text-sm font-medium text-emerald-700 bg-white hover:bg-emerald-50"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Vendor Details
              </Link>
              <button
                onClick={() => {
                  setShowVendorCreatedModal(false);
                  setGlobalLinkInfo(null);
                  setAssessmentTaskInfo(null);
                  fetchRequest();
                }}
                className="w-full inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Stay on This Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

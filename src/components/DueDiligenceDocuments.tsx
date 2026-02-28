import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  DueDiligenceDocumentRequest,
  DueDiligenceDocumentType,
  DDRequestStatus,
  DD_REQUEST_STATUS_LABELS,
  DD_REQUEST_STATUS_COLORS,
  DD_CATEGORY_LABELS,
} from '../types';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { toast } from 'sonner';
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  FileCheck,
  Eye,
  Send,
  Ban,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Loader2,
  X,
  Bell,
  Lock,
  Unlock,
} from 'lucide-react';

interface DueDiligenceDocumentsProps {
  vendorId?: string;
  onboardingRequestId?: string;
  vendorTier?: string;
  readOnly?: boolean;
  compact?: boolean;
  onStatusChange?: () => void;
}

interface GroupedRequests {
  [category: string]: DueDiligenceDocumentRequest[];
}

const STATUS_ORDER: DDRequestStatus[] = ['requested', 'received', 'under_review', 'approved', 'rejected', 'waived', 'expired'];

export default function DueDiligenceDocuments({
  vendorId,
  onboardingRequestId,
  vendorTier,
  readOnly = false,
  compact = false,
  onStatusChange,
}: DueDiligenceDocumentsProps) {
  const { profile } = useAuth();
  const { currentOrganization, currentMembership } = useOrganization();

  const [requests, setRequests] = useState<DueDiligenceDocumentRequest[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DueDiligenceDocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['security', 'financial', 'legal', 'operational']));

  const [selectedRequest, setSelectedRequest] = useState<DueDiligenceDocumentRequest | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const canReview = currentMembership?.defense_line === '2nd' ||
    currentMembership?.defense_line === 'admin' ||
    currentMembership?.defense_line === '1b';

  const canWaive = currentMembership?.defense_line === '2nd' ||
    currentMembership?.defense_line === 'admin';

  const fetchRequests = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      let query = supabase
        .from('due_diligence_document_requests')
        .select(`
          *,
          document_type:due_diligence_document_types(*)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }
      if (onboardingRequestId) {
        query = query.eq('onboarding_request_id', onboardingRequestId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: DueDiligenceDocumentRequest[] = (data || []).map((r) => ({
        ...r,
        document_type: r.document_type as DueDiligenceDocumentType | undefined,
      }));

      setRequests(mapped);
    } catch (error) {
      logger.error('Error fetching DD requests:', error);
      toast.error('Failed to load document requests');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, vendorId, onboardingRequestId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    async function fetchTypes() {
      const { data } = await supabase
        .from('due_diligence_document_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (data) setDocumentTypes(data);
    }
    fetchTypes();
  }, []);

  const getUrgencyStatus = (request: DueDiligenceDocumentRequest) => {
    if (request.status !== 'requested') return null;
    const dueDate = new Date(request.due_date);
    const daysUntilDue = differenceInDays(dueDate, new Date());

    if (daysUntilDue < 0) return { level: 'overdue', label: `${Math.abs(daysUntilDue)} days overdue`, color: 'text-red-600' };
    if (daysUntilDue <= 3) return { level: 'critical', label: `Due in ${daysUntilDue} days`, color: 'text-red-500' };
    if (daysUntilDue <= 7) return { level: 'soon', label: `Due in ${daysUntilDue} days`, color: 'text-amber-500' };
    return { level: 'ok', label: `Due in ${daysUntilDue} days`, color: 'text-slate-500' };
  };

  const groupedRequests = requests.reduce<GroupedRequests>((acc, req) => {
    const category = req.document_type?.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(req);
    return acc;
  }, {});

  const filteredRequests = requests.filter((req) => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const typeName = req.document_type?.name?.toLowerCase() || '';
      const typeCode = req.document_type_code.toLowerCase();
      if (!typeName.includes(searchLower) && !typeCode.includes(searchLower)) return false;
    }
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'requested').length,
    received: requests.filter((r) => r.status === 'received').length,
    underReview: requests.filter((r) => r.status === 'under_review').length,
    approved: requests.filter((r) => r.status === 'approved' || r.status === 'waived').length,
    blocking: requests.filter((r) => r.blocks_activation && !['approved', 'waived'].includes(r.status)).length,
    overdue: requests.filter((r) => r.status === 'requested' && isPast(new Date(r.due_date))).length,
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUploadDocument = async () => {
    if (!selectedRequest || !selectedFile || !currentOrganization) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${currentOrganization.id}/${vendorId || 'onboarding'}/${selectedRequest.document_type_code}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: docResult, error: docError } = await supabase
        .from('vendor_documents')
        .insert({
          vendor_id: vendorId,
          organization_id: currentOrganization.id,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          storage_path: fileName,
          version: 1,
          is_current: true,
          uploaded_by: profile?.id,
          uploaded_by_name: profile?.full_name || profile?.email,
        })
        .select('id')
        .single();

      if (docError) throw docError;

      const { error: updateError } = await supabase.rpc('update_document_request_status', {
        p_request_id: selectedRequest.id,
        p_new_status: 'received',
        p_user_id: profile?.id,
        p_user_name: profile?.full_name || profile?.email,
        p_notes: uploadNotes || null,
        p_document_id: docResult.id,
      });

      if (updateError) throw updateError;

      toast.success('Document uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadNotes('');
      setSelectedRequest(null);
      fetchRequests();
      onStatusChange?.();
    } catch (error) {
      logger.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleReviewDocument = async (approved: boolean) => {
    if (!selectedRequest) return;

    try {
      const { error } = await supabase.rpc('update_document_request_status', {
        p_request_id: selectedRequest.id,
        p_new_status: approved ? 'approved' : 'rejected',
        p_user_id: profile?.id,
        p_user_name: profile?.full_name || profile?.email,
        p_notes: reviewNotes || null,
      });

      if (error) throw error;

      toast.success(approved ? 'Document approved' : 'Document rejected');
      setShowReviewModal(false);
      setReviewNotes('');
      setSelectedRequest(null);
      fetchRequests();
      onStatusChange?.();
    } catch (error) {
      logger.error('Error reviewing document:', error);
      toast.error('Failed to update review status');
    }
  };

  const handleWaiveDocument = async () => {
    if (!selectedRequest || !waiverReason.trim()) return;

    try {
      const { error } = await supabase.rpc('update_document_request_status', {
        p_request_id: selectedRequest.id,
        p_new_status: 'waived',
        p_user_id: profile?.id,
        p_user_name: profile?.full_name || profile?.email,
        p_notes: waiverReason,
      });

      if (error) throw error;

      toast.success('Document requirement waived');
      setShowWaiverModal(false);
      setWaiverReason('');
      setSelectedRequest(null);
      fetchRequests();
      onStatusChange?.();
    } catch (error) {
      logger.error('Error waiving document:', error);
      toast.error('Failed to waive document requirement');
    }
  };

  const handleSendReminder = async () => {
    if (!selectedRequest || !currentOrganization) return;

    try {
      await supabase.from('due_diligence_request_reminders').insert({
        organization_id: currentOrganization.id,
        document_request_id: selectedRequest.id,
        reminder_type: 'manual',
        reminder_number: (selectedRequest.reminder_count || 0) + 1,
        sent_by_system: false,
      });

      await supabase
        .from('due_diligence_document_requests')
        .update({
          reminder_count: (selectedRequest.reminder_count || 0) + 1,
          last_reminder_at: new Date().toISOString(),
          next_reminder_at: addDays(new Date(), 7).toISOString(),
        })
        .eq('id', selectedRequest.id);

      toast.success('Reminder sent');
      setShowReminderModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      logger.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const getStatusIcon = (status: DDRequestStatus) => {
    switch (status) {
      case 'requested': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'received': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'under_review': return <Eye className="w-4 h-4 text-sky-500" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'waived': return <Ban className="w-4 h-4 text-slate-500" />;
      case 'expired': return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
        <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 font-medium">No Document Requests</p>
        <p className="text-sm text-slate-500 mt-1">
          Due diligence document requests will appear here after 2nd line approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
            <p className="text-xs text-amber-600">Pending</p>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.received}</p>
            <p className="text-xs text-blue-600">Received</p>
          </div>
          <div className="bg-sky-50 rounded-lg border border-sky-200 p-3 text-center">
            <p className="text-2xl font-bold text-sky-700">{stats.underReview}</p>
            <p className="text-xs text-sky-600">Under Review</p>
          </div>
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{stats.approved}</p>
            <p className="text-xs text-emerald-600">Completed</p>
          </div>
          {stats.blocking > 0 && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.blocking}</p>
              <p className="text-xs text-red-600">Blocking</p>
            </div>
          )}
          {stats.overdue > 0 && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.overdue}</p>
              <p className="text-xs text-red-600">Overdue</p>
            </div>
          )}
        </div>
      )}

      {stats.blocking > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Vendor Activation Blocked</p>
              <p className="text-sm text-red-700 mt-1">
                {stats.blocking} critical document{stats.blocking > 1 ? 's' : ''} must be received and approved before this vendor can be activated.
              </p>
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>{DD_REQUEST_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(groupedRequests).map(([category, categoryRequests]) => {
          const filteredCategoryRequests = categoryRequests.filter((req) => {
            if (filterStatus !== 'all' && req.status !== filterStatus) return false;
            if (searchTerm) {
              const searchLower = searchTerm.toLowerCase();
              const typeName = req.document_type?.name?.toLowerCase() || '';
              if (!typeName.includes(searchLower)) return false;
            }
            return true;
          });

          if (filteredCategoryRequests.length === 0) return null;

          const isExpanded = expandedCategories.has(category);
          const categoryPending = filteredCategoryRequests.filter((r) => r.status === 'requested').length;
          const categoryBlocking = filteredCategoryRequests.filter((r) => r.blocks_activation && !['approved', 'waived'].includes(r.status)).length;

          return (
            <div key={category} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  <span className="font-medium text-slate-900">{DD_CATEGORY_LABELS[category] || category}</span>
                  <span className="text-sm text-slate-500">({filteredCategoryRequests.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {categoryBlocking > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> {categoryBlocking} blocking
                    </span>
                  )}
                  {categoryPending > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      {categoryPending} pending
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {filteredCategoryRequests.map((request) => {
                    const urgency = getUrgencyStatus(request);

                    return (
                      <div key={request.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusIcon(request.status)}
                              <span className="font-medium text-slate-900 truncate">
                                {request.document_type?.name || request.document_type_code}
                              </span>
                              {request.blocks_activation && !['approved', 'waived'].includes(request.status) && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Blocking
                                </span>
                              )}
                              {request.is_critical && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                                  Critical
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 line-clamp-1">
                              {request.document_type?.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${DD_REQUEST_STATUS_COLORS[request.status]}`}>
                                {DD_REQUEST_STATUS_LABELS[request.status]}
                              </span>
                              {urgency && (
                                <span className={`${urgency.color} font-medium`}>{urgency.label}</span>
                              )}
                              {request.reminder_count > 0 && (
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Bell className="w-3 h-3" /> {request.reminder_count} reminder{request.reminder_count > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {!readOnly && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {request.status === 'requested' && (
                                <>
                                  <button
                                    onClick={() => { setSelectedRequest(request); setShowUploadModal(true); }}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                                  >
                                    <Upload className="w-4 h-4" /> Upload
                                  </button>
                                  <button
                                    onClick={() => { setSelectedRequest(request); setShowReminderModal(true); }}
                                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                                    title="Send Reminder"
                                  >
                                    <Bell className="w-4 h-4" />
                                  </button>
                                  {canWaive && (
                                    <button
                                      onClick={() => { setSelectedRequest(request); setShowWaiverModal(true); }}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                      title="Waive Requirement"
                                    >
                                      <Ban className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                              {request.status === 'received' && canReview && (
                                <button
                                  onClick={() => { setSelectedRequest(request); setShowReviewModal(true); }}
                                  className="px-3 py-1.5 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 flex items-center gap-1.5"
                                >
                                  <Eye className="w-4 h-4" /> Review
                                </button>
                              )}
                              {request.status === 'approved' && request.received_document_id && (
                                <button
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="Download Document"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              {request.status === 'rejected' && (
                                <button
                                  onClick={() => { setSelectedRequest(request); setShowUploadModal(true); }}
                                  className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 flex items-center gap-1.5"
                                >
                                  <RefreshCw className="w-4 h-4" /> Resubmit
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {request.status === 'rejected' && request.rejection_reason && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <p className="text-sm text-red-800">
                              <span className="font-medium">Rejection reason:</span> {request.rejection_reason}
                            </p>
                          </div>
                        )}
                        {request.status === 'waived' && request.waiver_reason && (
                          <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                            <p className="text-sm text-slate-700">
                              <span className="font-medium">Waiver reason:</span> {request.waiver_reason}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Waived by {request.waived_by_name} on {format(new Date(request.waived_at!), 'MMM d, yyyy')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showUploadModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Upload Document</h3>
                <button onClick={() => { setShowUploadModal(false); setSelectedFile(null); setSelectedRequest(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">{selectedRequest.document_type?.name}</p>
                <p className="text-sm text-slate-500 mt-1">{selectedRequest.document_type?.description}</p>
                <p className="text-xs text-slate-400 mt-2">Due: {format(new Date(selectedRequest.due_date), 'MMM d, yyyy')}</p>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-slate-900">{selectedFile.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">Click to select a file</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX, XLS, XLSX up to 25MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="hidden"
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any notes about this document..."
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => { setShowUploadModal(false); setSelectedFile(null); setSelectedRequest(null); }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocument}
                disabled={!selectedFile || uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Review Document</h3>
                <button onClick={() => { setShowReviewModal(false); setSelectedRequest(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">{selectedRequest.document_type?.name}</p>
                <p className="text-sm text-slate-500 mt-1">Received: {format(new Date(selectedRequest.received_at!), 'MMM d, yyyy h:mm a')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add review notes or reason for rejection..."
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => { setShowReviewModal(false); setSelectedRequest(null); setReviewNotes(''); }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewDocument(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => handleReviewDocument(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {showWaiverModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Waive Document Requirement</h3>
                <button onClick={() => { setShowWaiverModal(false); setSelectedRequest(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">Are you sure?</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Waiving this requirement means the vendor will not need to provide: <strong>{selectedRequest.document_type?.name}</strong>
                    </p>
                    {selectedRequest.blocks_activation && (
                      <p className="text-sm text-amber-700 mt-2">
                        This document blocks vendor activation. Waiving it will allow the vendor to be activated without this document.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Waiver Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Provide a detailed justification for waiving this requirement..."
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => { setShowWaiverModal(false); setSelectedRequest(null); setWaiverReason(''); }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleWaiveDocument}
                disabled={!waiverReason.trim()}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
              >
                <Ban className="w-4 h-4" /> Waive Requirement
              </button>
            </div>
          </div>
        </div>
      )}

      {showReminderModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Send Reminder</h3>
                <button onClick={() => { setShowReminderModal(false); setSelectedRequest(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">{selectedRequest.document_type?.name}</p>
                <p className="text-sm text-slate-500 mt-1">Due: {format(new Date(selectedRequest.due_date), 'MMM d, yyyy')}</p>
                {selectedRequest.reminder_count > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    {selectedRequest.reminder_count} reminder{selectedRequest.reminder_count > 1 ? 's' : ''} already sent
                  </p>
                )}
              </div>
              <p className="text-sm text-slate-600">
                Send a reminder notification for this outstanding document request. The vendor contact will be notified.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => { setShowReminderModal(false); setSelectedRequest(null); }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReminder}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { VendorDocument, DocumentType } from '../types';
import { format, isPast, addDays, differenceInDays } from 'date-fns';
import ConfirmModal from './ConfirmModal';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  File,
  X,
  Loader2,
  Eye,
  History,
  ChevronDown,
  ChevronRight,
  Archive,
  CheckSquare,
  Package,
  RefreshCw,
  FileCheck,
  Search,
} from 'lucide-react';

interface VendorDocumentsProps {
  vendorId: string;
  vendorTier?: string;
  organizationId?: string;
}

interface DocumentVersion extends VendorDocument {
  is_current_version?: boolean;
}

const DOCUMENT_TYPE_PATTERNS: Record<string, string[]> = {
  SOC2_TYPE2: ['soc2', 'soc 2', 'type ii', 'type2'],
  SOC1_TYPE2: ['soc1', 'soc 1'],
  ISO27001: ['iso27001', 'iso 27001', 'isms'],
  BCP_PLAN: ['bcp', 'business continuity', 'bcdr'],
  DR_PLAN: ['disaster recovery', 'dr plan', 'drp'],
  INSURANCE: ['insurance', 'coi', 'certificate of insurance', 'liability'],
  FINANCIALS: ['financial', 'annual report', 'balance sheet', 'income statement'],
  PENTEST: ['pentest', 'penetration test', 'vulnerability', 'security assessment'],
  CONTRACT: ['contract', 'agreement', 'executed'],
  AMENDMENT: ['amendment', 'addendum', 'modification'],
  SLA: ['sla', 'service level'],
  NDA: ['nda', 'non-disclosure', 'confidentiality'],
  MSA: ['msa', 'master service'],
  PRIVACY_ASSESSMENT: ['privacy', 'pia', 'dpia', 'gdpr'],
  VENDOR_QUESTIONNAIRE: ['questionnaire', 'assessment', 'security review'],
};

export default function VendorDocuments({ vendorId, vendorTier, organizationId }: VendorDocumentsProps) {
  const { user, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const orgId = organizationId || currentOrganization?.id;

  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [allVersions, setAllVersions] = useState<Record<string, DocumentVersion[]>>({});
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [versionNotes, setVersionNotes] = useState('');
  const [reviewRequired, setReviewRequired] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingDoc, setReviewingDoc] = useState<VendorDocument | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'current' | 'expired' | 'expiring'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchDocumentTypes();
  }, [vendorId]);

  async function fetchDocuments() {
    try {
      const { data, error } = await supabase
        .from('vendor_documents')
        .select(`
          *,
          document_type:document_types(*)
        `)
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      const currentDocs = (data || []).filter((d) => d.is_current);
      setDocuments(currentDocs);

      const versionMap: Record<string, DocumentVersion[]> = {};
      (data || []).forEach((doc) => {
        const key = doc.document_type_id || 'uncategorized';
        if (!versionMap[key]) versionMap[key] = [];
        versionMap[key].push({ ...doc, is_current_version: doc.is_current });
      });
      setAllVersions(versionMap);
    } catch (error) {
      logger.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDocumentTypes() {
    try {
      const { data } = await supabase
        .from('document_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      setDocumentTypes(data || []);
    } catch (error) {
      logger.error('Error fetching document types:', error);
    }
  }

  const detectDocumentType = useCallback(
    (filename: string): string | null => {
      const lowerFilename = filename.toLowerCase();
      for (const [typeCode, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
        for (const pattern of patterns) {
          if (lowerFilename.includes(pattern)) {
            const docType = documentTypes.find((t) => t.code === typeCode);
            if (docType) return docType.id;
          }
        }
      }
      return null;
    },
    [documentTypes]
  );

  function handleFileSelect(file: File | null) {
    setSelectedFile(file);
    if (file && documentTypes.length > 0) {
      const detectedType = detectDocumentType(file.name);
      if (detectedType) {
        setSelectedType(detectedType);
        const type = documentTypes.find((t) => t.id === detectedType);
        if (type?.default_expiry_months) {
          const expiry = addDays(new Date(), type.default_expiry_months * 30);
          setExpiryDate(expiry.toISOString().split('T')[0]);
        }
      }
    }
  }

  async function handleUpload() {
    if (!selectedFile || !selectedType) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const existingDocs = documents.filter((d) => d.document_type_id === selectedType);
      const newVersion = existingDocs.length > 0 ? Math.max(...existingDocs.map((d) => d.version)) + 1 : 1;
      const fileName = `${orgId}/${vendorId}/${selectedType}/${Date.now()}_v${newVersion}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-documents')
        .upload(fileName, selectedFile);

      if (uploadError) {
        if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
          logger.warn('Storage bucket may not exist, storing metadata only');
        } else {
          throw uploadError;
        }
      }

      const originalDocId = existingDocs.length > 0 ? existingDocs[0].original_document_id || existingDocs[0].id : null;

      if (existingDocs.length > 0) {
        await supabase
          .from('vendor_documents')
          .update({ is_current: false, status: 'archived' })
          .eq('vendor_id', vendorId)
          .eq('document_type_id', selectedType)
          .eq('is_current', true);
      }

      const docType = documentTypes.find((t) => t.id === selectedType);
      let calculatedExpiry = expiryDate;
      if (!calculatedExpiry && docType?.default_expiry_months) {
        const expiry = addDays(new Date(), docType.default_expiry_months * 30);
        calculatedExpiry = expiry.toISOString().split('T')[0];
      }

      const wasAutoDetected = detectDocumentType(selectedFile.name) === selectedType;

      const { error: insertError } = await supabase.from('vendor_documents').insert({
        vendor_id: vendorId,
        organization_id: orgId,
        document_type_id: selectedType,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        storage_path: fileName,
        version: newVersion,
        version_notes: versionNotes || null,
        is_current: true,
        status: 'current',
        expiry_date: calculatedExpiry || null,
        uploaded_by: user?.id,
        uploaded_by_name: profile?.full_name,
        review_required: reviewRequired,
        auto_detected_type: wasAutoDetected,
        original_document_id: originalDocId,
      });

      if (insertError) throw insertError;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        user_name: profile?.full_name,
        action: 'document_uploaded',
        entity_type: 'vendor_document',
        entity_id: vendorId,
        entity_name: selectedFile.name,
        notes: `Uploaded ${docType?.name || 'document'} (v${newVersion})`,
      });

      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedType('');
      setExpiryDate('');
      setVersionNotes('');
      setReviewRequired(false);
      fetchDocuments();
    } catch (error) {
      logger.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: VendorDocument) {
    try {
      const { data, error } = await supabase.storage
        .from('vendor-documents')
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  }

  async function handleBulkDownload() {
    if (selectedDocs.size === 0) return;

    setBulkDownloading(true);
    try {
      const docsToDownload = documents.filter((d) => selectedDocs.has(d.id));

      for (const doc of docsToDownload) {
        try {
          const { data, error } = await supabase.storage
            .from('vendor-documents')
            .download(doc.storage_path);

          if (!error && data) {
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (err) {
          logger.error(`Error downloading ${doc.file_name}:`, err);
        }
      }

      setSelectedDocs(new Set());
    } catch (error) {
      logger.error('Error in bulk download:', error);
      toast.error('Failed to download some documents');
    } finally {
      setBulkDownloading(false);
    }
  }

  async function handleDelete(doc: VendorDocument) {
    setPendingDeleteId(doc.id);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;

    const doc = documents.find(d => d.id === pendingDeleteId);
    if (!doc) return;

    try {
      await supabase.storage.from('vendor-documents').remove([doc.storage_path]);
      await supabase.from('vendor_documents').delete().eq('id', doc.id);

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        user_name: profile?.full_name,
        action: 'document_deleted',
        entity_type: 'vendor_document',
        entity_id: vendorId,
        entity_name: doc.file_name,
      });

      fetchDocuments();
    } catch (error) {
      logger.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    } finally {
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  }

  async function handleArchive(doc: VendorDocument) {
    try {
      await supabase
        .from('vendor_documents')
        .update({ is_current: false, status: 'archived' })
        .eq('id', doc.id);

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        user_name: profile?.full_name,
        action: 'document_archived',
        entity_type: 'vendor_document',
        entity_id: vendorId,
        entity_name: doc.file_name,
      });

      fetchDocuments();
    } catch (error) {
      logger.error('Error archiving document:', error);
      toast.error('Failed to archive document');
    }
  }

  async function handleMarkReviewed() {
    if (!reviewingDoc) return;

    try {
      await supabase
        .from('vendor_documents')
        .update({
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
          review_required: false,
        })
        .eq('id', reviewingDoc.id);

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        user_name: profile?.full_name,
        action: 'document_reviewed',
        entity_type: 'vendor_document',
        entity_id: vendorId,
        entity_name: reviewingDoc.file_name,
        notes: reviewNotes || 'Document marked as reviewed',
      });

      setShowReviewModal(false);
      setReviewingDoc(null);
      setReviewNotes('');
      fetchDocuments();
    } catch (error) {
      logger.error('Error marking document as reviewed:', error);
      toast.error('Failed to mark document as reviewed');
    }
  }

  function getExpiryStatus(expiryDate?: string): 'valid' | 'expiring_7' | 'expiring_14' | 'expiring_30' | 'expired' | 'none' {
    if (!expiryDate) return 'none';
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntil = differenceInDays(expiry, today);

    if (daysUntil < 0) return 'expired';
    if (daysUntil <= 7) return 'expiring_7';
    if (daysUntil <= 14) return 'expiring_14';
    if (daysUntil <= 30) return 'expiring_30';
    return 'valid';
  }

  function getExpiryBadge(status: ReturnType<typeof getExpiryStatus>, expiryDate?: string) {
    const daysUntil = expiryDate ? differenceInDays(new Date(expiryDate), new Date()) : null;

    switch (status) {
      case 'expired':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
      case 'expiring_7':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded animate-pulse">
            <Clock className="w-3 h-3" />
            {daysUntil} days left
          </span>
        );
      case 'expiring_14':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
            <Clock className="w-3 h-3" />
            {daysUntil} days left
          </span>
        );
      case 'expiring_30':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
            <Clock className="w-3 h-3" />
            {daysUntil} days left
          </span>
        );
      case 'valid':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
            <CheckCircle className="w-3 h-3" />
            Current
          </span>
        );
      default:
        return null;
    }
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function toggleDocSelection(docId: string) {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  }

  function toggleSelectAll() {
    if (selectedDocs.size === filteredDocuments.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocuments.map((d) => d.id)));
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    const status = getExpiryStatus(doc.expiry_date);
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'current' && status === 'valid') ||
      (filterStatus === 'expired' && status === 'expired') ||
      (filterStatus === 'expiring' && ['expiring_7', 'expiring_14', 'expiring_30'].includes(status));

    const matchesSearch =
      !searchTerm ||
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_type?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const groupedDocs = documentTypes.reduce(
    (acc, type) => {
      const typeDocs = filteredDocuments.filter((d) => d.document_type_id === type.id);
      if (typeDocs.length > 0 || type.required_for_tiers?.includes(vendorTier || '')) {
        acc[type.category] = acc[type.category] || [];
        acc[type.category].push({
          type,
          documents: typeDocs,
          isRequired: type.required_for_tiers?.includes(vendorTier || ''),
          versions: allVersions[type.id] || [],
        });
      }
      return acc;
    },
    {} as Record<string, Array<{ type: DocumentType; documents: VendorDocument[]; isRequired: boolean; versions: DocumentVersion[] }>>
  );

  const expiredCount = documents.filter((d) => getExpiryStatus(d.expiry_date) === 'expired').length;
  const expiring7Count = documents.filter((d) => getExpiryStatus(d.expiry_date) === 'expiring_7').length;
  const expiring14Count = documents.filter((d) => getExpiryStatus(d.expiry_date) === 'expiring_14').length;
  const expiring30Count = documents.filter((d) => getExpiryStatus(d.expiry_date) === 'expiring_30').length;
  const reviewRequiredCount = documents.filter((d) => d.review_required && !d.reviewed_at).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span>{documents.length} documents</span>
            {expiredCount > 0 && <span className="text-red-600">{expiredCount} expired</span>}
            {expiring7Count > 0 && <span className="text-red-600">{expiring7Count} expiring in 7 days</span>}
            {expiring14Count + expiring30Count > 0 && (
              <span className="text-amber-600">{expiring14Count + expiring30Count} expiring soon</span>
            )}
            {reviewRequiredCount > 0 && <span className="text-blue-600">{reviewRequiredCount} pending review</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDocs.size > 0 && (
            <button
              onClick={handleBulkDownload}
              disabled={bulkDownloading}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {bulkDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              Download {selectedDocs.size} selected
            </button>
          )}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
        >
          <option value="all">All Documents</option>
          <option value="current">Current Only</option>
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
        {filteredDocuments.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
          >
            {selectedDocs.size === filteredDocuments.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {(expiredCount > 0 || expiring7Count > 0) && (
        <div className="p-4 rounded-lg border bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Urgent Document Attention Required</p>
              <p className="text-sm text-red-700">
                {expiredCount > 0 && `${expiredCount} document(s) have expired. `}
                {expiring7Count > 0 && `${expiring7Count} document(s) expire within 7 days.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {reviewRequiredCount > 0 && (
        <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <FileCheck className="w-5 h-5 mt-0.5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Documents Pending Review</p>
              <p className="text-sm text-blue-700">
                {reviewRequiredCount} document(s) require review before being considered compliant.
              </p>
            </div>
          </div>
        </div>
      )}

      {Object.entries(groupedDocs).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || filterStatus !== 'all' ? 'No documents match your filter' : 'No documents uploaded yet'}
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 text-sm text-slate-700 hover:text-slate-900"
            >
              Upload your first document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDocs).map(([category, items]) => (
            <div key={category} className="border border-gray-200 rounded-lg">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 capitalize">{category}</h4>
              </div>
              <div className="divide-y divide-gray-200">
                {items.map(({ type, documents: docs, isRequired, versions }) => (
                  <div key={type.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{type.name}</span>
                        {isRequired && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Required
                          </span>
                        )}
                        {versions.length > 1 && (
                          <button
                            onClick={() =>
                              setExpandedVersions((prev) => ({
                                ...prev,
                                [type.id]: !prev[type.id],
                              }))
                            }
                            className="flex items-center gap-1 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <History className="w-3 h-3" />
                            {versions.length} versions
                            {expandedVersions[type.id] ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                      {docs.length === 0 && isRequired && <span className="text-xs text-red-600">Missing</span>}
                    </div>
                    {type.description && <p className="text-xs text-gray-500 mb-3">{type.description}</p>}

                    {docs.length > 0 ? (
                      <div className="space-y-2">
                        {docs.map((doc) => {
                          const status = getExpiryStatus(doc.expiry_date);
                          const needsReview = doc.review_required && !doc.reviewed_at;
                          return (
                            <div
                              key={doc.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                status === 'expired'
                                  ? 'bg-red-50 border-red-200'
                                  : status === 'expiring_7'
                                    ? 'bg-red-50 border-red-200'
                                    : status === 'expiring_14' || status === 'expiring_30'
                                      ? 'bg-amber-50 border-amber-200'
                                      : needsReview
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedDocs.has(doc.id)}
                                onChange={() => toggleDocSelection(doc.id)}
                                className="w-4 h-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
                              />
                              <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span>{formatFileSize(doc.file_size)}</span>
                                  <span>v{doc.version}</span>
                                  <span>Uploaded {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</span>
                                  {doc.expiry_date && (
                                    <span>Expires {format(new Date(doc.expiry_date), 'MMM d, yyyy')}</span>
                                  )}
                                </div>
                                {doc.reviewed_at && (
                                  <p className="text-xs text-emerald-600 mt-1">
                                    Reviewed {format(new Date(doc.reviewed_at), 'MMM d, yyyy')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getExpiryBadge(status, doc.expiry_date)}
                                {needsReview && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                    <Eye className="w-3 h-3" />
                                    Review
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {needsReview && (
                                  <button
                                    onClick={() => {
                                      setReviewingDoc(doc);
                                      setShowReviewModal(true);
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                    title="Mark as Reviewed"
                                  >
                                    <CheckSquare className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownload(doc)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleArchive(doc)}
                                  className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="Archive"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(doc)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {expandedVersions[type.id] && versions.length > 1 && (
                          <div className="mt-3 pl-4 border-l-2 border-slate-200">
                            <p className="text-xs font-medium text-slate-500 mb-2">Version History</p>
                            <div className="space-y-2">
                              {versions
                                .filter((v) => !v.is_current)
                                .map((version) => (
                                  <div
                                    key={version.id}
                                    className="flex items-center gap-3 p-2 bg-slate-50 rounded text-sm"
                                  >
                                    <File className="w-4 h-4 text-slate-400" />
                                    <span className="flex-1 truncate text-slate-600">{version.file_name}</span>
                                    <span className="text-xs text-slate-400">v{version.version}</span>
                                    <span className="text-xs text-slate-400">
                                      {format(new Date(version.uploaded_at), 'MMM d, yyyy')}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                                      {version.status || 'archived'}
                                    </span>
                                    <button
                                      onClick={() => handleDownload(version)}
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                    >
                                      <Download className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No documents</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setSelectedType('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    selectedFile ? 'border-slate-400 bg-slate-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <File className="w-5 h-5 text-slate-600" />
                      <span className="text-sm text-slate-700 font-medium">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to select a file</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, DOC, XLS up to 50MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type *
                  {selectedFile && detectDocumentType(selectedFile.name) && (
                    <span className="ml-2 text-xs text-emerald-600">(auto-detected)</span>
                  )}
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    const type = documentTypes.find((t) => t.id === e.target.value);
                    if (type?.default_expiry_months) {
                      const expiry = addDays(new Date(), type.default_expiry_months * 30);
                      setExpiryDate(expiry.toISOString().split('T')[0]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">Select type...</option>
                  {documentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version Notes (optional)</label>
                <input
                  type="text"
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="e.g., Annual renewal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reviewRequired"
                  checked={reviewRequired}
                  onChange={(e) => setReviewRequired(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
                />
                <label htmlFor="reviewRequired" className="text-sm text-gray-700">
                  Require review before considered compliant
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setSelectedType('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedType || uploading}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:bg-gray-400"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && reviewingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Mark Document as Reviewed</h3>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewingDoc(null);
                  setReviewNotes('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-900">{reviewingDoc.file_name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {reviewingDoc.document_type?.name} | v{reviewingDoc.version}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Notes (optional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this review..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewingDoc(null);
                    setReviewNotes('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkReviewed}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Mark as Reviewed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPendingDeleteId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

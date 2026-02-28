import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { OnboardingDocument, ONBOARDING_DOCUMENT_TYPES } from '../types';
import { format } from 'date-fns';
import ConfirmModal from './ConfirmModal';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  File,
  X,
  Loader2,
  Eye,
  CheckSquare,
  Search,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface OnboardingDocumentsProps {
  requestId: string;
  organizationId?: string;
  readOnly?: boolean;
}

const DOCUMENT_TYPE_PATTERNS: Record<string, string[]> = {
  soc2_report: ['soc2', 'soc 2', 'type ii', 'type2'],
  iso_certification: ['iso27001', 'iso 27001', 'isms', 'iso'],
  insurance_certificate: ['insurance', 'coi', 'certificate of insurance', 'liability'],
  financial_statement: ['financial', 'annual report', 'balance sheet'],
  contract_draft: ['contract', 'agreement', 'msa'],
  nda: ['nda', 'non-disclosure', 'confidentiality'],
  business_case: ['business case', 'justification', 'proposal'],
  security_assessment: ['security', 'assessment', 'pentest', 'vulnerability'],
  data_processing_agreement: ['dpa', 'data processing', 'gdpr'],
  technical_specification: ['technical', 'specification', 'architecture'],
};

export default function OnboardingDocuments({
  requestId,
  organizationId,
  readOnly = false,
}: OnboardingDocumentsProps) {
  const { user, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const orgId = organizationId || currentOrganization?.id;

  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingDoc, setReviewingDoc] = useState<OnboardingDocument | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('onboarding_documents')
        .select('*')
        .eq('request_id', requestId)
        .eq('is_current', true)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      logger.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const detectDocumentType = useCallback((filename: string): string | null => {
    const lowerFilename = filename.toLowerCase();
    for (const [typeCode, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (lowerFilename.includes(pattern)) {
          return typeCode;
        }
      }
    }
    return null;
  }, []);

  function handleFileSelect(file: File | null) {
    setSelectedFile(file);
    if (file) {
      const detectedType = detectDocumentType(file.name);
      if (detectedType) {
        setSelectedType(detectedType);
      }
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !selectedType || !orgId) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const existingDocs = documents.filter((d) => d.document_type === selectedType);
      const newVersion = existingDocs.length > 0 ? Math.max(...existingDocs.map((d) => d.version)) + 1 : 1;
      const fileName = `${orgId}/onboarding/${requestId}/${selectedType}/${Date.now()}_v${newVersion}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('onboarding-documents')
        .upload(fileName, selectedFile);

      if (uploadError) {
        if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
          logger.warn('Storage bucket may not exist, storing metadata only');
        } else {
          throw uploadError;
        }
      }

      if (existingDocs.length > 0) {
        await supabase
          .from('onboarding_documents')
          .update({ is_current: false })
          .eq('request_id', requestId)
          .eq('document_type', selectedType)
          .eq('is_current', true);
      }

      const wasAutoDetected = detectDocumentType(selectedFile.name) === selectedType;

      const { error: insertError } = await supabase.from('onboarding_documents').insert({
        request_id: requestId,
        organization_id: orgId,
        document_type: selectedType,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        storage_path: fileName,
        version: newVersion,
        description: description || null,
        is_current: true,
        uploaded_by: user?.id,
        reviewed: false,
      });

      if (insertError) throw insertError;

      await supabase.from('onboarding_audit_log').insert({
        organization_id: orgId,
        request_id: requestId,
        action_type: 'document_uploaded',
        action_description: `Uploaded ${ONBOARDING_DOCUMENT_TYPES[selectedType as keyof typeof ONBOARDING_DOCUMENT_TYPES] || selectedType} (v${newVersion})`,
        performed_by: user?.id,
        performed_by_name: profile?.full_name || profile?.email,
        new_values: {
          file_name: selectedFile.name,
          document_type: selectedType,
          auto_detected: wasAutoDetected,
        },
      });

      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedType('');
      setDescription('');
      fetchDocuments();
    } catch (error) {
      logger.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: OnboardingDocument) {
    try {
      const { data, error } = await supabase.storage
        .from('onboarding-documents')
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

  async function handleDelete(doc: OnboardingDocument) {
    setPendingDeleteId(doc.id);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;

    const doc = documents.find(d => d.id === pendingDeleteId);
    if (!doc) return;

    try {
      await supabase.storage.from('onboarding-documents').remove([doc.storage_path]);
      await supabase.from('onboarding_documents').delete().eq('id', doc.id);

      await supabase.from('onboarding_audit_log').insert({
        organization_id: orgId,
        request_id: requestId,
        action_type: 'document_deleted',
        action_description: `Deleted document: ${doc.file_name}`,
        performed_by: user?.id,
        performed_by_name: profile?.full_name || profile?.email,
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

  async function handleMarkReviewed() {
    if (!reviewingDoc) return;

    try {
      await supabase
        .from('onboarding_documents')
        .update({
          reviewed: true,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq('id', reviewingDoc.id);

      await supabase.from('onboarding_audit_log').insert({
        organization_id: orgId,
        request_id: requestId,
        action_type: 'document_reviewed',
        action_description: `Reviewed document: ${reviewingDoc.file_name}`,
        performed_by: user?.id,
        performed_by_name: profile?.full_name || profile?.email,
        new_values: { review_notes: reviewNotes },
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

  function formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const filteredDocuments = documents.filter((doc) => {
    if (!searchTerm) return true;
    const typeLabel = ONBOARDING_DOCUMENT_TYPES[doc.document_type as keyof typeof ONBOARDING_DOCUMENT_TYPES] || doc.document_type;
    return (
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      typeLabel?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const reviewedCount = documents.filter((d) => d.reviewed).length;
  const pendingReviewCount = documents.filter((d) => !d.reviewed).length;

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
          <h3 className="text-lg font-semibold text-gray-900">Supporting Documents</h3>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span>{documents.length} documents</span>
            {reviewedCount > 0 && (
              <span className="text-emerald-600">{reviewedCount} reviewed</span>
            )}
            {pendingReviewCount > 0 && (
              <span className="text-amber-600">{pendingReviewCount} pending review</span>
            )}
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        )}
      </div>

      {documents.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? 'No documents match your search' : 'No documents uploaded yet'}
          </p>
          {!readOnly && !searchTerm && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 text-sm text-slate-700 hover:text-slate-900"
            >
              Upload your first document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                doc.reviewed
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              } transition-colors`}
            >
              <File className={`w-5 h-5 flex-shrink-0 ${doc.reviewed ? 'text-emerald-500' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                  {doc.reviewed && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                      <CheckCircle className="w-3 h-3" />
                      Reviewed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                    {ONBOARDING_DOCUMENT_TYPES[doc.document_type as keyof typeof ONBOARDING_DOCUMENT_TYPES] || doc.document_type || 'Document'}
                  </span>
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>v{doc.version}</span>
                  <span>Uploaded {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</span>
                </div>
                {doc.description && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{doc.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!doc.reviewed && !readOnly && (
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
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
                  setDescription('');
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
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    dragActive
                      ? 'border-blue-400 bg-blue-50'
                      : selectedFile
                        ? 'border-slate-400 bg-slate-50'
                        : 'border-gray-300 hover:border-gray-400'
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
                      <p className="text-sm text-gray-500">
                        {dragActive ? 'Drop file here' : 'Click or drag to upload'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PDF, DOC, XLS up to 50MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv"
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
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">Select type...</option>
                  {Object.entries(ONBOARDING_DOCUMENT_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the document"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setSelectedType('');
                    setDescription('');
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
                  {ONBOARDING_DOCUMENT_TYPES[reviewingDoc.document_type as keyof typeof ONBOARDING_DOCUMENT_TYPES] || reviewingDoc.document_type} | v{reviewingDoc.version}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Notes (optional)
                </label>
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
        onCancel={() => {
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

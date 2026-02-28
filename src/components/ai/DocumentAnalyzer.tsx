import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import { AIFeedback } from './index';
import type { AIDocumentAnalysis } from '../../types';

interface DocumentAnalyzerProps {
  vendorId: string;
  vendorName: string;
}

export default function DocumentAnalyzer({ vendorId, vendorName }: DocumentAnalyzerProps) {
  const [analysis, setAnalysis] = useState<AIDocumentAnalysis | null>(null);
  const [fileName, setFileName] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { loading, execute, logId } = useAI<AIDocumentAnalysis>({
    action: 'document-analyze',
    vendorId,
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setAnalysis(null);

    // Extract text from the file
    let text = '';
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        text = await file.text();
      } else {
        // For PDF and other formats, read as text (basic extraction)
        text = await file.text();
      }
    } catch {
      text = `[File: ${file.name}, Size: ${(file.size / 1024).toFixed(1)}KB, Type: ${file.type}]`;
    }

    // Limit text length for API
    const truncatedText = text.substring(0, 15000);
    setExtractedText(truncatedText);

    // Determine document type hint from filename
    const nameLC = file.name.toLowerCase();
    let documentTypeHint = 'unknown';
    if (nameLC.includes('soc') || nameLC.includes('audit')) documentTypeHint = 'audit_report';
    else if (nameLC.includes('contract') || nameLC.includes('agreement') || nameLC.includes('msa'))
      documentTypeHint = 'contract';
    else if (nameLC.includes('insurance') || nameLC.includes('certificate'))
      documentTypeHint = 'insurance_certificate';
    else if (nameLC.includes('policy') || nameLC.includes('security'))
      documentTypeHint = 'security_policy';
    else if (nameLC.includes('bcp') || nameLC.includes('continuity'))
      documentTypeHint = 'bcp_plan';

    const result = await execute({
      document_text: truncatedText,
      document_type_hint: documentTypeHint,
      file_name: file.name,
      vendor_name: vendorName,
    });

    if (result.success && result.data) {
      setAnalysis(result.data as AIDocumentAnalysis);
      setExpanded(true);
    }
  }

  function clearAnalysis() {
    setAnalysis(null);
    setFileName('');
    setExtractedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-700">AI Document Analyzer</h4>
            <p className="text-xs text-slate-400">Upload vendor documents for AI analysis</p>
          </div>
        </div>

        {!analysis && !loading && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-colors"
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">
              Drop a document or click to upload
            </p>
            <p className="text-xs text-slate-400 mt-1">
              SOC 2 reports, contracts, policies, insurance certificates
            </p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.doc,.docx,.csv"
              className="hidden"
            />
          </div>
        )}

        {loading && (
          <div className="border border-slate-200 rounded-lg p-6 text-center">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-600">Analyzing {fileName}...</p>
            <p className="text-xs text-slate-400 mt-1">
              Extracting findings, compliance gaps, and key dates
            </p>
          </div>
        )}

        {analysis && (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-600" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{fileName}</p>
                  <p className="text-xs text-slate-500">
                    Detected type: {analysis.document_type?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <button onClick={clearAnalysis} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Key Findings */}
            {analysis.key_findings && analysis.key_findings.length > 0 && (
              <div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Key Findings ({analysis.key_findings.length})
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {expanded && (
                  <ul className="space-y-1">
                    {analysis.key_findings.map((finding, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="text-emerald-500 mt-0.5">+</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Compliance Gaps */}
            {analysis.compliance_gaps && analysis.compliance_gaps.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800">
                    Compliance Gaps ({analysis.compliance_gaps.length})
                  </span>
                </div>
                <ul className="space-y-1">
                  {analysis.compliance_gaps.map((gap, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                      <span className="text-amber-500 mt-0.5">!</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expiry Dates */}
            {analysis.expiry_dates && analysis.expiry_dates.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-slate-600">Key Dates</span>
                </div>
                <div className="space-y-1">
                  {analysis.expiry_dates.map((date, i) => (
                    <p key={i} className="text-xs text-slate-600 bg-blue-50 px-2 py-1 rounded">
                      {date}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Flags */}
            {analysis.risk_flags && analysis.risk_flags.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-xs font-medium text-red-800">
                    Risk Flags ({analysis.risk_flags.length})
                  </span>
                </div>
                <ul className="space-y-1">
                  {analysis.risk_flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                      <span className="text-red-500 mt-0.5">!</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* OSFI Provisions (for contracts) */}
            {analysis.osfi_provisions && Object.keys(analysis.osfi_provisions).length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">OSFI B-10 Provisions</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(analysis.osfi_provisions).map(([provision, status]) => (
                    <div key={provision} className="flex items-center gap-1 text-xs">
                      {status ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      )}
                      <span className={status ? 'text-slate-600' : 'text-amber-700'}>
                        {provision.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload another */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                Analyze another document
              </button>
              {logId && <AIFeedback logId={logId} compact />}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.doc,.docx,.csv"
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
}

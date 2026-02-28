import { useState, useRef, useCallback } from 'react';
import { logger } from '../lib/logger';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Download,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  ClipboardList,
  Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SERVICE_CATEGORIES, BUSINESS_UNITS } from '../lib/constants';
import { toast } from 'sonner';

interface VendorImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onImportComplete: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: ValidationError[];
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

const ONBOARDING_FIELDS = [
  { key: 'legal_name', label: 'Legal Name', required: true },
  { key: 'trading_name', label: 'Trading Name', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'service_category', label: 'Service Category', required: true },
  { key: 'provider_type', label: 'Provider Type', required: false },
  { key: 'business_unit', label: 'Business Unit', required: false },
  { key: 'is_critical', label: 'Is Critical (yes/no)', required: false },
  { key: 'contract_value_cad', label: 'Contract Value (CAD)', required: false },
  { key: 'primary_contact_email', label: 'Primary Contact Email', required: false },
  { key: 'primary_contact_name', label: 'Primary Contact Name', required: false },
  { key: 'primary_contact_phone', label: 'Primary Contact Phone', required: false },
  { key: 'business_justification', label: 'Business Justification', required: false },
  { key: 'website', label: 'Website', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'province_state', label: 'Province/State', required: false },
  { key: 'handles_sensitive_data', label: 'Handles Sensitive Data (yes/no)', required: false },
  { key: 'has_system_access', label: 'Has System Access (yes/no)', required: false },
  { key: 'uses_subcontractors', label: 'Uses Subcontractors (yes/no)', required: false },
];

const SERVICE_CATEGORY_MAP: Record<string, string> = {};
SERVICE_CATEGORIES.forEach((cat) => {
  SERVICE_CATEGORY_MAP[cat.label.toLowerCase()] = cat.value;
  SERVICE_CATEGORY_MAP[cat.value.toLowerCase()] = cat.value;
});

const BUSINESS_UNIT_MAP: Record<string, string> = {};
BUSINESS_UNITS.forEach((unit) => {
  BUSINESS_UNIT_MAP[unit.label.toLowerCase()] = unit.value;
  BUSINESS_UNIT_MAP[unit.value.toLowerCase()] = unit.value;
});

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.some((v) => v.trim())) {
      const row: ParsedRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

export default function VendorImportModal({
  isOpen,
  onClose,
  organizationId,
  onImportComplete,
}: VendorImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setValidationErrors([]);
    setImportResult(null);
    setIsProcessing(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      processFile(droppedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const text = await selectedFile.text();
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0 || rows.length === 0) {
        throw new Error('CSV file is empty or invalid');
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      const autoMapping: Record<string, string> = {};
      headers.forEach((header) => {
        const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, '');
        ONBOARDING_FIELDS.forEach((field) => {
          const normalizedField = field.key.toLowerCase().replace(/[_\s-]/g, '');
          const normalizedLabel = field.label.toLowerCase().replace(/[_\s-]/g, '');
          if (normalizedHeader === normalizedField || normalizedHeader === normalizedLabel) {
            autoMapping[field.key] = header;
          }
        });
      });
      setColumnMapping(autoMapping);
      setStep('mapping');
    } catch (error) {
      logger.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getMappedValue = (row: ParsedRow, fieldKey: string): string | number | boolean | null => {
    const csvCol = columnMapping[fieldKey];
    if (!csvCol) return null;

    const value = row[csvCol]?.trim();
    if (!value) return null;

    switch (fieldKey) {
      case 'service_category':
        return SERVICE_CATEGORY_MAP[value.toLowerCase()] || null;
      case 'business_unit':
        return BUSINESS_UNIT_MAP[value.toLowerCase()] || null;
      case 'is_critical':
      case 'uses_subcontractors':
      case 'handles_sensitive_data':
      case 'has_system_access':
        return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value === '1';
      case 'contract_value_cad':
        const numValue = parseFloat(value.replace(/[$,]/g, ''));
        return isNaN(numValue) ? null : numValue;
      default:
        return value;
    }
  };

  const validateData = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    csvRows.forEach((row, index) => {
      const rowNum = index + 2;

      const legalNameCol = columnMapping['legal_name'];
      if (!legalNameCol || !row[legalNameCol]?.trim()) {
        errors.push({ row: rowNum, field: 'legal_name', message: 'Legal name is required' });
      }

      const serviceCategoryCol = columnMapping['service_category'];
      if (!serviceCategoryCol || !row[serviceCategoryCol]?.trim()) {
        errors.push({
          row: rowNum,
          field: 'service_category',
          message: 'Service category is required',
        });
      } else {
        const categoryValue = row[serviceCategoryCol].toLowerCase();
        if (!SERVICE_CATEGORY_MAP[categoryValue]) {
          errors.push({
            row: rowNum,
            field: 'service_category',
            message: `Invalid service category: "${row[serviceCategoryCol]}"`,
          });
        }
      }

      const businessUnitCol = columnMapping['business_unit'];
      if (businessUnitCol && row[businessUnitCol]?.trim()) {
        const unitValue = row[businessUnitCol].toLowerCase();
        if (!BUSINESS_UNIT_MAP[unitValue]) {
          errors.push({
            row: rowNum,
            field: 'business_unit',
            message: `Invalid business unit: "${row[businessUnitCol]}"`,
          });
        }
      }

      const emailCol = columnMapping['primary_contact_email'];
      if (emailCol && row[emailCol]?.trim()) {
        const email = row[emailCol].trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({
            row: rowNum,
            field: 'primary_contact_email',
            message: `Invalid email format: "${email}"`,
          });
        }
      }

      const contractValueCol = columnMapping['contract_value_cad'];
      if (contractValueCol && row[contractValueCol]?.trim()) {
        const value = row[contractValueCol].replace(/[$,]/g, '');
        if (isNaN(parseFloat(value))) {
          errors.push({
            row: rowNum,
            field: 'contract_value_cad',
            message: `Invalid contract value: "${row[contractValueCol]}"`,
          });
        }
      }
    });

    return errors;
  };

  const handleValidateAndPreview = () => {
    const errors = validateData();
    setValidationErrors(errors);
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    setIsProcessing(true);

    const result: ImportResult = { success: 0, failed: 0, errors: [] };
    const validRows = csvRows.filter((_, index) => {
      return !validationErrors.some((e) => e.row === index + 2);
    });

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const originalIndex = csvRows.indexOf(row);
      const rowNum = originalIndex + 2;

      try {
        const legalName = getMappedValue(row, 'legal_name') as string;
        const isCritical = (getMappedValue(row, 'is_critical') as boolean) || false;
        const usesSubcontractors = (getMappedValue(row, 'uses_subcontractors') as boolean) || false;
        const handlesSensitiveData = (getMappedValue(row, 'handles_sensitive_data') as boolean) || false;
        const hasSystemAccess = (getMappedValue(row, 'has_system_access') as boolean) || false;
        const contractValue = getMappedValue(row, 'contract_value_cad') as number | null;

        const onboardingData: Record<string, unknown> = {
          organization_id: organizationId,
          vendor_legal_name: legalName,
          vendor_trading_name: getMappedValue(row, 'trading_name') as string | null,
          vendor_description: getMappedValue(row, 'description') as string | null,
          vendor_country: (getMappedValue(row, 'country') as string) || 'Canada',
          vendor_city: getMappedValue(row, 'city') as string | null,
          vendor_province_state: getMappedValue(row, 'province_state') as string | null,
          vendor_website: getMappedValue(row, 'website') as string | null,
          vendor_primary_contact_name: getMappedValue(row, 'primary_contact_name') as string | null,
          vendor_primary_contact_email: getMappedValue(row, 'primary_contact_email') as string | null,
          vendor_primary_contact_phone: getMappedValue(row, 'primary_contact_phone') as string | null,
          service_category: getMappedValue(row, 'service_category') as string,
          service_description: getMappedValue(row, 'description') as string | null,
          provider_type: (getMappedValue(row, 'provider_type') as string) || 'tpsp_vendor',
          requesting_business_unit: getMappedValue(row, 'business_unit') as string | null || 'unknown',
          business_justification: (getMappedValue(row, 'business_justification') as string) || 'Imported via CSV bulk import',
          estimated_contract_value_cad: contractValue,
          is_critical_service: isCritical,
          supports_essential_operations: isCritical,
          handles_sensitive_data: handlesSensitiveData,
          has_system_access: hasSystemAccess,
          uses_subcontractors: usesSubcontractors,
          status: 'draft',
          current_defense_line: '1a',
        };

        const { error } = await supabase
          .from('onboarding_requests')
          .insert(onboardingData);

        if (error) throw error;

        result.success++;
      } catch (error: unknown) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Failed to create onboarding request';
        result.errors.push({
          row: rowNum,
          field: 'general',
          message: errorMessage,
        });
      }
    }

    setImportResult(result);
    setStep('complete');
    setIsProcessing(false);
  };

  const downloadErrorReport = () => {
    if (!importResult) return;

    const allErrors = [...validationErrors, ...importResult.errors];
    const csvContent = [
      'Row,Field,Error',
      ...allErrors.map((e) => `${e.row},"${e.field}","${e.message}"`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const headers = ONBOARDING_FIELDS.map((f) => f.label);
    const sampleRow = [
      'Acme Corporation',
      'Acme Corp',
      'Canada',
      'IT & Telecom Services',
      'tpsp_vendor',
      'Technology',
      'no',
      '50000',
      'contact@acme.com',
      'John Smith',
      '+1-555-123-4567',
      'Required IT services for infrastructure',
      'https://acme.com',
      'Provider of IT services',
      'Toronto',
      'ON',
      'yes',
      'no',
      'no',
    ];

    const csvContent = [headers.join(','), sampleRow.map((v) => `"${v}"`).join(',')].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onboarding_request_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const previewRows = csvRows.slice(0, 5);
  const hasValidationErrors = validationErrors.length > 0;
  const rowsWithErrors = new Set(validationErrors.map((e) => e.row));
  const validRowCount = csvRows.length - rowsWithErrors.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">Import Onboarding Requests from CSV</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center justify-center py-4 px-6 bg-slate-50 border-b border-slate-200">
          {['upload', 'mapping', 'preview', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step === s || ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > i
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`ml-2 text-sm ${
                  step === s ? 'text-slate-900 font-medium' : 'text-slate-500'
                }`}
              >
                {s === 'upload'
                  ? 'Upload'
                  : s === 'mapping'
                    ? 'Map Columns'
                    : s === 'preview'
                      ? 'Preview'
                      : 'Complete'}
              </span>
              {i < 3 && <div className="w-12 h-px bg-slate-300 mx-4" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">Import Process Update</h3>
                    <p className="text-sm text-blue-800">
                      This import creates draft onboarding requests that will go through the proper approval workflow.
                      All imported requests will be created in draft status and must be submitted for 1B review.
                      This ensures proper governance and risk assessment for all third parties.
                    </p>
                  </div>
                </div>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
              >
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-700 mb-2">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-sm text-slate-500">
                  Supports .csv files with vendor data
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-3">Required Columns</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {ONBOARDING_FIELDS.filter((f) => f.required).map((field) => (
                    <div key={field.key} className="flex items-center text-slate-600">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                      {field.label}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={downloadTemplate}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV Template</span>
              </button>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>File loaded:</strong> {file?.name} ({csvRows.length} rows found)
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Map CSV Columns to Onboarding Request Fields</h3>
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {ONBOARDING_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center space-x-4 p-3 rounded-lg bg-slate-50">
                      <div className="w-56">
                        <span className="text-sm font-medium text-slate-700">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                        }
                        className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          field.required && !columnMapping[field.key]
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-300'
                        }`}
                      >
                        <option value="">-- Select CSV column --</option>
                        {csvHeaders.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              {hasValidationErrors && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">
                        {validationErrors.length} validation error(s) found
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {validRowCount} of {csvRows.length} rows will be imported. Rows with errors
                        will be skipped.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!hasValidationErrors && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="font-medium text-green-800">
                      All {csvRows.length} rows validated successfully
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <ClipboardList className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Draft Onboarding Requests</p>
                    <p className="text-sm text-blue-800 mt-1">
                      All imported rows will be created as draft onboarding requests.
                      They must be reviewed and submitted through the standard onboarding workflow
                      before vendors are created in the system.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-slate-900 mb-3">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Legal Name
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Service Category
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewRows.map((row, index) => {
                        const rowNum = index + 2;
                        const rowErrors = validationErrors.filter((e) => e.row === rowNum);
                        const hasError = rowErrors.length > 0;

                        return (
                          <tr
                            key={index}
                            className={hasError ? 'bg-red-50' : 'hover:bg-slate-50'}
                          >
                            <td className="px-3 py-2 text-slate-500">{rowNum}</td>
                            <td className="px-3 py-2">
                              {columnMapping['legal_name']
                                ? row[columnMapping['legal_name']]
                                : '-'}
                            </td>
                            <td className="px-3 py-2">
                              {columnMapping['service_category']
                                ? row[columnMapping['service_category']]
                                : '-'}
                            </td>
                            <td className="px-3 py-2">
                              {hasError ? (
                                <span className="inline-flex items-center text-red-600">
                                  <AlertTriangle className="w-4 h-4 mr-1" />
                                  {rowErrors[0].message}
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-green-600">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {csvRows.length > 5 && (
                  <p className="text-sm text-slate-500 mt-2">
                    ...and {csvRows.length - 5} more rows
                  </p>
                )}
              </div>

              {hasValidationErrors && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-3">Validation Errors</h3>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Field</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {validationErrors.slice(0, 20).map((error, index) => (
                          <tr key={index} className="bg-red-50">
                            <td className="px-3 py-2">{error.row}</td>
                            <td className="px-3 py-2">{error.field}</td>
                            <td className="px-3 py-2 text-red-700">{error.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {validationErrors.length > 20 && (
                    <p className="text-sm text-slate-500 mt-2">
                      ...and {validationErrors.length - 20} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-900">Creating onboarding requests...</p>
              <p className="text-sm text-slate-500 mt-1">
                Creating draft onboarding requests for review
              </p>
            </div>
          )}

          {step === 'complete' && importResult && (
            <div className="space-y-6">
              <div
                className={`rounded-lg p-6 text-center ${
                  importResult.failed === 0 ? 'bg-green-50' : 'bg-amber-50'
                }`}
              >
                {importResult.failed === 0 ? (
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                ) : (
                  <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                )}
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Import Complete</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Draft onboarding requests have been created. Navigate to the Onboarding Dashboard
                  to review and submit them for approval.
                </p>
                <div className="flex items-center justify-center space-x-8 mt-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{importResult.success}</p>
                    <p className="text-sm text-slate-600">Created</p>
                  </div>
                  {importResult.failed > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">{importResult.failed}</p>
                      <p className="text-sm text-slate-600">Failed</p>
                    </div>
                  )}
                  {validationErrors.length > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-600">
                        {validationErrors.length}
                      </p>
                      <p className="text-sm text-slate-600">Skipped (validation)</p>
                    </div>
                  )}
                </div>
              </div>

              {(importResult.errors.length > 0 || validationErrors.length > 0) && (
                <button
                  onClick={downloadErrorReport}
                  className="flex items-center justify-center space-x-2 w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Error Report</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50">
          <div>
            {step === 'mapping' && (
              <button
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                }}
                className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={() => setStep('mapping')}
                className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {step === 'complete' && (
              <>
                <button
                  onClick={resetState}
                  className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Import More</span>
                </button>
                <button
                  onClick={() => {
                    onImportComplete();
                    handleClose();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              </>
            )}

            {step === 'mapping' && (
              <button
                onClick={handleValidateAndPreview}
                disabled={!columnMapping['legal_name'] || !columnMapping['service_category']}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Validate & Preview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={validRowCount === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                <span>
                  Import {validRowCount} Onboarding Request{validRowCount !== 1 ? 's' : ''}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

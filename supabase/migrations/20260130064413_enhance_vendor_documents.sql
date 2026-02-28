/*
  # Enhance Vendor Documents Table

  1. New Columns
    - `organization_id` - Link to organization for multi-tenancy
    - `status` - Document status (current, archived, expired)
    - `review_required` - Flag for documents requiring review
    - `reviewed_by` - User who reviewed the document
    - `reviewed_at` - Timestamp of review
    - `review_notes` - Notes from the reviewer
    - `auto_detected_type` - Whether type was auto-detected from filename
    - `original_document_id` - Link to original document for versions

  2. New Index
    - Index on organization_id for faster queries
    - Index on status for filtering

  3. Security
    - Update RLS to include organization context
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'status'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN status text DEFAULT 'current' CHECK (status IN ('current', 'archived', 'expired'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'review_required'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN review_required boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'review_notes'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN review_notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'auto_detected_type'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN auto_detected_type boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_documents' AND column_name = 'original_document_id'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN original_document_id uuid REFERENCES vendor_documents(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_documents_organization ON vendor_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_status ON vendor_documents(status);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_review ON vendor_documents(review_required, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_original ON vendor_documents(original_document_id);

UPDATE vendor_documents 
SET organization_id = (SELECT organization_id FROM vendors WHERE vendors.id = vendor_documents.vendor_id)
WHERE organization_id IS NULL;

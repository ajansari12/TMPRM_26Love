/*
  # Create Vendors Table

  1. New Tables
    - `vendors` - Third-party service providers and vendors
      - Identification fields (id, vendor_id, names, description)
      - Company information (address, website, LEI, parent, employees, years)
      - Contact information (primary contact details)
      - Internal ownership (responsible officer, business unit)
      - Service classification (category, description, provider type)
      - Risk profile (is_critical, tier, scores, ratings)
      - Status & lifecycle (status, lifecycle_stage, dates)
      - Data access (system access, data access level, sensitive data)
      - Subcontractors (uses subcontractors, oversight level)
      - Contract info (has contract, type, dates, duration, value)
      - Notes and timestamps

  2. Security
    - Enable RLS on `vendors` table
    - Policies for authenticated users based on role and business unit
*/

CREATE TABLE IF NOT EXISTS vendors (
  -- Identification
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id text UNIQUE NOT NULL,
  legal_name text NOT NULL,
  trading_name text,
  description text,

  -- Company Information
  street_address text,
  suite_unit text,
  city text,
  province_state text,
  postal_code text,
  country text DEFAULT 'Canada',
  website text,
  number_of_employees int,
  years_in_operation int,
  lei text,
  ultimate_parent_name text,

  -- Primary Contact
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,

  -- Internal Ownership
  responsible_officer text,
  business_unit text,

  -- Service Classification
  service_category text NOT NULL,
  service_description text,
  provider_type text NOT NULL,

  -- Risk Profile
  is_critical boolean DEFAULT false,
  tier text,
  impact_score decimal(3,2),
  likelihood_score decimal(3,2),
  risk_rating decimal(5,2),
  inherent_risk_level text,

  -- Status & Lifecycle
  status text DEFAULT 'pending_approval',
  lifecycle_stage text DEFAULT 'identification',
  onboarding_date date,
  last_review_date date,
  next_review_date date,

  -- Data Access
  has_system_access boolean DEFAULT false,
  data_access_level text,
  handles_sensitive_data boolean DEFAULT false,
  data_location text,

  -- Subcontractors
  uses_subcontractors boolean DEFAULT false,
  subcontractor_oversight_level text,

  -- Contract Info
  has_formal_contract boolean DEFAULT false,
  contract_type text,
  contract_start_date date,
  contract_end_date date,
  contract_duration text,
  contract_value_cad decimal(15,2),

  -- Notes
  notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Create function to generate vendor_id
CREATE OR REPLACE FUNCTION generate_vendor_id()
RETURNS text AS $$
DECLARE
  next_num int;
  year_str text;
  new_id text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN vendor_id ~ '^TPSP-[0-9]{4}-[0-9]+$' THEN
        CAST(substring(vendor_id from 'TPSP-[0-9]{4}-([0-9]+)') AS int)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM vendors
  WHERE vendor_id LIKE 'TPSP-' || year_str || '-%';
  
  new_id := 'TPSP-' || year_str || '-' || lpad(next_num::text, 3, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate vendor_id if not provided
CREATE OR REPLACE FUNCTION set_vendor_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_id IS NULL OR NEW.vendor_id = '' THEN
    NEW.vendor_id := generate_vendor_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_vendor_id ON vendors;
CREATE TRIGGER trigger_set_vendor_id
  BEFORE INSERT ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION set_vendor_id();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendors_updated_at ON vendors;
CREATE TRIGGER trigger_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_id ON vendors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(tier);
CREATE INDEX IF NOT EXISTS idx_vendors_service_category ON vendors(service_category);
CREATE INDEX IF NOT EXISTS idx_vendors_business_unit ON vendors(business_unit);
CREATE INDEX IF NOT EXISTS idx_vendors_lifecycle_stage ON vendors(lifecycle_stage);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read vendors
CREATE POLICY "Authenticated users can read vendors"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert vendors
CREATE POLICY "Authenticated users can insert vendors"
  ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Risk managers and vendor owners can update vendors
CREATE POLICY "Authorized users can update vendors"
  ON vendors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('risk_manager', 'vendor_owner', 'compliance_analyst')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('risk_manager', 'vendor_owner', 'compliance_analyst')
    )
  );

-- Risk managers can delete vendors
CREATE POLICY "Risk managers can delete vendors"
  ON vendors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'risk_manager'
    )
  );

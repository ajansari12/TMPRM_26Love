/*
  # Onboarding Request Templates and Cloning

  1. New Tables
    - `onboarding_request_templates`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `name` (text) - Template name (e.g., "IT Services Provider", "Consulting Firm")
      - `description` (text) - What this template is for
      - `is_system_template` (boolean) - Whether this is a default system template
      - `template_data` (jsonb) - Pre-filled form data
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `cloned_from` column to onboarding_requests table to track clones
    - Add `is_draft` column to onboarding_requests to support save-and-resume

  3. Security
    - Enable RLS on onboarding_request_templates
    - Users can view templates for their organization
    - Only users with can_manage_users permission can create/modify templates
    - Add function to clone onboarding requests

  4. System Templates
    - Create default templates for common vendor types
*/

-- Create onboarding request templates table
CREATE TABLE IF NOT EXISTS onboarding_request_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_system_template boolean DEFAULT false,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_org_id ON onboarding_request_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_system ON onboarding_request_templates(is_system_template);

-- Enable RLS
ALTER TABLE onboarding_request_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
CREATE POLICY "Users can view templates for their organization"
  ON onboarding_request_templates FOR SELECT
  TO authenticated
  USING (
    is_system_template = true 
    OR organization_id IN (
      SELECT organization_id FROM organization_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert templates"
  ON onboarding_request_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_id = onboarding_request_templates.organization_id
      AND user_id = auth.uid()
      AND (can_manage_users = true OR can_configure_workflows = true)
    )
  );

CREATE POLICY "Admins can update templates"
  ON onboarding_request_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_id = onboarding_request_templates.organization_id
      AND user_id = auth.uid()
      AND (can_manage_users = true OR can_configure_workflows = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_id = onboarding_request_templates.organization_id
      AND user_id = auth.uid()
      AND (can_manage_users = true OR can_configure_workflows = true)
    )
  );

CREATE POLICY "Admins can delete templates"
  ON onboarding_request_templates FOR DELETE
  TO authenticated
  USING (
    is_system_template = false
    AND EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_id = onboarding_request_templates.organization_id
      AND user_id = auth.uid()
      AND (can_manage_users = true OR can_configure_workflows = true)
    )
  );

-- Add cloned_from column to onboarding_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'cloned_from'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN cloned_from uuid REFERENCES onboarding_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add is_draft column to onboarding_requests for save-and-resume
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_requests' AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE onboarding_requests ADD COLUMN is_draft boolean DEFAULT false;
  END IF;
END $$;

-- Add index for cloned_from
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_cloned_from ON onboarding_requests(cloned_from);

-- Function to clone an onboarding request
CREATE OR REPLACE FUNCTION clone_onboarding_request(
  source_request_id uuid,
  new_organization_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  new_request_id uuid;
  source_request onboarding_requests;
BEGIN
  -- Get the source request
  SELECT * INTO source_request
  FROM onboarding_requests
  WHERE id = source_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source onboarding request not found';
  END IF;

  -- Create new request as draft
  INSERT INTO onboarding_requests (
    organization_id,
    legal_name,
    trading_name,
    country,
    city,
    province_state,
    website,
    description,
    service_category,
    provider_type,
    business_unit,
    is_critical,
    contract_value_cad,
    primary_contact_name,
    primary_contact_email,
    primary_contact_phone,
    handles_sensitive_data,
    has_system_access,
    uses_subcontractors,
    business_justification,
    requested_by,
    status,
    cloned_from,
    is_draft
  ) VALUES (
    COALESCE(new_organization_id, source_request.organization_id),
    source_request.legal_name || ' (Copy)',
    source_request.trading_name,
    source_request.country,
    source_request.city,
    source_request.province_state,
    source_request.website,
    source_request.description,
    source_request.service_category,
    source_request.provider_type,
    source_request.business_unit,
    source_request.is_critical,
    source_request.contract_value_cad,
    source_request.primary_contact_name,
    source_request.primary_contact_email,
    source_request.primary_contact_phone,
    source_request.handles_sensitive_data,
    source_request.has_system_access,
    source_request.uses_subcontractors,
    source_request.business_justification,
    auth.uid(),
    'draft',
    source_request_id,
    true
  ) RETURNING id INTO new_request_id;

  RETURN new_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create onboarding request from template
CREATE OR REPLACE FUNCTION create_onboarding_from_template(
  template_id uuid,
  org_id uuid
) RETURNS uuid AS $$
DECLARE
  new_request_id uuid;
  template_record onboarding_request_templates;
  template_json jsonb;
BEGIN
  -- Get the template
  SELECT * INTO template_record
  FROM onboarding_request_templates
  WHERE id = template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  template_json := template_record.template_data;

  -- Create new request as draft from template
  INSERT INTO onboarding_requests (
    organization_id,
    legal_name,
    trading_name,
    country,
    city,
    province_state,
    website,
    description,
    service_category,
    provider_type,
    business_unit,
    is_critical,
    contract_value_cad,
    handles_sensitive_data,
    has_system_access,
    uses_subcontractors,
    business_justification,
    requested_by,
    status,
    is_draft
  ) VALUES (
    org_id,
    COALESCE(template_json->>'legal_name', ''),
    template_json->>'trading_name',
    template_json->>'country',
    template_json->>'city',
    template_json->>'province_state',
    template_json->>'website',
    template_json->>'description',
    template_json->>'service_category',
    template_json->>'provider_type',
    template_json->>'business_unit',
    COALESCE((template_json->>'is_critical')::boolean, false),
    COALESCE((template_json->>'contract_value_cad')::numeric, 0),
    COALESCE((template_json->>'handles_sensitive_data')::boolean, false),
    COALESCE((template_json->>'has_system_access')::boolean, false),
    COALESCE((template_json->>'uses_subcontractors')::boolean, false),
    template_json->>'business_justification',
    auth.uid(),
    'draft',
    true
  ) RETURNING id INTO new_request_id;

  RETURN new_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert system templates
INSERT INTO onboarding_request_templates (name, description, is_system_template, template_data)
VALUES
  (
    'IT Services Provider',
    'Template for IT service providers, software vendors, and technology companies',
    true,
    jsonb_build_object(
      'service_category', 'it_services',
      'provider_type', 'service_provider',
      'handles_sensitive_data', true,
      'has_system_access', true,
      'uses_subcontractors', false,
      'description', 'Technology services provider'
    )
  ),
  (
    'Consulting Firm',
    'Template for professional services and consulting firms',
    true,
    jsonb_build_object(
      'service_category', 'professional_services',
      'provider_type', 'consultant',
      'handles_sensitive_data', true,
      'has_system_access', false,
      'uses_subcontractors', false,
      'description', 'Professional consulting services'
    )
  ),
  (
    'Cloud Service Provider',
    'Template for cloud infrastructure and SaaS providers',
    true,
    jsonb_build_object(
      'service_category', 'cloud_services',
      'provider_type', 'service_provider',
      'handles_sensitive_data', true,
      'has_system_access', true,
      'uses_subcontractors', true,
      'is_critical', true,
      'description', 'Cloud infrastructure and services'
    )
  ),
  (
    'Marketing Agency',
    'Template for marketing and advertising agencies',
    true,
    jsonb_build_object(
      'service_category', 'marketing',
      'provider_type', 'service_provider',
      'handles_sensitive_data', false,
      'has_system_access', false,
      'uses_subcontractors', true,
      'description', 'Marketing and advertising services'
    )
  ),
  (
    'Facilities Management',
    'Template for facilities, maintenance, and property management vendors',
    true,
    jsonb_build_object(
      'service_category', 'facilities',
      'provider_type', 'service_provider',
      'handles_sensitive_data', false,
      'has_system_access', false,
      'uses_subcontractors', true,
      'description', 'Facilities management and maintenance'
    )
  ),
  (
    'Financial Services',
    'Template for financial institutions and payment processors',
    true,
    jsonb_build_object(
      'service_category', 'financial_services',
      'provider_type', 'service_provider',
      'handles_sensitive_data', true,
      'has_system_access', true,
      'uses_subcontractors', false,
      'is_critical', true,
      'description', 'Financial services provider'
    )
  );

-- Update trigger for templates
CREATE OR REPLACE FUNCTION update_onboarding_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_onboarding_template_updated_at ON onboarding_request_templates;
CREATE TRIGGER set_onboarding_template_updated_at
  BEFORE UPDATE ON onboarding_request_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_template_updated_at();

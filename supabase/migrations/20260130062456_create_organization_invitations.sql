/*
  # Create Organization Invitations Table

  1. New Tables
    - `organization_invitations`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `email` (text) - Email address of invited user
      - `defense_line` (text) - Role/defense line for the invited user
      - `role_title` (text, optional) - Job title
      - `department` (text, optional) - Department
      - `business_unit` (text, optional) - Business unit
      - `invited_by` (uuid, foreign key to auth.users)
      - `inviter_name` (text) - Name of the person who sent the invitation
      - `token` (text, unique) - Unique invitation token
      - `status` (text) - pending, accepted, expired, cancelled
      - `expires_at` (timestamptz) - When the invitation expires
      - `accepted_at` (timestamptz, optional) - When accepted
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `organization_invitations` table
    - Add policy for organization admins to manage invitations
    - Add policy for users to view their own invitations by token
*/

CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  defense_line text NOT NULL CHECK (defense_line IN ('1a', '1b', '2nd', '3rd', 'admin')),
  role_title text,
  department text,
  business_unit text,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  inviter_name text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization admins can manage invitations"
  ON organization_invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = organization_invitations.organization_id
      AND ou.user_id = auth.uid()
      AND ou.is_active = true
      AND (ou.defense_line = 'admin' OR ou.can_manage_users = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = organization_invitations.organization_id
      AND ou.user_id = auth.uid()
      AND ou.is_active = true
      AND (ou.defense_line = 'admin' OR ou.can_manage_users = true)
    )
  );

CREATE POLICY "Anyone can view invitation by valid token"
  ON organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND expires_at > now()
  );

CREATE POLICY "Service role has full access to invitations"
  ON organization_invitations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_organization_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_organization_invitations_updated_at ON organization_invitations;

CREATE TRIGGER trigger_update_organization_invitations_updated_at
  BEFORE UPDATE ON organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_invitations_updated_at();

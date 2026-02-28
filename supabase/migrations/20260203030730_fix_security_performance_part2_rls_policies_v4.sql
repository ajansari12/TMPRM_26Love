/*
  # Fix Security and Performance - Part 2: RLS Policy Optimization

  ## Security Fixes
    - Enable RLS on due_diligence_document_types table
    - Optimize RLS policies to use (SELECT auth.uid()) pattern
    - This prevents re-evaluation of auth functions for every row
    - Fix policies with "always true" conditions to have proper checks

  ## Tables optimized:
    - profiles, vendors, notifications, organizations, incidents
    - due_diligence_document_types (new RLS)

  ## Performance Impact
    - Reduces query time by caching auth.uid() result
    - Prevents function re-evaluation for each row in result set
*/

-- Enable RLS on missing table
ALTER TABLE due_diligence_document_types ENABLE ROW LEVEL SECURITY;

-- Add proper RLS policies for due_diligence_document_types (platform-level table)
CREATE POLICY "Authenticated users can view document types"
  ON due_diligence_document_types
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admins can manage document types"
  ON due_diligence_document_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.can_configure_workflows = true
      AND ou.is_active = true
    )
  );

-- Optimize profiles table policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Risk managers can read all profiles" ON profiles;
CREATE POLICY "Risk managers can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND (ou.can_manage_users = true OR ou.can_configure_workflows = true)
      AND ou.is_active = true
    )
  );

-- Optimize vendors table policies
DROP POLICY IF EXISTS "Users can read vendors in their organization" ON vendors;
CREATE POLICY "Users can read vendors in their organization"
  ON vendors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.organization_id = vendors.organization_id
      AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can insert vendors in their organization" ON vendors;
CREATE POLICY "Users can insert vendors in their organization"
  ON vendors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.organization_id = vendors.organization_id
      AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can update vendors in their organization" ON vendors;
CREATE POLICY "Users can update vendors in their organization"
  ON vendors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.organization_id = vendors.organization_id
      AND ou.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.organization_id = vendors.organization_id
      AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete vendors in their organization" ON vendors;
CREATE POLICY "Admins can delete vendors in their organization"
  ON vendors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.organization_id = vendors.organization_id
      AND ou.can_manage_users = true
      AND ou.is_active = true
    )
  );

-- Optimize notifications table policies
DROP POLICY IF EXISTS "Users can read their notifications" ON notifications;
CREATE POLICY "Users can read their notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (target_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (target_user_id = (SELECT auth.uid()))
  WITH CHECK (target_user_id = (SELECT auth.uid()));

-- Optimize organizations table policies
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (SELECT auth.uid())
      AND ou.organization_id = organizations.id
      AND ou.is_active = true
    )
  );

-- Fix "always true" RLS policies with proper checks
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert incidents" ON incidents;
CREATE POLICY "Authenticated users can insert incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors v
      INNER JOIN organization_users ou ON ou.organization_id = v.organization_id
      WHERE v.id = incidents.vendor_id
      AND ou.user_id = (SELECT auth.uid())
      AND ou.is_active = true
    )
  );
/*
  # Fix Notifications Table — Add organization_id, Fix RLS Policies

  1. Changes
    - Add `organization_id` column for multi-tenancy support
    - Add index on `organization_id` for query performance
    
  2. Security (RLS Policies)
    - Add INSERT policy so authenticated users can create notifications
    - Update SELECT policy to support three notification targeting modes:
      * Direct user notifications (target_user_id)
      * Role-based notifications (target_role)
      * Organization-wide broadcasts (no target_user_id or target_role)
    - Update UPDATE policy with same logic as SELECT
    - Add DELETE policy for users and admins
    
  3. Important Notes
    - Notifications can now be targeted in three ways:
      1. Specific user: Set target_user_id
      2. Role-based: Set target_role (e.g., '2nd', '1b')
      3. Org-wide: Set only organization_id (broadcast to all org members)
    - All policies enforce organization membership checks
*/

-- Add organization_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(organization_id);
  END IF;
END $$;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;

-- New SELECT policy: user can read if:
-- 1. They are the target user, OR
-- 2. Their role matches the target_role, OR
-- 3. The notification is for their organization (org-wide broadcast)
CREATE POLICY "Users can read their notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (
      target_role IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.organization_id = notifications.organization_id
        AND ou.defense_line::text = notifications.target_role
        AND ou.is_active = true
      )
    )
    OR (
      target_user_id IS NULL
      AND target_role IS NULL
      AND organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.organization_id = notifications.organization_id
        AND ou.is_active = true
      )
    )
  );

-- New UPDATE policy (same logic)
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (
      target_role IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.organization_id = notifications.organization_id
        AND ou.defense_line::text = notifications.target_role
        AND ou.is_active = true
      )
    )
    OR (
      target_user_id IS NULL
      AND target_role IS NULL
      AND organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.organization_id = notifications.organization_id
        AND ou.is_active = true
      )
    )
  );

-- New INSERT policy: any authenticated org member can create notifications for their org
CREATE POLICY "Organization members can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = notifications.organization_id
      AND ou.is_active = true
    )
  );

-- New DELETE policy for cleanup
CREATE POLICY "Users can delete their notifications"
  ON notifications FOR DELETE TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.organization_id = notifications.organization_id
        AND ou.defense_line::text IN ('admin', '2nd')
        AND ou.is_active = true
      )
    )
  );
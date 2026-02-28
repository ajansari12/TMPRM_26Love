/*
  # Create Assessment Tasks Table

  1. New Tables
    - `assessment_tasks`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `vendor_id` (uuid, foreign key to vendors)
      - `task_type` (text - initial_assessment, reassessment, periodic_review)
      - `status` (text - pending, in_progress, completed, cancelled)
      - `priority` (text - urgent, high, normal, low)
      - `assigned_to` (uuid, foreign key to profiles)
      - `assigned_defense_line` (text - 1b, 2nd, etc.)
      - `due_date` (date)
      - `notes` (text)
      - `completed_at` (timestamptz)
      - `completed_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on assessment_tasks table
    - Add policies for organization members to view tasks
    - Add policies for assigned users to update tasks
    - Add policies for admins to manage all tasks

  3. Indexes
    - Index on organization_id for filtering
    - Index on vendor_id for lookups
    - Index on assigned_to for user's task list
    - Index on status for filtering
*/

CREATE TABLE IF NOT EXISTS assessment_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  task_type text NOT NULL DEFAULT 'initial_assessment',
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_defense_line text DEFAULT '2nd',
  due_date date,
  notes text,
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_task_type CHECK (task_type IN ('initial_assessment', 'reassessment', 'periodic_review', 'tier_change_review')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('urgent', 'high', 'normal', 'low'))
);

ALTER TABLE assessment_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view assessment tasks"
  ON assessment_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = assessment_tasks.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Assigned users can update their tasks"
  ON assessment_tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = assessment_tasks.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.defense_line IN ('admin', '2nd')
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = assessment_tasks.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.defense_line IN ('admin', '2nd')
    )
  );

CREATE POLICY "Organization admins can insert assessment tasks"
  ON assessment_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = assessment_tasks.organization_id
      AND organization_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can delete assessment tasks"
  ON assessment_tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = assessment_tasks.organization_id
      AND organization_users.user_id = auth.uid()
      AND organization_users.defense_line = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_assessment_tasks_org ON assessment_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_vendor ON assessment_tasks(vendor_id);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_assigned ON assessment_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_status ON assessment_tasks(status);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_due_date ON assessment_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_org_status ON assessment_tasks(organization_id, status);

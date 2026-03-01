/*
  # Security Fix Part 3: Security Definer Views
*/

CREATE OR REPLACE VIEW public.vendors_without_onboarding
WITH (security_invoker = true)
AS
SELECT
  id,
  vendor_id,
  legal_name,
  organization_id,
  status,
  created_at,
  created_by,
  'Missing onboarding request'::text AS issue
FROM public.vendors v
WHERE onboarding_request_id IS NULL;

CREATE OR REPLACE VIEW public.vendors_missing_assessment
WITH (security_invoker = true)
AS
SELECT
  id,
  vendor_id,
  legal_name,
  organization_id,
  status,
  lifecycle_stage,
  created_at,
  CASE
    WHEN status = 'active' THEN 'Critical: Active without assessment'
    WHEN lifecycle_stage = 'operational' THEN 'High: Operational without assessment'
    ELSE 'Medium: Pending assessment'
  END AS risk_level
FROM public.vendors v
WHERE (
  NOT EXISTS (
    SELECT 1 FROM public.tiering_assessments ta
    WHERE ta.vendor_id = v.id
      AND ta.status = 'completed'
  )
  AND tier IS NULL
);

CREATE OR REPLACE VIEW public.vendors_needing_backfill
WITH (security_invoker = true)
AS
SELECT
  id,
  legal_name,
  organization_id,
  status,
  created_at,
  created_by,
  CASE
    WHEN onboarding_request_id IS NULL THEN 'needs_backfill'
    ELSE 'has_onboarding_request'
  END AS backfill_status
FROM public.vendors v
WHERE onboarding_request_id IS NULL
ORDER BY created_at DESC;

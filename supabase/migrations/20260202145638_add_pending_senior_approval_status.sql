/*
  # Add pending_senior_approval status to onboarding_status enum

  Adds the 'pending_senior_approval' value to support senior management approval workflow.
*/

ALTER TYPE onboarding_status ADD VALUE IF NOT EXISTS 'pending_senior_approval';

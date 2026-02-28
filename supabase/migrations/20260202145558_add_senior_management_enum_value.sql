/*
  # Add Senior Management to Defense Line Enum

  This migration adds the 'senior_management' value to the defense_line enum type.
  This is done as a separate migration because PostgreSQL requires new enum values
  to be committed before they can be used.
*/

-- Add 'senior_management' to defense_line enum
ALTER TYPE defense_line ADD VALUE IF NOT EXISTS 'senior_management';

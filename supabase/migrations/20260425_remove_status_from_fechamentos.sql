-- Migration: Remove status column from fechamentos
-- Data: 2026-04-25

ALTER TABLE fechamentos DROP COLUMN IF EXISTS status;

-- Remove status from constraints, triggers, and defaults if any
-- (No additional constraints found in schema)

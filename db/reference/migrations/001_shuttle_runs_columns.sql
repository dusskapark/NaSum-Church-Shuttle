-- Add run lifecycle tracking columns to shuttle_runs
-- status values: 'scheduled' | 'active' | 'completed'
-- created_mode / ended_mode: 'auto' | 'manual'
-- ended_at, ended_mode, ended_by, created_by are intentionally nullable
ALTER TABLE shuttle_runs
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by   TEXT,
  ADD COLUMN IF NOT EXISTS ended_mode   TEXT,
  ADD COLUMN IF NOT EXISTS ended_by     TEXT;

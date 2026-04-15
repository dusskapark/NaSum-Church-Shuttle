-- Add additional_passengers to scan_events to track group check-ins
ALTER TABLE scan_events
  ADD COLUMN IF NOT EXISTS additional_passengers INTEGER NOT NULL DEFAULT 0;

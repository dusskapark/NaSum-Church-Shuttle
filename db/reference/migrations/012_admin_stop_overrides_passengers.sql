-- Add optional passenger count override to admin_stop_overrides.
-- NULL means "use the natural scan_events count".
ALTER TABLE admin_stop_overrides
  ADD COLUMN IF NOT EXISTS total_passengers_override INT CHECK (total_passengers_override >= 0);

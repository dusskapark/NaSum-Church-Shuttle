-- Add navigation fields and discard support to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS route_code        TEXT,
  ADD COLUMN IF NOT EXISTS user_route_stop_id TEXT;

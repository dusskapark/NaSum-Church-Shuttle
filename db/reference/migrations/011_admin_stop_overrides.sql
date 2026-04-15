-- Admin-controlled stop status overrides for testing.
-- Takes precedence over scan_events when computing stop boarding states.
CREATE TABLE IF NOT EXISTS admin_stop_overrides (
  run_id        TEXT NOT NULL REFERENCES shuttle_runs(id) ON DELETE CASCADE,
  route_stop_id TEXT NOT NULL REFERENCES route_stops(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('arrived', 'waiting')),
  set_by        TEXT,
  set_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, route_stop_id)
);

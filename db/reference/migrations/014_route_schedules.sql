-- Route scheduling & versioning
-- Versioning unit is the entire routes set (schedule), not per-route.
-- route_stops always reflects the published state; sync only updates
-- schedule_routes.stops_snapshot; route_stops is updated only at publish time.

-- Schedule header (one draft allowed at a time)
CREATE TABLE IF NOT EXISTS schedules (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,                   -- "2026-04-04", "2026-04-04-2"
  status       TEXT NOT NULL DEFAULT 'draft',   -- draft | published | archived
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   TEXT,
  published_at TIMESTAMPTZ,
  published_by TEXT
);

-- DB-level guard: only one draft at a time (also defends against race conditions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_single_draft
  ON schedules ((true)) WHERE status = 'draft';

-- Per-route stops snapshot within a schedule
CREATE TABLE IF NOT EXISTS schedule_routes (
  id             TEXT PRIMARY KEY,
  schedule_id    TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  route_id       TEXT NOT NULL REFERENCES routes(id),
  stops_snapshot JSONB NOT NULL DEFAULT '[]',
  sync_status    TEXT NOT NULL DEFAULT 'pending', -- pending | syncing | synced | error
  synced_at      TIMESTAMPTZ,
  sync_error     TEXT,
  UNIQUE (schedule_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_routes_schedule_id ON schedule_routes(schedule_id);

-- Soft-delete column for route_stops so removed stops don't break
-- user_registrations FK references
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_route_stops_active ON route_stops(route_id, active);

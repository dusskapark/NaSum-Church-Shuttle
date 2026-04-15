CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url  TEXT,
  role         TEXT NOT NULL DEFAULT 'rider',
  email        TEXT,
  phone        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_identities (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  provider     TEXT NOT NULL,
  provider_uid TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_uid)
);

CREATE TABLE IF NOT EXISTS routes (
  id                       TEXT PRIMARY KEY,
  route_code               TEXT NOT NULL UNIQUE,
  name                     TEXT,
  display_name             TEXT,
  line                     TEXT NOT NULL,
  service                  TEXT NOT NULL,
  direction                TEXT NOT NULL DEFAULT 'to_church',
  revision                 TEXT NOT NULL DEFAULT '1',
  google_maps_url          TEXT,
  resolved_google_maps_url TEXT,
  sync_status              TEXT NOT NULL DEFAULT 'pending',
  sync_source_hash         TEXT,
  stops_snapshot_hash      TEXT,
  last_synced_at           TIMESTAMPTZ,
  sync_error               TEXT,
  path_json                JSONB,
  path_cache_status        TEXT NOT NULL DEFAULT 'missing',
  path_cache_updated_at    TIMESTAMPTZ,
  path_cache_expires_at    TIMESTAMPTZ,
  path_cache_error         TEXT,
  active                   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS routes_active_idx ON routes(active);
CREATE INDEX IF NOT EXISTS routes_line_service_revision_idx ON routes(line, service, revision);

CREATE TABLE IF NOT EXISTS places (
  id                       TEXT PRIMARY KEY,
  google_place_id          TEXT NOT NULL UNIQUE,
  name                     TEXT NOT NULL,
  display_name             TEXT,
  address                  TEXT,
  formatted_address        TEXT,
  primary_type             TEXT,
  primary_type_display_name TEXT,
  lat                      DOUBLE PRECISION NOT NULL,
  lng                      DOUBLE PRECISION NOT NULL,
  place_types              TEXT[] NOT NULL DEFAULT '{}',
  notes                    TEXT,
  is_terminal              BOOLEAN NOT NULL DEFAULT FALSE,
  stop_id                  TEXT
);

CREATE INDEX IF NOT EXISTS places_google_place_id_idx ON places(google_place_id);
CREATE INDEX IF NOT EXISTS places_lat_lng_idx ON places(lat, lng);
CREATE INDEX IF NOT EXISTS places_is_terminal_idx ON places(is_terminal);
CREATE INDEX IF NOT EXISTS places_stop_id_idx ON places(stop_id);

CREATE TABLE IF NOT EXISTS route_stops (
  id                TEXT PRIMARY KEY,
  route_id          TEXT NOT NULL REFERENCES routes(id),
  place_id          TEXT NOT NULL REFERENCES places(id),
  sequence          INTEGER NOT NULL,
  pickup_time       TEXT,
  notes             TEXT,
  is_pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT route_stops_route_id_sequence_key UNIQUE (route_id, sequence) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (route_id, place_id)
);

CREATE INDEX IF NOT EXISTS route_stops_route_id_sequence_idx ON route_stops(route_id, sequence);
CREATE INDEX IF NOT EXISTS route_stops_place_id_idx ON route_stops(place_id);
CREATE INDEX IF NOT EXISTS route_stops_is_pickup_enabled_idx ON route_stops(is_pickup_enabled);
CREATE INDEX IF NOT EXISTS idx_route_stops_active ON route_stops(route_id, active);

CREATE TABLE IF NOT EXISTS user_registrations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  route_id      TEXT NOT NULL REFERENCES routes(id),
  route_stop_id TEXT NOT NULL REFERENCES route_stops(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'active',
  UNIQUE (user_id, route_id)
);

CREATE TABLE IF NOT EXISTS shuttle_runs (
  id           TEXT PRIMARY KEY,
  route_id     TEXT NOT NULL REFERENCES routes(id),
  service_date TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'scheduled',
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  created_mode TEXT NOT NULL DEFAULT 'manual',
  created_by   TEXT,
  ended_mode   TEXT,
  ended_by     TEXT
);

CREATE TABLE IF NOT EXISTS scan_events (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id),
  run_id                TEXT NOT NULL REFERENCES shuttle_runs(id),
  route_stop_id         TEXT NOT NULL REFERENCES route_stops(id),
  scanned_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result_code           TEXT NOT NULL,
  additional_passengers INTEGER NOT NULL DEFAULT 0,
  idempotency_key       TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS index_scan_events_run_id ON scan_events(run_id);
CREATE INDEX IF NOT EXISTS index_scan_events_user_id ON scan_events(user_id);
CREATE INDEX IF NOT EXISTS index_shuttle_runs_route_id_status ON shuttle_runs(route_id, status);

CREATE TABLE IF NOT EXISTS schedules (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,                   -- "2026-04-04", "2026-04-04-2"
  status       TEXT NOT NULL DEFAULT 'draft',   -- draft | published | archived
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   TEXT,
  published_at TIMESTAMPTZ,
  published_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_single_draft
  ON schedules ((true)) WHERE status = 'draft';

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

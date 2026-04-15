-- Auto-run configuration (singleton row)
-- Controls when shuttle runs are automatically started and ended.
-- days_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday (PostgreSQL DOW convention)

CREATE TABLE IF NOT EXISTS auto_run_config (
  id           TEXT PRIMARY KEY DEFAULT 'singleton',
  enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  days_of_week INTEGER[] NOT NULL DEFAULT '{0}',   -- e.g. {0} = Sundays only
  start_time   TEXT NOT NULL DEFAULT '08:00',      -- HH:MM 24h (KST)
  end_time     TEXT NOT NULL DEFAULT '12:00',      -- HH:MM 24h (KST)
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT
);

-- Ensure the singleton row always exists
INSERT INTO auto_run_config (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

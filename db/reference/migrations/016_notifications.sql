CREATE TABLE IF NOT EXISTS notifications (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  run_id           TEXT NOT NULL REFERENCES shuttle_runs(id),
  trigger_stop_id  TEXT NOT NULL REFERENCES route_stops(id),
  stops_away       INTEGER NOT NULL,
  title_ko         TEXT NOT NULL,
  body_ko          TEXT NOT NULL,
  title_en         TEXT NOT NULL,
  body_en          TEXT NOT NULL,
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, run_id, trigger_stop_id)
);
CREATE INDEX ON notifications(user_id, is_read, created_at DESC);

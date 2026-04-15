-- Enforce at most one active run per route at the database level.
-- Prevents race conditions where two concurrent requests both pass the
-- application-level check and insert duplicate active runs.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  index_shuttle_runs_unique_active_route
  ON shuttle_runs(route_id)
  WHERE status = 'active';

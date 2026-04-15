-- Composite index for active-run lookup by route (existing table requires CONCURRENTLY)
CREATE INDEX CONCURRENTLY IF NOT EXISTS index_shuttle_runs_route_id_status ON shuttle_runs(route_id, status);

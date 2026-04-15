-- Make the (route_id, sequence) uniqueness constraint DEFERRABLE so sequences
-- can be freely reassigned within a transaction without requiring the +10000
-- offset workaround.  The constraint is still enforced — just at COMMIT time
-- rather than per-statement.
ALTER TABLE route_stops DROP CONSTRAINT IF EXISTS route_stops_route_id_sequence_key;
ALTER TABLE route_stops ADD CONSTRAINT route_stops_route_id_sequence_key
  UNIQUE (route_id, sequence) DEFERRABLE INITIALLY DEFERRED;

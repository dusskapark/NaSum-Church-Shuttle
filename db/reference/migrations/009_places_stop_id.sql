-- Add stop_id column to places table
-- stop_id stores the official LTA (Land Transport Authority) bus stop code
-- e.g. '13121', '40121', 'B41121' (some stops have a 'B' prefix)
ALTER TABLE places ADD COLUMN IF NOT EXISTS stop_id TEXT;

CREATE INDEX IF NOT EXISTS places_stop_id_idx ON places(stop_id);

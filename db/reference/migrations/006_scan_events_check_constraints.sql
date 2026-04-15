DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_additional_passengers'
      AND conrelid = 'scan_events'::regclass
  ) THEN
    ALTER TABLE scan_events
      ADD CONSTRAINT chk_additional_passengers
      CHECK (additional_passengers >= 0);
  END IF;
END $$;

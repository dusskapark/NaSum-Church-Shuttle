CREATE TABLE IF NOT EXISTS "notification_push_jobs" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "trigger_stop_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "available_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "locked_at" TIMESTAMPTZ,
  "locked_by" TEXT,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "notification_push_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_push_jobs_type_run_stop_key"
    UNIQUE ("type", "run_id", "trigger_stop_id")
);

CREATE INDEX IF NOT EXISTS "notification_push_jobs_pending_idx"
  ON "notification_push_jobs"("status", "available_at", "created_at");

CREATE INDEX IF NOT EXISTS "notification_push_jobs_run_stop_idx"
  ON "notification_push_jobs"("run_id", "trigger_stop_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_push_jobs_run_id_fkey'
  ) THEN
    ALTER TABLE "notification_push_jobs"
      ADD CONSTRAINT "notification_push_jobs_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "shuttle_runs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_push_jobs_trigger_stop_id_fkey'
  ) THEN
    ALTER TABLE "notification_push_jobs"
      ADD CONSTRAINT "notification_push_jobs_trigger_stop_id_fkey"
      FOREIGN KEY ("trigger_stop_id") REFERENCES "route_stops"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

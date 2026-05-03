CREATE TABLE IF NOT EXISTS "notification_delivery_attempts" (
  "id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "target_hash" TEXT,
  "status" TEXT NOT NULL,
  "status_code" INTEGER,
  "reason" TEXT,
  "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "metadata" JSONB,

  CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_delivery_attempts_notification_id_idx"
  ON "notification_delivery_attempts"("notification_id");

CREATE INDEX IF NOT EXISTS "notification_delivery_attempts_user_id_attempted_at_idx"
  ON "notification_delivery_attempts"("user_id", "attempted_at");

CREATE INDEX IF NOT EXISTS "notification_delivery_attempts_channel_status_idx"
  ON "notification_delivery_attempts"("channel", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_delivery_attempts_notification_id_fkey'
  ) THEN
    ALTER TABLE "notification_delivery_attempts"
      ADD CONSTRAINT "notification_delivery_attempts_notification_id_fkey"
      FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_delivery_attempts_user_id_fkey'
  ) THEN
    ALTER TABLE "notification_delivery_attempts"
      ADD CONSTRAINT "notification_delivery_attempts_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

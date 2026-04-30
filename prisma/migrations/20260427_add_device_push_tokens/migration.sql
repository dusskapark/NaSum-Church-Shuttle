CREATE TABLE IF NOT EXISTS "device_push_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "bundle_id" TEXT NOT NULL,
  "apns_environment" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_push_tokens_token_key"
  ON "device_push_tokens"("token");

CREATE INDEX IF NOT EXISTS "device_push_tokens_user_id_is_active_idx"
  ON "device_push_tokens"("user_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_push_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "device_push_tokens"
      ADD CONSTRAINT "device_push_tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

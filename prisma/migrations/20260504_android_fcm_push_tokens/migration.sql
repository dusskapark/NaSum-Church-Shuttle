ALTER TABLE "device_push_tokens"
  ALTER COLUMN "bundle_id" DROP NOT NULL,
  ALTER COLUMN "apns_environment" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "package_name" TEXT;

UPDATE "device_push_tokens"
SET "platform" = 'ios'
WHERE "platform" IS NULL OR "platform" = '';

CREATE INDEX IF NOT EXISTS "device_push_tokens_platform_is_active_idx"
  ON "device_push_tokens"("platform", "is_active");

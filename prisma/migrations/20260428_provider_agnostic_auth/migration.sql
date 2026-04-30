ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "user_identities"
  ADD COLUMN IF NOT EXISTS "provider_email" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "user_identities_provider_email_idx"
  ON "user_identities"("provider_email");

CREATE TABLE IF NOT EXISTS "password_credentials" (
  "user_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_credentials_email_key"
  ON "password_credentials"("email");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_credentials_user_id_fkey'
  ) THEN
    ALTER TABLE "password_credentials"
      ADD CONSTRAINT "password_credentials_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

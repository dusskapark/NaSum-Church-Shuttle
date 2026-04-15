-- Enforce one active registration per user.
-- First clean up any existing duplicates, keeping the most recently updated one.
UPDATE user_registrations
SET    status = 'inactive', updated_at = NOW()
WHERE  status = 'active'
  AND  id NOT IN (
         SELECT DISTINCT ON (user_id) id
         FROM   user_registrations
         WHERE  status = 'active'
         ORDER  BY user_id, updated_at DESC NULLS LAST
       );

-- Partial unique index: at most one active row per user.
CREATE UNIQUE INDEX IF NOT EXISTS user_registrations_one_active_per_user
  ON user_registrations(user_id)
  WHERE status = 'active';

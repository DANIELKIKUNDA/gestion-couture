ALTER TABLE role_permission_atelier ADD COLUMN IF NOT EXISTS atelier_id TEXT;

UPDATE role_permission_atelier
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

ALTER TABLE role_permission_atelier
ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';

ALTER TABLE role_permission_atelier
ALTER COLUMN atelier_id SET NOT NULL;

ALTER TABLE role_permission_atelier
DROP CONSTRAINT IF EXISTS role_permission_atelier_role_permission_code_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'role_permission_atelier_atelier_role_permission_key'
  ) THEN
    ALTER TABLE role_permission_atelier
      ADD CONSTRAINT role_permission_atelier_atelier_role_permission_key
      UNIQUE (atelier_id, role, permission_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_role_permission_atelier_atelier_id
ON role_permission_atelier (atelier_id);

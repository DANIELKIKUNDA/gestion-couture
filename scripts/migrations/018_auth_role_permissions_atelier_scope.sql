DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'role_permission_atelier'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'role_permission_atelier'
      AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.role_permission_atelier
      ADD COLUMN atelier_id TEXT;
  END IF;
END
$$;

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
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'role_permission_atelier'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_role_permission_atelier_atelier_id'
  ) THEN
    CREATE INDEX idx_role_permission_atelier_atelier_id
      ON public.role_permission_atelier (atelier_id);
  END IF;
END
$$;

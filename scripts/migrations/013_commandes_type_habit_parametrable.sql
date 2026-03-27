DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commandes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commandes_type_habit_valide'
    ) THEN
      ALTER TABLE public.commandes
        ADD CONSTRAINT commandes_type_habit_valide
        CHECK (type_habit IS NULL OR type_habit ~ '^[A-Z0-9_]+$') NOT VALID;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

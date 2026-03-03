DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commandes_type_habit_valide'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_type_habit_valide
      CHECK (type_habit IS NULL OR type_habit ~ '^[A-Z0-9_]+$') NOT VALID;
  END IF;
END $$;

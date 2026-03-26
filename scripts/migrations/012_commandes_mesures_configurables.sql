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
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'commandes'
        AND column_name = 'type_habit'
    ) THEN
      ALTER TABLE public.commandes
        ADD COLUMN type_habit TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'commandes'
        AND column_name = 'mesures_habit_snapshot'
    ) THEN
      ALTER TABLE public.commandes
        ADD COLUMN mesures_habit_snapshot JSONB NULL;
    END IF;
  END IF;
END
$$;

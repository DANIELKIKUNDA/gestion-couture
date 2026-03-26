DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'caisse_bilan'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caisse_bilan'
        AND column_name = 'nombre_jours'
    ) THEN
      ALTER TABLE public.caisse_bilan
        ADD COLUMN nombre_jours INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caisse_bilan'
        AND column_name = 'nombre_operations'
    ) THEN
      ALTER TABLE public.caisse_bilan
        ADD COLUMN nombre_operations INTEGER NOT NULL DEFAULT 0;
    END IF;
  END IF;
END
$$;

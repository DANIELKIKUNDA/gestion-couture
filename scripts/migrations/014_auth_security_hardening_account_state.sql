DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'utilisateurs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'utilisateurs'
        AND column_name = 'compte_verrouille'
    ) THEN
      ALTER TABLE public.utilisateurs
        ADD COLUMN compte_verrouille BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'utilisateurs'
        AND column_name = 'echecs_connexion'
    ) THEN
      ALTER TABLE public.utilisateurs
        ADD COLUMN echecs_connexion INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'utilisateurs'
        AND column_name = 'derniere_connexion'
    ) THEN
      ALTER TABLE public.utilisateurs
        ADD COLUMN derniere_connexion TIMESTAMP NULL;
    END IF;
  END IF;
END
$$;

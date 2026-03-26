-- Migration: Parametres Atelier (policy globale)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'atelier_parametres'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.atelier_parametres (
        id INT PRIMARY KEY,
        payload JSONB NOT NULL,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT
      )
    $sql$;
  END IF;
END
$$;

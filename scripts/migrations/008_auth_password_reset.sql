DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_token'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.password_reset_token (
        id_token TEXT PRIMARY KEY,
        id_utilisateur TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expire_at TIMESTAMP NOT NULL,
        utilise BOOLEAN NOT NULL DEFAULT false,
        date_creation TIMESTAMP NOT NULL DEFAULT NOW()
      )
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_token'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_password_reset_user'
  ) THEN
    CREATE INDEX idx_password_reset_user
      ON public.password_reset_token (id_utilisateur);
  END IF;
END
$$;

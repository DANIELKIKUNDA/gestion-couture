DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fournisseurs'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.fournisseurs (
        id_fournisseur TEXT PRIMARY KEY,
        nom_fournisseur TEXT NOT NULL UNIQUE,
        telephone TEXT NULL,
        actif BOOLEAN NOT NULL DEFAULT true,
        date_creation TIMESTAMP NOT NULL DEFAULT NOW()
      )
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stock_prix_historique'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.stock_prix_historique (
        id_historique TEXT PRIMARY KEY,
        id_article TEXT NOT NULL REFERENCES public.articles(id_article),
        ancien_prix NUMERIC(12,2) NOT NULL,
        nouveau_prix NUMERIC(12,2) NOT NULL,
        date_modification TIMESTAMP NOT NULL DEFAULT NOW(),
        modifie_par TEXT NULL
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
      AND table_name = 'stock_prix_historique'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_prix_hist_article_date'
  ) THEN
    CREATE INDEX idx_prix_hist_article_date
      ON public.stock_prix_historique (id_article, date_modification DESC);
  END IF;
END
$$;

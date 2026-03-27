DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'atelier_parametres'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'atelier_parametres_pkey'
    ) THEN
      ALTER TABLE public.atelier_parametres
        DROP CONSTRAINT atelier_parametres_pkey;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_atelier_parametres_id_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_atelier_parametres_id_unique
        ON public.atelier_parametres (id);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_atelier_parametres_atelier_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_atelier_parametres_atelier_unique
        ON public.atelier_parametres (atelier_id);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_caisse_jour_unique_date'
  ) THEN
    DROP INDEX public.idx_caisse_jour_unique_date;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'caisse_jour'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_caisse_jour_atelier_date_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_caisse_jour_atelier_date_unique
      ON public.caisse_jour (atelier_id, date_jour);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_caisse_bilan_unique'
  ) THEN
    DROP INDEX public.idx_caisse_bilan_unique;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'caisse_bilan'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_caisse_bilan_atelier_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_caisse_bilan_atelier_unique
      ON public.caisse_bilan (atelier_id, type_bilan, date_debut, date_fin);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fournisseurs'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fournisseurs_nom_fournisseur_key'
    ) THEN
      ALTER TABLE public.fournisseurs
        DROP CONSTRAINT fournisseurs_nom_fournisseur_key;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_fournisseurs_atelier_nom_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_fournisseurs_atelier_nom_unique
        ON public.fournisseurs (atelier_id, nom_fournisseur);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_factures_origine_unique'
  ) THEN
    DROP INDEX public.idx_factures_origine_unique;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'factures'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_factures_atelier_origine_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_factures_atelier_origine_unique
      ON public.factures (atelier_id, type_origine, id_origine);
  END IF;
END
$$ LANGUAGE plpgsql;

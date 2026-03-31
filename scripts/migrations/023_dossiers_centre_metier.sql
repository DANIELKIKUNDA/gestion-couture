DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'dossiers'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.dossiers (
        id_dossier TEXT PRIMARY KEY,
        atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
        id_responsable_client TEXT NOT NULL,
        nom_responsable_snapshot TEXT NOT NULL DEFAULT '',
        prenom_responsable_snapshot TEXT NOT NULL DEFAULT '',
        telephone_responsable_snapshot TEXT NOT NULL DEFAULT '',
        type_dossier TEXT NOT NULL DEFAULT 'INDIVIDUEL',
        statut TEXT NOT NULL DEFAULT 'ACTIF',
        notes TEXT NULL,
        cree_par TEXT NULL,
        modifie_par_dernier TEXT NULL,
        date_creation TIMESTAMP NOT NULL DEFAULT NOW(),
        date_derniere_activite TIMESTAMP NOT NULL DEFAULT NOW()
      )
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'dossiers'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'dossiers_type_check'
    ) THEN
      ALTER TABLE public.dossiers
        ADD CONSTRAINT dossiers_type_check
        CHECK (type_dossier IN ('INDIVIDUEL', 'FAMILLE', 'GROUPE'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'dossiers_statut_check'
    ) THEN
      ALTER TABLE public.dossiers
        ADD CONSTRAINT dossiers_statut_check
        CHECK (statut IN ('ACTIF', 'SOLDE', 'CLOTURE'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_dossiers_atelier_activite'
    ) THEN
      CREATE INDEX idx_dossiers_atelier_activite
        ON public.dossiers (atelier_id, date_derniere_activite DESC, date_creation DESC);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_dossiers_atelier_responsable'
    ) THEN
      CREATE INDEX idx_dossiers_atelier_responsable
        ON public.dossiers (atelier_id, id_responsable_client);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_dossiers_atelier_id_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_dossiers_atelier_id_unique
        ON public.dossiers (atelier_id, id_dossier);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'dossiers_atelier_fk'
    ) THEN
      ALTER TABLE public.dossiers
        ADD CONSTRAINT dossiers_atelier_fk
        FOREIGN KEY (atelier_id)
        REFERENCES public.ateliers(id_atelier);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'dossiers_responsable_client_fk'
    ) THEN
      ALTER TABLE public.dossiers
        ADD CONSTRAINT dossiers_responsable_client_fk
        FOREIGN KEY (atelier_id, id_responsable_client)
        REFERENCES public.clients(atelier_id, id_client);
    END IF;
  END IF;

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
        AND column_name = 'id_dossier'
    ) THEN
      ALTER TABLE public.commandes
        ADD COLUMN id_dossier TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commandes_atelier_dossier'
    ) THEN
      CREATE INDEX idx_commandes_atelier_dossier
        ON public.commandes (atelier_id, id_dossier, date_creation DESC);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commandes_dossier_atelier_fk'
    ) THEN
      ALTER TABLE public.commandes
        ADD CONSTRAINT commandes_dossier_atelier_fk
        FOREIGN KEY (atelier_id, id_dossier)
        REFERENCES public.dossiers(atelier_id, id_dossier)
        ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'retouches'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'retouches'
        AND column_name = 'id_dossier'
    ) THEN
      ALTER TABLE public.retouches
        ADD COLUMN id_dossier TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_retouches_atelier_dossier'
    ) THEN
      CREATE INDEX idx_retouches_atelier_dossier
        ON public.retouches (atelier_id, id_dossier, date_depot DESC);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'retouches_dossier_atelier_fk'
    ) THEN
      ALTER TABLE public.retouches
        ADD CONSTRAINT retouches_dossier_atelier_fk
        FOREIGN KEY (atelier_id, id_dossier)
        REFERENCES public.dossiers(atelier_id, id_dossier)
        ON DELETE SET NULL;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

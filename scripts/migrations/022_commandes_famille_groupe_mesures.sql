DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'telephone'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.clients
      ALTER COLUMN telephone DROP NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commande_lignes'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.commande_lignes (
        id_ligne TEXT PRIMARY KEY,
        atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
        id_commande TEXT NOT NULL,
        id_client TEXT NULL,
        role TEXT NOT NULL,
        nom_affiche TEXT NOT NULL DEFAULT '',
        prenom_affiche TEXT NOT NULL DEFAULT '',
        type_habit TEXT NOT NULL,
        mesures_habit_snapshot JSONB NOT NULL,
        ordre_affichage INTEGER NOT NULL DEFAULT 1,
        date_creation TIMESTAMP NOT NULL DEFAULT NOW()
      )
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commande_lignes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commande_lignes_role_check'
    ) THEN
      ALTER TABLE public.commande_lignes
        ADD CONSTRAINT commande_lignes_role_check
        CHECK (role IN ('BENEFICIAIRE', 'PAYEUR_BENEFICIAIRE'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commande_lignes_ordre_check'
    ) THEN
      ALTER TABLE public.commande_lignes
        ADD CONSTRAINT commande_lignes_ordre_check
        CHECK (ordre_affichage >= 1);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commande_lignes_mesures_snapshot_check'
    ) THEN
      ALTER TABLE public.commande_lignes
        ADD CONSTRAINT commande_lignes_mesures_snapshot_check
        CHECK (
          type_habit IS NOT NULL
          AND mesures_habit_snapshot IS NOT NULL
          AND mesures_habit_snapshot->>'unite' = 'cm'
          AND mesures_habit_snapshot->>'typeHabit' = type_habit
          AND jsonb_typeof(mesures_habit_snapshot->'valeurs') = 'object'
        ) NOT VALID;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_lignes_atelier_commande'
    ) THEN
      CREATE INDEX idx_commande_lignes_atelier_commande
        ON public.commande_lignes (atelier_id, id_commande, ordre_affichage);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_lignes_atelier_client'
    ) THEN
      CREATE INDEX idx_commande_lignes_atelier_client
        ON public.commande_lignes (atelier_id, id_client);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_lignes_commande'
    ) THEN
      CREATE INDEX idx_commande_lignes_commande
        ON public.commande_lignes (id_commande);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commande_lignes_atelier_fk'
    ) THEN
      ALTER TABLE public.commande_lignes
        ADD CONSTRAINT commande_lignes_atelier_fk
        FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id_atelier);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commande_lignes_commande_atelier_fk'
    ) THEN
      ALTER TABLE public.commande_lignes
        ADD CONSTRAINT commande_lignes_commande_atelier_fk
        FOREIGN KEY (atelier_id, id_commande)
        REFERENCES public.commandes(atelier_id, id_commande)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commande_lignes_client_atelier_fk'
    ) THEN
      ALTER TABLE public.commande_lignes
        ADD CONSTRAINT commande_lignes_client_atelier_fk
        FOREIGN KEY (atelier_id, id_client)
        REFERENCES public.clients(atelier_id, id_client)
        ON DELETE SET NULL;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

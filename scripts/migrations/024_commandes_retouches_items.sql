DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commande_items'
  ) THEN
    EXECUTE '
      CREATE TABLE public.commande_items (
        id_item TEXT PRIMARY KEY,
        atelier_id TEXT NOT NULL DEFAULT ''ATELIER'',
        id_commande TEXT NOT NULL,
        type_habit TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '''',
        prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
        ordre_affichage INTEGER NOT NULL DEFAULT 1 CHECK (ordre_affichage > 0),
        date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'retouche_items'
  ) THEN
    EXECUTE '
      CREATE TABLE public.retouche_items (
        id_item TEXT PRIMARY KEY,
        atelier_id TEXT NOT NULL DEFAULT ''ATELIER'',
        id_retouche TEXT NOT NULL,
        type_retouche TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '''',
        prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
        ordre_affichage INTEGER NOT NULL DEFAULT 1 CHECK (ordre_affichage > 0),
        date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ';
  END IF;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_commande_items_atelier_commande'
  ) THEN
    EXECUTE 'CREATE INDEX idx_commande_items_atelier_commande ON public.commande_items (atelier_id, id_commande, ordre_affichage)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_retouche_items_atelier_retouche'
  ) THEN
    EXECUTE 'CREATE INDEX idx_retouche_items_atelier_retouche ON public.retouche_items (atelier_id, id_retouche, ordre_affichage)';
  END IF;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_items_atelier_fk'
  ) THEN
    ALTER TABLE public.commande_items
      ADD CONSTRAINT commande_items_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_items_commande_atelier_fk'
  ) THEN
    ALTER TABLE public.commande_items
      ADD CONSTRAINT commande_items_commande_atelier_fk
      FOREIGN KEY (atelier_id, id_commande)
      REFERENCES commandes(atelier_id, id_commande)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_items_atelier_fk'
  ) THEN
    ALTER TABLE public.retouche_items
      ADD CONSTRAINT retouche_items_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_items_retouche_atelier_fk'
  ) THEN
    ALTER TABLE public.retouche_items
      ADD CONSTRAINT retouche_items_retouche_atelier_fk
      FOREIGN KEY (atelier_id, id_retouche)
      REFERENCES retouches(atelier_id, id_retouche)
      ON DELETE CASCADE;
  END IF;
END
$$ LANGUAGE plpgsql;

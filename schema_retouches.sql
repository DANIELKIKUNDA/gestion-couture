-- BC Retouches: complete schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS retouches (
  id_retouche TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_client TEXT NOT NULL,
  id_dossier TEXT NULL,
  description TEXT NOT NULL,
  type_retouche TEXT NOT NULL CHECK (type_retouche ~ '^[A-Z0-9_]+$'),
  date_depot TIMESTAMP NOT NULL,
  date_prevue TIMESTAMP NULL,
  montant_total NUMERIC(12,2) NOT NULL CHECK (montant_total >= 0),
  montant_paye NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant_paye >= 0),
  type_habit TEXT NULL,
  mesures_habit_snapshot JSONB NULL,
  statut TEXT NOT NULL CHECK (statut IN ('DEPOSEE','EN_COURS','TERMINEE','LIVREE','ANNULEE')),
  depose_par TEXT NULL,
  modifie_par_dernier TEXT NULL,
  date_derniere_modification TIMESTAMP NULL
);

ALTER TABLE retouches ADD COLUMN IF NOT EXISTS type_habit TEXT NULL;
ALTER TABLE retouches ADD COLUMN IF NOT EXISTS mesures_habit_snapshot JSONB NULL;
ALTER TABLE retouches ADD COLUMN IF NOT EXISTS atelier_id TEXT;
UPDATE retouches SET atelier_id = 'ATELIER' WHERE atelier_id IS NULL OR BTRIM(atelier_id) = '';
ALTER TABLE retouches ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE retouches ALTER COLUMN atelier_id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE retouches DROP CONSTRAINT IF EXISTS retouches_type_habit_valide;
  ALTER TABLE retouches
    ADD CONSTRAINT retouches_type_habit_valide
    CHECK (
      type_habit IS NULL OR type_habit ~ '^[A-Z0-9_]+$'
    ) NOT VALID;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouches_mesures_snapshot_coherent'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_mesures_snapshot_coherent
      CHECK (
        (type_habit IS NULL AND mesures_habit_snapshot IS NULL)
        OR
        (
          type_habit IS NOT NULL
          AND mesures_habit_snapshot IS NOT NULL
          AND mesures_habit_snapshot->>'unite' = 'cm'
          AND mesures_habit_snapshot->>'typeHabit' = type_habit
          AND jsonb_typeof(mesures_habit_snapshot->'valeurs') = 'object'
        )
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retouches_paiement_coherent'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_paiement_coherent CHECK (montant_paye <= montant_total);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_retouches_atelier_id ON retouches (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_retouches_atelier_id_retouche_unique ON retouches (atelier_id, id_retouche);
CREATE INDEX IF NOT EXISTS idx_retouches_client ON retouches (id_client);
CREATE INDEX IF NOT EXISTS idx_retouches_atelier_client ON retouches (atelier_id, id_client);
CREATE INDEX IF NOT EXISTS idx_retouches_atelier_dossier ON retouches (atelier_id, id_dossier);
CREATE INDEX IF NOT EXISTS idx_retouches_statut ON retouches (statut);
CREATE INDEX IF NOT EXISTS idx_retouches_date_prevue ON retouches (date_prevue);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouches_atelier_fk'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouches_dossier_atelier_fk'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_dossier_atelier_fk
      FOREIGN KEY (atelier_id, id_dossier)
      REFERENCES dossiers(atelier_id, id_dossier)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouches_client_atelier_fk'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_client_atelier_fk
      FOREIGN KEY (atelier_id, id_client)
      REFERENCES clients(atelier_id, id_client);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION retouches_validate_statut_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  IF OLD.statut = 'DEPOSEE' AND NEW.statut IN ('EN_COURS', 'ANNULEE') THEN
    RETURN NEW;
  END IF;
  IF OLD.statut = 'EN_COURS' AND NEW.statut IN ('TERMINEE', 'ANNULEE') THEN
    RETURN NEW;
  END IF;
  IF OLD.statut = 'TERMINEE' AND NEW.statut = 'LIVREE' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transition de statut retouche invalide: % -> %', OLD.statut, NEW.statut
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_retouches_validate_transition ON retouches;
CREATE TRIGGER trg_retouches_validate_transition
BEFORE UPDATE OF statut ON retouches
FOR EACH ROW
EXECUTE FUNCTION retouches_validate_statut_transition();

CREATE TABLE IF NOT EXISTS retouche_events (
  id_event TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_retouche TEXT NOT NULL REFERENCES retouches(id_retouche),
  type_event TEXT NOT NULL,
  payload JSONB NOT NULL,
  date_event TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE retouche_events ADD COLUMN IF NOT EXISTS atelier_id TEXT;
UPDATE retouche_events SET atelier_id = 'ATELIER' WHERE atelier_id IS NULL OR BTRIM(atelier_id) = '';
ALTER TABLE retouche_events ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE retouche_events ALTER COLUMN atelier_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_retouche_events_atelier_id ON retouche_events (atelier_id);
CREATE INDEX IF NOT EXISTS idx_retouche_events_retouche ON retouche_events (id_retouche);
CREATE INDEX IF NOT EXISTS idx_retouche_events_atelier_retouche ON retouche_events (atelier_id, id_retouche);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_events_atelier_fk'
  ) THEN
    ALTER TABLE retouche_events
      ADD CONSTRAINT retouche_events_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS retouche_items (
  id_item TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_retouche TEXT NOT NULL,
  type_retouche TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
  ordre_affichage INTEGER NOT NULL DEFAULT 1 CHECK (ordre_affichage > 0),
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE retouche_items ADD COLUMN IF NOT EXISTS atelier_id TEXT;
UPDATE retouche_items SET atelier_id = 'ATELIER' WHERE atelier_id IS NULL OR BTRIM(atelier_id) = '';
ALTER TABLE retouche_items ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE retouche_items ALTER COLUMN atelier_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_retouche_items_atelier_retouche
ON retouche_items (atelier_id, id_retouche, ordre_affichage);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_items_atelier_fk'
  ) THEN
    ALTER TABLE retouche_items
      ADD CONSTRAINT retouche_items_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_items_retouche_atelier_fk'
  ) THEN
    ALTER TABLE retouche_items
      ADD CONSTRAINT retouche_items_retouche_atelier_fk
      FOREIGN KEY (atelier_id, id_retouche)
      REFERENCES retouches(atelier_id, id_retouche)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_events_retouche_atelier_fk'
  ) THEN
    ALTER TABLE retouche_events
      ADD CONSTRAINT retouche_events_retouche_atelier_fk
      FOREIGN KEY (atelier_id, id_retouche)
      REFERENCES retouches(atelier_id, id_retouche)
      ON DELETE CASCADE;
  END IF;
END $$;

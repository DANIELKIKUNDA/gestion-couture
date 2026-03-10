-- BC Commandes: complete schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS commandes (
  id_commande TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_client TEXT NOT NULL,
  id_serie_mesures TEXT NULL,
  description TEXT NOT NULL,
  date_creation TIMESTAMP NOT NULL,
  date_prevue TIMESTAMP NULL,
  montant_total NUMERIC(12,2) NOT NULL CHECK (montant_total >= 0),
  montant_paye NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant_paye >= 0),
  type_habit TEXT NULL,
  mesures_habit_snapshot JSONB NULL,
  statut TEXT NOT NULL CHECK (statut IN ('CREEE','EN_COURS','TERMINEE','LIVREE','ANNULEE')),
  cree_par TEXT NULL,
  modifie_par_dernier TEXT NULL,
  date_derniere_modification TIMESTAMP NULL
);

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS type_habit TEXT NULL;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS mesures_habit_snapshot JSONB NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'commandes_statut_check'
      AND conrelid = 'commandes'::regclass
  ) THEN
    ALTER TABLE commandes DROP CONSTRAINT commandes_statut_check;
  END IF;
  ALTER TABLE commandes
    ADD CONSTRAINT commandes_statut_check
    CHECK (statut IN ('CREEE','EN_COURS','TERMINEE','LIVREE','ANNULEE'));
END $$;

DO $$
BEGIN
  ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_type_habit_valide;
  ALTER TABLE commandes
    ADD CONSTRAINT commandes_type_habit_valide
    CHECK (
      type_habit IS NULL OR type_habit ~ '^[A-Z0-9_]+$'
    ) NOT VALID;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commandes_mesures_snapshot_coherent'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_mesures_snapshot_coherent
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

-- Invariants enforced at DB level where possible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'commandes_paiement_coherent'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_paiement_coherent CHECK (montant_paye <= montant_total);
  END IF;
END $$;

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_commandes_atelier_id ON commandes (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commandes_atelier_id_commande_unique ON commandes (atelier_id, id_commande);
CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes (id_client);
CREATE INDEX IF NOT EXISTS idx_commandes_atelier_client ON commandes (atelier_id, id_client);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes (statut);
CREATE INDEX IF NOT EXISTS idx_commandes_date_prevue ON commandes (date_prevue);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commandes_atelier_fk'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commandes_client_atelier_fk'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_client_atelier_fk
      FOREIGN KEY (atelier_id, id_client)
      REFERENCES clients(atelier_id, id_client);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION commandes_validate_statut_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  IF OLD.statut = 'CREEE' AND NEW.statut IN ('EN_COURS', 'ANNULEE') THEN
    RETURN NEW;
  END IF;
  IF OLD.statut = 'EN_COURS' AND NEW.statut IN ('TERMINEE', 'ANNULEE') THEN
    RETURN NEW;
  END IF;
  IF OLD.statut = 'TERMINEE' AND NEW.statut = 'LIVREE' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transition de statut commande invalide: % -> %', OLD.statut, NEW.statut
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_commandes_validate_transition ON commandes;
CREATE TRIGGER trg_commandes_validate_transition
BEFORE UPDATE OF statut ON commandes
FOR EACH ROW
EXECUTE FUNCTION commandes_validate_statut_transition();

-- Optional: table for commande events (audit trail)
CREATE TABLE IF NOT EXISTS commande_events (
  id_event TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_commande TEXT NOT NULL REFERENCES commandes(id_commande),
  type_event TEXT NOT NULL,
  payload JSONB NOT NULL,
  date_event TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commande_events_atelier_id ON commande_events (atelier_id);
CREATE INDEX IF NOT EXISTS idx_commande_events_commande ON commande_events (id_commande);
CREATE INDEX IF NOT EXISTS idx_commande_events_atelier_commande ON commande_events (atelier_id, id_commande);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_events_atelier_fk'
  ) THEN
    ALTER TABLE commande_events
      ADD CONSTRAINT commande_events_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_events_commande_atelier_fk'
  ) THEN
    ALTER TABLE commande_events
      ADD CONSTRAINT commande_events_commande_atelier_fk
      FOREIGN KEY (atelier_id, id_commande)
      REFERENCES commandes(atelier_id, id_commande)
      ON DELETE CASCADE;
  END IF;
END $$;

-- BC Retouches: complete schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS retouches (
  id_retouche TEXT PRIMARY KEY,
  id_client TEXT NOT NULL,
  description TEXT NOT NULL,
  type_retouche TEXT NOT NULL CHECK (type_retouche IN ('OURLET','RESSERRAGE','AGRANDISSEMENT','REPARATION','FERMETURE','AUTRE')),
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouches_type_habit_valide'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_type_habit_valide
      CHECK (
        type_habit IS NULL OR type_habit IN (
          'PANTALON','CHEMISE','CHEMISIER','VESTE','GILET','JACKET',
          'BOUBOU','ROBE','JUPE','VESTE_FEMME','LIBAYA','ENSEMBLE'
        )
      );
  END IF;
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
          AND (mesures_habit_snapshot->'valeurs') <> '{}'::jsonb
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

CREATE INDEX IF NOT EXISTS idx_retouches_client ON retouches (id_client);
CREATE INDEX IF NOT EXISTS idx_retouches_statut ON retouches (statut);
CREATE INDEX IF NOT EXISTS idx_retouches_date_prevue ON retouches (date_prevue);

CREATE TABLE IF NOT EXISTS retouche_events (
  id_event TEXT PRIMARY KEY,
  id_retouche TEXT NOT NULL REFERENCES retouches(id_retouche),
  type_event TEXT NOT NULL,
  payload JSONB NOT NULL,
  date_event TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retouche_events_retouche ON retouche_events (id_retouche);

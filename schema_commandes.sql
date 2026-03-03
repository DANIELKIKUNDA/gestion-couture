-- BC Commandes: complete schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS commandes (
  id_commande TEXT PRIMARY KEY,
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commandes_type_habit_valide'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_type_habit_valide
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
          AND (mesures_habit_snapshot->'valeurs') <> '{}'::jsonb
          AND (
            CASE type_habit
              WHEN 'PANTALON' THEN (mesures_habit_snapshot->'valeurs' ? 'longueur')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'tourTaille')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'tourHanche')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'largeurBas')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'hauteurFourche')
              WHEN 'CHEMISE' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                  AND (mesures_habit_snapshot->'valeurs' ? 'longueurChemise')
                                  AND (mesures_habit_snapshot->'valeurs' ? 'typeManches')
                                  AND (mesures_habit_snapshot->'valeurs' ? 'poignet')
                                  AND (mesures_habit_snapshot->'valeurs' ? 'carrure')
              WHEN 'CHEMISIER' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                    AND (mesures_habit_snapshot->'valeurs' ? 'longueurChemise')
                                    AND (mesures_habit_snapshot->'valeurs' ? 'typeManches')
                                    AND (mesures_habit_snapshot->'valeurs' ? 'poignet')
                                    AND (mesures_habit_snapshot->'valeurs' ? 'carrure')
              WHEN 'VESTE' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                                AND (mesures_habit_snapshot->'valeurs' ? 'longueurVeste')
                                AND (mesures_habit_snapshot->'valeurs' ? 'longueurManches')
                                AND (mesures_habit_snapshot->'valeurs' ? 'carrure')
                                AND (mesures_habit_snapshot->'valeurs' ? 'poignet')
              WHEN 'GILET' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                                AND (mesures_habit_snapshot->'valeurs' ? 'longueurVeste')
                                AND (mesures_habit_snapshot->'valeurs' ? 'longueurManches')
                                AND (mesures_habit_snapshot->'valeurs' ? 'carrure')
                                AND (mesures_habit_snapshot->'valeurs' ? 'poignet')
              WHEN 'JACKET' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'longueurVeste')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'longueurManches')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'carrure')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'poignet')
              WHEN 'ROBE' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                               AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                               AND (mesures_habit_snapshot->'valeurs' ? 'hanche')
                               AND (mesures_habit_snapshot->'valeurs' ? 'longueur')
              WHEN 'JUPE' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                               AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                               AND (mesures_habit_snapshot->'valeurs' ? 'hanche')
                               AND (mesures_habit_snapshot->'valeurs' ? 'longueur')
              WHEN 'LIBAYA' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'hanche')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'longueur')
              WHEN 'BOUBOU' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'longueur')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'largeur')
                                 AND (mesures_habit_snapshot->'valeurs' ? 'ouvertureManches')
              WHEN 'VESTE_FEMME' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                      AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                                      AND (mesures_habit_snapshot->'valeurs' ? 'longueurVeste')
                                      AND (mesures_habit_snapshot->'valeurs' ? 'longueurManches')
                                      AND (mesures_habit_snapshot->'valeurs' ? 'carrure')
                                      AND (mesures_habit_snapshot->'valeurs' ? 'poignet')
              WHEN 'ENSEMBLE' THEN (mesures_habit_snapshot->'valeurs' ? 'poitrine')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'taille')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'hanche')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'longueur')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'tourTaille')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'tourHanche')
                                   AND (mesures_habit_snapshot->'valeurs' ? 'largeurBas')
              ELSE FALSE
            END
          )
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
CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes (id_client);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes (statut);
CREATE INDEX IF NOT EXISTS idx_commandes_date_prevue ON commandes (date_prevue);

-- Optional: table for commande events (audit trail)
CREATE TABLE IF NOT EXISTS commande_events (
  id_event TEXT PRIMARY KEY,
  id_commande TEXT NOT NULL REFERENCES commandes(id_commande),
  type_event TEXT NOT NULL,
  payload JSONB NOT NULL,
  date_event TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commande_events_commande ON commande_events (id_commande);

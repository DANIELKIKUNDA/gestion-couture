-- Rattrapage guide des mesures legacy (commandes / retouches)
-- Objectif:
-- 1) Construire une file de travail des dossiers sans mesures.
-- 2) Fournir une fonction unique pour appliquer les mesures dossier par dossier.
-- 3) Garder une trace d'audit de progression.

CREATE TABLE IF NOT EXISTS mesures_rattrapage (
  id_rattrapage BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('COMMANDE', 'RETOUCHE')),
  source_id TEXT NOT NULL,
  id_client TEXT NULL,
  description_source TEXT NULL,
  type_habit_suggere TEXT NULL,
  statut TEXT NOT NULL DEFAULT 'A_TRAITER' CHECK (statut IN ('A_TRAITER', 'TRAITE', 'ERREUR')),
  payload_mesures JSONB NULL,
  erreur_dernier_traitement TEXT NULL,
  cree_le TIMESTAMP NOT NULL DEFAULT NOW(),
  mis_a_jour_le TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_mesures_rattrapage_statut ON mesures_rattrapage (statut);

-- Alimente la file depuis les commandes/retouches neutralisees.
INSERT INTO mesures_rattrapage (source_type, source_id, id_client, description_source, type_habit_suggere)
SELECT 'COMMANDE', c.id_commande, c.id_client, c.description, NULL
FROM commandes c
WHERE c.type_habit IS NULL
  AND c.mesures_habit_snapshot IS NULL
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO mesures_rattrapage (source_type, source_id, id_client, description_source, type_habit_suggere)
SELECT 'RETOUCHE', r.id_retouche, r.id_client, r.description, NULL
FROM retouches r
WHERE r.type_habit IS NULL
  AND r.mesures_habit_snapshot IS NULL
ON CONFLICT (source_type, source_id) DO NOTHING;

CREATE OR REPLACE VIEW v_mesures_rattrapage_a_traiter AS
SELECT
  id_rattrapage,
  source_type,
  source_id,
  id_client,
  description_source,
  type_habit_suggere,
  statut,
  erreur_dernier_traitement,
  cree_le,
  mis_a_jour_le
FROM mesures_rattrapage
WHERE statut = 'A_TRAITER'
ORDER BY cree_le ASC, id_rattrapage ASC;

-- Applique les mesures sur un dossier cible et trace le resultat.
CREATE OR REPLACE FUNCTION appliquer_rattrapage_mesures(
  p_source_type TEXT,
  p_source_id TEXT,
  p_type_habit TEXT,
  p_valeurs JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF p_source_type NOT IN ('COMMANDE', 'RETOUCHE') THEN
    RAISE EXCEPTION 'source_type invalide: %', p_source_type;
  END IF;

  IF p_type_habit IS NULL OR LENGTH(TRIM(p_type_habit)) = 0 THEN
    RAISE EXCEPTION 'type_habit requis';
  END IF;

  IF p_valeurs IS NULL OR jsonb_typeof(p_valeurs) <> 'object' OR p_valeurs = '{}'::jsonb THEN
    RAISE EXCEPTION 'valeurs mesures invalides';
  END IF;

  v_snapshot := jsonb_build_object(
    'typeHabit', UPPER(TRIM(p_type_habit)),
    'unite', 'cm',
    'valeurs', p_valeurs,
    'mode', 'ESTIMATION_RATTRAPAGE',
    'provenance', 'SCRIPT_RATTRAPAGE',
    'dateRattrapage', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  IF p_source_type = 'COMMANDE' THEN
    UPDATE commandes
    SET
      type_habit = UPPER(TRIM(p_type_habit)),
      mesures_habit_snapshot = v_snapshot
    WHERE id_commande = p_source_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'commande introuvable: %', p_source_id;
    END IF;
  ELSE
    UPDATE retouches
    SET
      type_habit = UPPER(TRIM(p_type_habit)),
      mesures_habit_snapshot = v_snapshot
    WHERE id_retouche = p_source_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'retouche introuvable: %', p_source_id;
    END IF;
  END IF;

  UPDATE mesures_rattrapage
  SET
    statut = 'TRAITE',
    payload_mesures = v_snapshot,
    erreur_dernier_traitement = NULL,
    mis_a_jour_le = NOW()
  WHERE source_type = p_source_type
    AND source_id = p_source_id;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE mesures_rattrapage
    SET
      statut = 'ERREUR',
      erreur_dernier_traitement = SQLERRM,
      mis_a_jour_le = NOW()
    WHERE source_type = p_source_type
      AND source_id = p_source_id;
    RAISE;
END;
$$;

-- Exemple d'usage:
-- SELECT appliquer_rattrapage_mesures(
--   'COMMANDE',
--   'CMD-123',
--   'PANTALON',
--   '{"longueur":105,"tourTaille":82,"tourHanche":96,"largeurBas":21,"hauteurFourche":31}'::jsonb
-- );

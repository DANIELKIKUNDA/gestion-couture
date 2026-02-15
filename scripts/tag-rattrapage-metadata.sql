-- Backfill metadata for already processed rattrapage snapshots.
-- Adds:
--   mode = ESTIMATION_RATTRAPAGE
--   provenance = SCRIPT_RATTRAPAGE
--   dateRattrapage = mesures_rattrapage.mis_a_jour_le

UPDATE commandes c
SET mesures_habit_snapshot =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(c.mesures_habit_snapshot, '{}'::jsonb),
        '{mode}', to_jsonb('ESTIMATION_RATTRAPAGE'::text), true
      ),
      '{provenance}', to_jsonb('SCRIPT_RATTRAPAGE'::text), true
    ),
    '{dateRattrapage}', to_jsonb(to_char(m.mis_a_jour_le, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true
  )
FROM mesures_rattrapage m
WHERE m.source_type = 'COMMANDE'
  AND m.statut = 'TRAITE'
  AND m.source_id = c.id_commande;

UPDATE retouches r
SET mesures_habit_snapshot =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(r.mesures_habit_snapshot, '{}'::jsonb),
        '{mode}', to_jsonb('ESTIMATION_RATTRAPAGE'::text), true
      ),
      '{provenance}', to_jsonb('SCRIPT_RATTRAPAGE'::text), true
    ),
    '{dateRattrapage}', to_jsonb(to_char(m.mis_a_jour_le, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true
  )
FROM mesures_rattrapage m
WHERE m.source_type = 'RETOUCHE'
  AND m.statut = 'TRAITE'
  AND m.source_id = r.id_retouche;

-- Keep payload_mesures aligned with persisted snapshots.
UPDATE mesures_rattrapage m
SET payload_mesures = c.mesures_habit_snapshot
FROM commandes c
WHERE m.source_type = 'COMMANDE'
  AND m.source_id = c.id_commande;

UPDATE mesures_rattrapage m
SET payload_mesures = r.mesures_habit_snapshot
FROM retouches r
WHERE m.source_type = 'RETOUCHE'
  AND m.source_id = r.id_retouche;

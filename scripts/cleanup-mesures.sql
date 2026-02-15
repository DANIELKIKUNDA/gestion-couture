-- Cleanup legacy mesure snapshots so constraints can be validated safely.

-- Normalize type_habit casing
UPDATE commandes
SET type_habit = UPPER(TRIM(type_habit))
WHERE type_habit IS NOT NULL
  AND type_habit <> UPPER(TRIM(type_habit));

UPDATE retouches
SET type_habit = UPPER(TRIM(type_habit))
WHERE type_habit IS NOT NULL
  AND type_habit <> UPPER(TRIM(type_habit));

-- Nullify impossible/legacy rows for commandes
UPDATE commandes
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE
  type_habit IS NULL
  OR mesures_habit_snapshot IS NULL
  OR type_habit NOT IN (
    'PANTALON','CHEMISE','CHEMISIER','VESTE','GILET','JACKET',
    'BOUBOU','ROBE','JUPE','VESTE_FEMME','LIBAYA','ENSEMBLE'
  )
  OR jsonb_typeof(mesures_habit_snapshot) <> 'object'
  OR jsonb_typeof(mesures_habit_snapshot->'valeurs') <> 'object'
  OR (mesures_habit_snapshot->'valeurs') = '{}'::jsonb;

-- Fix metadata keys for remaining commande rows
UPDATE commandes
SET mesures_habit_snapshot =
  jsonb_set(
    jsonb_set(mesures_habit_snapshot, '{unite}', to_jsonb('cm'::text), true),
    '{typeHabit}', to_jsonb(type_habit), true
  )
WHERE type_habit IS NOT NULL
  AND mesures_habit_snapshot IS NOT NULL;

-- Enforce required fields by type for commandes
UPDATE commandes
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE type_habit = 'PANTALON'
  AND NOT (
    mesures_habit_snapshot->'valeurs' ? 'longueur'
    AND mesures_habit_snapshot->'valeurs' ? 'tourTaille'
    AND mesures_habit_snapshot->'valeurs' ? 'tourHanche'
    AND mesures_habit_snapshot->'valeurs' ? 'largeurBas'
    AND mesures_habit_snapshot->'valeurs' ? 'hauteurFourche'
  );

UPDATE commandes
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE type_habit IN ('CHEMISE','CHEMISIER')
  AND NOT (
    mesures_habit_snapshot->'valeurs' ? 'poitrine'
    AND mesures_habit_snapshot->'valeurs' ? 'longueurChemise'
    AND mesures_habit_snapshot->'valeurs' ? 'typeManches'
    AND mesures_habit_snapshot->'valeurs' ? 'poignet'
    AND mesures_habit_snapshot->'valeurs' ? 'carrure'
  );

UPDATE commandes
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE type_habit IN ('VESTE','GILET','JACKET','VESTE_FEMME')
  AND NOT (
    mesures_habit_snapshot->'valeurs' ? 'poitrine'
    AND mesures_habit_snapshot->'valeurs' ? 'taille'
    AND mesures_habit_snapshot->'valeurs' ? 'longueurVeste'
    AND mesures_habit_snapshot->'valeurs' ? 'longueurManches'
    AND mesures_habit_snapshot->'valeurs' ? 'carrure'
    AND mesures_habit_snapshot->'valeurs' ? 'poignet'
  );

UPDATE commandes
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE type_habit IN ('ROBE','JUPE','LIBAYA')
  AND NOT (
    mesures_habit_snapshot->'valeurs' ? 'poitrine'
    AND mesures_habit_snapshot->'valeurs' ? 'taille'
    AND mesures_habit_snapshot->'valeurs' ? 'hanche'
    AND mesures_habit_snapshot->'valeurs' ? 'longueur'
  );

UPDATE commandes
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE type_habit = 'BOUBOU'
  AND NOT (
    mesures_habit_snapshot->'valeurs' ? 'poitrine'
    AND mesures_habit_snapshot->'valeurs' ? 'longueur'
    AND mesures_habit_snapshot->'valeurs' ? 'largeur'
    AND mesures_habit_snapshot->'valeurs' ? 'ouvertureManches'
  );

UPDATE commandes
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE type_habit = 'ENSEMBLE'
  AND NOT (
    mesures_habit_snapshot->'valeurs' ? 'poitrine'
    AND mesures_habit_snapshot->'valeurs' ? 'taille'
    AND mesures_habit_snapshot->'valeurs' ? 'hanche'
    AND mesures_habit_snapshot->'valeurs' ? 'longueur'
    AND mesures_habit_snapshot->'valeurs' ? 'tourTaille'
    AND mesures_habit_snapshot->'valeurs' ? 'tourHanche'
    AND mesures_habit_snapshot->'valeurs' ? 'largeurBas'
  );

-- Nullify impossible/legacy rows for retouches
UPDATE retouches
SET type_habit = NULL,
    mesures_habit_snapshot = NULL
WHERE
  type_habit IS NULL
  OR mesures_habit_snapshot IS NULL
  OR type_habit NOT IN (
    'PANTALON','CHEMISE','CHEMISIER','VESTE','GILET','JACKET',
    'BOUBOU','ROBE','JUPE','VESTE_FEMME','LIBAYA','ENSEMBLE'
  )
  OR jsonb_typeof(mesures_habit_snapshot) <> 'object'
  OR jsonb_typeof(mesures_habit_snapshot->'valeurs') <> 'object'
  OR (mesures_habit_snapshot->'valeurs') = '{}'::jsonb;

-- Fix metadata keys for remaining retouche rows
UPDATE retouches
SET mesures_habit_snapshot =
  jsonb_set(
    jsonb_set(mesures_habit_snapshot, '{unite}', to_jsonb('cm'::text), true),
    '{typeHabit}', to_jsonb(type_habit), true
  )
WHERE type_habit IS NOT NULL
  AND mesures_habit_snapshot IS NOT NULL;

-- Validate constraints now that legacy rows are cleaned
ALTER TABLE commandes VALIDATE CONSTRAINT commandes_type_habit_valide;
ALTER TABLE commandes VALIDATE CONSTRAINT commandes_mesures_snapshot_coherent;
ALTER TABLE retouches VALIDATE CONSTRAINT retouches_type_habit_valide;
ALTER TABLE retouches VALIDATE CONSTRAINT retouches_mesures_snapshot_coherent;

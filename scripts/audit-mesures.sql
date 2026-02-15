-- Audit trail: legacy rows with mesures neutralized during cleanup
-- A row is considered neutralized when type_habit and mesures_habit_snapshot are both NULL.

\echo === Audit Mesures Neutralisees ===

\echo
\echo [1] Compteurs globaux
SELECT
  (SELECT COUNT(*) FROM commandes) AS commandes_total,
  (SELECT COUNT(*) FROM commandes WHERE type_habit IS NULL AND mesures_habit_snapshot IS NULL) AS commandes_neutralisees,
  (SELECT COUNT(*) FROM retouches) AS retouches_total,
  (SELECT COUNT(*) FROM retouches WHERE type_habit IS NULL AND mesures_habit_snapshot IS NULL) AS retouches_neutralisees;

\echo
\echo [2] Details Commandes neutralisees
SELECT
  id_commande,
  id_client,
  description,
  date_creation,
  date_prevue,
  montant_total,
  montant_paye,
  statut
FROM commandes
WHERE type_habit IS NULL
  AND mesures_habit_snapshot IS NULL
ORDER BY date_creation DESC;

\echo
\echo [3] Details Retouches neutralisees
SELECT
  id_retouche,
  id_client,
  description,
  type_retouche,
  date_depot,
  date_prevue,
  montant_total,
  montant_paye,
  statut
FROM retouches
WHERE type_habit IS NULL
  AND mesures_habit_snapshot IS NULL
ORDER BY date_depot DESC;

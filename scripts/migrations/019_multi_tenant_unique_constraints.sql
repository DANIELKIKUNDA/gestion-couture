ALTER TABLE atelier_parametres
DROP CONSTRAINT IF EXISTS atelier_parametres_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_atelier_parametres_id_unique
ON atelier_parametres (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atelier_parametres_atelier_unique
ON atelier_parametres (atelier_id);

DROP INDEX IF EXISTS idx_caisse_jour_unique_date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_jour_atelier_date_unique
ON caisse_jour (atelier_id, date_jour);

DROP INDEX IF EXISTS idx_caisse_bilan_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_bilan_atelier_unique
ON caisse_bilan (atelier_id, type_bilan, date_debut, date_fin);

ALTER TABLE fournisseurs
DROP CONSTRAINT IF EXISTS fournisseurs_nom_fournisseur_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fournisseurs_atelier_nom_unique
ON fournisseurs (atelier_id, nom_fournisseur);

DROP INDEX IF EXISTS idx_factures_origine_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_factures_atelier_origine_unique
ON factures (atelier_id, type_origine, id_origine);

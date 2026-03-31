CREATE TABLE IF NOT EXISTS dossiers (
  id_dossier TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_responsable_client TEXT NOT NULL,
  nom_responsable_snapshot TEXT NOT NULL DEFAULT '',
  prenom_responsable_snapshot TEXT NOT NULL DEFAULT '',
  telephone_responsable_snapshot TEXT NOT NULL DEFAULT '',
  type_dossier TEXT NOT NULL DEFAULT 'INDIVIDUEL',
  statut TEXT NOT NULL DEFAULT 'ACTIF' CHECK (statut IN ('ACTIF', 'SOLDE', 'CLOTURE')),
  notes TEXT NULL,
  cree_par TEXT NULL,
  modifie_par_dernier TEXT NULL,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW(),
  date_derniere_activite TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT dossiers_type_check CHECK (type_dossier IN ('INDIVIDUEL', 'FAMILLE', 'GROUPE'))
);

CREATE INDEX IF NOT EXISTS idx_dossiers_atelier_activite ON dossiers (atelier_id, date_derniere_activite DESC, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_dossiers_atelier_responsable ON dossiers (atelier_id, id_responsable_client);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dossiers_atelier_id_unique ON dossiers (atelier_id, id_dossier);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dossiers_atelier_fk'
  ) THEN
    ALTER TABLE dossiers
      ADD CONSTRAINT dossiers_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dossiers_responsable_client_fk'
  ) THEN
    ALTER TABLE dossiers
      ADD CONSTRAINT dossiers_responsable_client_fk
      FOREIGN KEY (atelier_id, id_responsable_client)
      REFERENCES clients(atelier_id, id_client);
  END IF;
END
$$ LANGUAGE plpgsql;

-- BC Caisse: schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS caisse_jour (
  id_caisse_jour TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  date_jour DATE NOT NULL,
  statut TEXT NOT NULL CHECK (statut IN ('OUVERTE','CLOTUREE')),
  solde_ouverture NUMERIC(12,2) NOT NULL CHECK (solde_ouverture >= 0),
  solde_cloture NUMERIC(12,2) NULL,
  ouverte_par TEXT NULL,
  cloturee_par TEXT NULL,
  date_ouverture TIMESTAMP NULL,
  date_cloture TIMESTAMP NULL,
  ouverture_anticipee BOOLEAN NOT NULL DEFAULT FALSE,
  motif_ouverture_anticipee TEXT NULL,
  autorisee_par TEXT NULL
);

CREATE TABLE IF NOT EXISTS caisse_operation (
  id_operation TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_caisse_jour TEXT NOT NULL REFERENCES caisse_jour(id_caisse_jour),
  type_operation TEXT NOT NULL CHECK (type_operation IN ('ENTREE','SORTIE')),
  montant NUMERIC(12,2) NOT NULL CHECK (montant > 0),
  mode_paiement TEXT NULL CHECK (mode_paiement IN ('CASH','MOBILE_MONEY','AUTRE')),
  motif TEXT NOT NULL,
  reference_metier TEXT NULL,
  date_operation TIMESTAMP NOT NULL,
  effectue_par TEXT NOT NULL,
  statut_operation TEXT NOT NULL CHECK (statut_operation IN ('VALIDE','ANNULEE')),
  motif_annulation TEXT NULL,
  annulee_par TEXT NULL,
  date_annulation TIMESTAMP NULL,
  type_depense TEXT NULL CHECK (type_depense IN ('QUOTIDIENNE','EXCEPTIONNELLE')),
  justification TEXT NULL,
  impact_journalier BOOLEAN NULL,
  impact_global BOOLEAN NULL
);

CREATE INDEX IF NOT EXISTS idx_caisse_jour_atelier_id ON caisse_jour (atelier_id);
CREATE INDEX IF NOT EXISTS idx_caisse_jour_date ON caisse_jour (date_jour);
CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_jour_atelier_date_unique ON caisse_jour (atelier_id, date_jour);
CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_jour_atelier_id_caisse_unique ON caisse_jour (atelier_id, id_caisse_jour);

ALTER TABLE caisse_jour ADD COLUMN IF NOT EXISTS ouverture_anticipee BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE caisse_jour ADD COLUMN IF NOT EXISTS motif_ouverture_anticipee TEXT NULL;
ALTER TABLE caisse_jour ADD COLUMN IF NOT EXISTS autorisee_par TEXT NULL;
ALTER TABLE caisse_operation ADD COLUMN IF NOT EXISTS type_depense TEXT NULL;
ALTER TABLE caisse_operation ADD COLUMN IF NOT EXISTS justification TEXT NULL;
ALTER TABLE caisse_operation ADD COLUMN IF NOT EXISTS impact_journalier BOOLEAN NULL;
ALTER TABLE caisse_operation ADD COLUMN IF NOT EXISTS impact_global BOOLEAN NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'caisse_operation'::regclass
      AND conname = 'caisse_operation_type_depense_check'
  ) THEN
    ALTER TABLE caisse_operation DROP CONSTRAINT caisse_operation_type_depense_check;
  END IF;
END $$;

ALTER TABLE caisse_operation
  ADD CONSTRAINT caisse_operation_type_depense_check
  CHECK (type_depense IN ('QUOTIDIENNE','EXCEPTIONNELLE'));

UPDATE caisse_operation
SET
  type_depense = COALESCE(type_depense, 'QUOTIDIENNE'),
  impact_journalier = COALESCE(impact_journalier, TRUE),
  impact_global = COALESCE(impact_global, TRUE)
WHERE type_operation = 'SORTIE' AND (type_depense IS NULL OR impact_journalier IS NULL OR impact_global IS NULL);
CREATE INDEX IF NOT EXISTS idx_caisse_operation_jour ON caisse_operation (id_caisse_jour);
CREATE INDEX IF NOT EXISTS idx_caisse_operation_atelier_id ON caisse_operation (atelier_id);
CREATE INDEX IF NOT EXISTS idx_caisse_operation_atelier_caisse ON caisse_operation (atelier_id, id_caisse_jour);
CREATE INDEX IF NOT EXISTS idx_caisse_operation_statut ON caisse_operation (statut_operation);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_jour_atelier_fk'
  ) THEN
    ALTER TABLE caisse_jour
      ADD CONSTRAINT caisse_jour_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_operation_atelier_fk'
  ) THEN
    ALTER TABLE caisse_operation
      ADD CONSTRAINT caisse_operation_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_operation_caisse_atelier_fk'
  ) THEN
    ALTER TABLE caisse_operation
      ADD CONSTRAINT caisse_operation_caisse_atelier_fk
      FOREIGN KEY (atelier_id, id_caisse_jour)
      REFERENCES caisse_jour(atelier_id, id_caisse_jour);
  END IF;
END $$;

-- Bilans caisse (hebdo / mensuel / annuel)
CREATE TABLE IF NOT EXISTS caisse_bilan (
  id_bilan TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  type_bilan TEXT NOT NULL CHECK (type_bilan IN ('HEBDO','MENSUEL','ANNUEL')),
  semaine_iso SMALLINT NULL,
  mois SMALLINT NULL,
  annee INTEGER NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  solde_ouverture NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_entrees NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_sorties NUMERIC(12,2) NOT NULL DEFAULT 0,
  solde_cloture NUMERIC(12,2) NOT NULL DEFAULT 0,
  nombre_jours INTEGER NOT NULL DEFAULT 0,
  nombre_operations INTEGER NOT NULL DEFAULT 0,
  cree_par TEXT NULL,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caisse_bilan_atelier_id ON caisse_bilan (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_bilan_atelier_unique ON caisse_bilan (atelier_id, type_bilan, date_debut, date_fin);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_bilan_atelier_fk'
  ) THEN
    ALTER TABLE caisse_bilan
      ADD CONSTRAINT caisse_bilan_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

ALTER TABLE caisse_bilan ADD COLUMN IF NOT EXISTS semaine_iso SMALLINT NULL;
ALTER TABLE caisse_bilan ADD COLUMN IF NOT EXISTS mois SMALLINT NULL;
ALTER TABLE caisse_bilan ADD COLUMN IF NOT EXISTS annee INTEGER NULL;
ALTER TABLE caisse_bilan ADD COLUMN IF NOT EXISTS nombre_jours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE caisse_bilan ADD COLUMN IF NOT EXISTS nombre_operations INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'caisse_bilan'::regclass
      AND conname = 'caisse_bilan_type_bilan_check'
  ) THEN
    ALTER TABLE caisse_bilan DROP CONSTRAINT caisse_bilan_type_bilan_check;
  END IF;
END $$;

ALTER TABLE caisse_bilan
  ADD CONSTRAINT caisse_bilan_type_bilan_check
  CHECK (type_bilan IN ('HEBDO','MENSUEL','ANNUEL'));

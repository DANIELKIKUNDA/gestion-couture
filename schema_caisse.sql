-- BC Caisse: schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS caisse_jour (
  id_caisse_jour TEXT PRIMARY KEY,
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
  date_annulation TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_caisse_jour_date ON caisse_jour (date_jour);
CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_jour_unique_date ON caisse_jour (date_jour);

ALTER TABLE caisse_jour ADD COLUMN IF NOT EXISTS ouverture_anticipee BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE caisse_jour ADD COLUMN IF NOT EXISTS motif_ouverture_anticipee TEXT NULL;
ALTER TABLE caisse_jour ADD COLUMN IF NOT EXISTS autorisee_par TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_caisse_operation_jour ON caisse_operation (id_caisse_jour);
CREATE INDEX IF NOT EXISTS idx_caisse_operation_statut ON caisse_operation (statut_operation);

-- Bilans caisse (hebdo / mensuel)
CREATE TABLE IF NOT EXISTS caisse_bilan (
  id_bilan TEXT PRIMARY KEY,
  type_bilan TEXT NOT NULL CHECK (type_bilan IN ('HEBDO','MENSUEL')),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  solde_ouverture NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_entrees NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_sorties NUMERIC(12,2) NOT NULL DEFAULT 0,
  solde_cloture NUMERIC(12,2) NOT NULL DEFAULT 0,
  cree_par TEXT NULL,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_bilan_unique ON caisse_bilan (type_bilan, date_debut, date_fin);

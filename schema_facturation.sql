-- BC Facturation V1: document derive, immutable, auditable

CREATE SEQUENCE IF NOT EXISTS facture_numero_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS factures (
  id_facture TEXT PRIMARY KEY,
  numero_facture TEXT NOT NULL UNIQUE,
  type_origine TEXT NOT NULL CHECK (type_origine IN ('COMMANDE', 'RETOUCHE', 'VENTE')),
  id_origine TEXT NOT NULL,
  client_snapshot JSONB NOT NULL,
  date_emission TIMESTAMP NOT NULL,
  montant_total NUMERIC(12,2) NOT NULL CHECK (montant_total >= 0),
  reference_caisse TEXT NULL,
  lignes_json JSONB NOT NULL
);

ALTER TABLE factures ADD COLUMN IF NOT EXISTS type_origine TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS id_origine TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_snapshot JSONB;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_emission TIMESTAMP;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS montant_total NUMERIC(12,2);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS reference_caisse TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS lignes_json JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures' AND column_name = 'id_client'
  ) THEN
    ALTER TABLE factures ALTER COLUMN id_client DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures' AND column_name = 'type_reference'
  ) THEN
    ALTER TABLE factures ALTER COLUMN type_reference DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures' AND column_name = 'id_reference'
  ) THEN
    ALTER TABLE factures ALTER COLUMN id_reference DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures' AND column_name = 'type_facture'
  ) THEN
    ALTER TABLE factures ALTER COLUMN type_facture DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures' AND column_name = 'statut_facture'
  ) THEN
    ALTER TABLE factures ALTER COLUMN statut_facture DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_factures_origine_unique ON factures (type_origine, id_origine);
CREATE INDEX IF NOT EXISTS idx_factures_numero ON factures (numero_facture);
CREATE INDEX IF NOT EXISTS idx_factures_date_emission ON factures (date_emission DESC);

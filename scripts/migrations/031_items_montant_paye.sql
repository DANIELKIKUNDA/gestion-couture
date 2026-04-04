ALTER TABLE commande_items
  ADD COLUMN IF NOT EXISTS montant_paye NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant_paye >= 0);

ALTER TABLE retouche_items
  ADD COLUMN IF NOT EXISTS montant_paye NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant_paye >= 0);

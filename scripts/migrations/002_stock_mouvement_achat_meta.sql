ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS fournisseur_id TEXT NULL;
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS fournisseur TEXT NULL;
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS reference_achat TEXT NULL;
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS prix_achat_unitaire NUMERIC(12,2) NULL;
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS montant_achat_total NUMERIC(12,2) NULL;
CREATE INDEX IF NOT EXISTS idx_mouvements_fournisseur_id ON mouvements_stock (fournisseur_id);

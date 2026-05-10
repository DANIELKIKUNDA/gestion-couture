ALTER TABLE caisse_operation ADD COLUMN IF NOT EXISTS activite TEXT;

UPDATE caisse_operation
SET activite = CASE
  WHEN motif IN ('VENTE_STOCK','PAIEMENT_STOCK','ACHAT_STOCK') THEN 'STOCK'
  ELSE 'ATELIER'
END
WHERE activite IS NULL OR BTRIM(activite) = '';

ALTER TABLE caisse_operation ALTER COLUMN activite SET DEFAULT 'ATELIER';
ALTER TABLE caisse_operation ALTER COLUMN activite SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'caisse_operation'::regclass
      AND conname = 'caisse_operation_activite_check'
  ) THEN
    ALTER TABLE caisse_operation DROP CONSTRAINT caisse_operation_activite_check;
  END IF;
END $$;

ALTER TABLE caisse_operation
  ADD CONSTRAINT caisse_operation_activite_check
  CHECK (activite IN ('ATELIER','STOCK'));

CREATE INDEX IF NOT EXISTS idx_caisse_operation_activite ON caisse_operation (activite);

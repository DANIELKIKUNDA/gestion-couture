DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'caisse_bilan'::regclass
      AND conname = 'caisse_bilan_type_bilan_check'
  ) THEN
    ALTER TABLE caisse_bilan DROP CONSTRAINT caisse_bilan_type_bilan_check;
  END IF;
END $$;

ALTER TABLE caisse_bilan
  ADD CONSTRAINT caisse_bilan_type_bilan_check
  CHECK (type_bilan IN ('HEBDO','MENSUEL','ANNUEL'));

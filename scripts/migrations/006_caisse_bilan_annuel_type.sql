DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'caisse_bilan'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.caisse_bilan'::regclass
        AND conname = 'caisse_bilan_type_bilan_check'
    ) THEN
      ALTER TABLE public.caisse_bilan
        DROP CONSTRAINT caisse_bilan_type_bilan_check;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.caisse_bilan'::regclass
        AND conname = 'caisse_bilan_type_bilan_check'
    ) THEN
      ALTER TABLE public.caisse_bilan
        ADD CONSTRAINT caisse_bilan_type_bilan_check
        CHECK (type_bilan IN ('HEBDO','MENSUEL','ANNUEL'));
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

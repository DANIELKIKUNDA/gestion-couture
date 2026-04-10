DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'retouches'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.retouches'::regclass
        AND conname = 'retouches_type_retouche_check'
    ) THEN
      ALTER TABLE public.retouches
        DROP CONSTRAINT retouches_type_retouche_check;
    END IF;

    -- Les types de retouche sont pilotables par atelier: aucune liste SQL globale
    -- ne doit bloquer les valeurs parametrees ou deja saisies.
  END IF;
END
$$ LANGUAGE plpgsql;

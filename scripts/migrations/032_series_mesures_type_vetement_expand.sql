DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'series_mesures_type_vetement_check'
      AND conrelid = 'public.series_mesures'::regclass
  ) THEN
    ALTER TABLE public.series_mesures
      DROP CONSTRAINT series_mesures_type_vetement_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'series_mesures_type_vetement_check'
      AND conrelid = 'public.series_mesures'::regclass
  ) THEN
    ALTER TABLE public.series_mesures
      ADD CONSTRAINT series_mesures_type_vetement_check
      CHECK (
        type_vetement IN (
          'PANTALON',
          'CHEMISE',
          'CHEMISIER',
          'VESTE',
          'GILET',
          'JACKET',
          'BOUBOU',
          'ROBE',
          'JUPE',
          'VESTE_FEMME',
          'LIBAYA',
          'ENSEMBLE',
          'AUTRES',
          'UNIFORME',
          'AUTRE'
        )
      );
  END IF;
END $$;

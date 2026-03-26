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

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.retouches'::regclass
        AND conname = 'retouches_type_retouche_check'
    ) THEN
      ALTER TABLE public.retouches
        ADD CONSTRAINT retouches_type_retouche_check
        CHECK (
          type_retouche IN (
            'OURLET_PANTALON','DIMINUER_LONGUEUR_PANTALON','RESSERRER_TAILLE_PANTALON','AGRANDIR_TAILLE_PANTALON','AJUSTER_BAS_PANTALON',
            'RESSERRER_TAILLE_CHEMISE','AGRANDIR_TAILLE_CHEMISE','REDUIRE_MANCHES_CHEMISE',
            'RESSERRER_ROBE','AGRANDIR_ROBE','AJUSTER_LONGUEUR_ROBE',
            'REPARATION_DECHIRURE','REMPLACER_FERMETURE','SURFILAGE','POSER_BOUTON','BRODERIE',
            'ZIGZAG','AUTRES',
            'OURLET','RESSERRAGE','AGRANDISSEMENT','REPARATION','FERMETURE','AUTRE'
          )
        );
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

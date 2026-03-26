DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ventes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ventes'
        AND column_name = 'total_prix_achat'
    ) THEN
      ALTER TABLE public.ventes
        ADD COLUMN total_prix_achat NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ventes'
        AND column_name = 'benefice_total'
    ) THEN
      ALTER TABLE public.ventes
        ADD COLUMN benefice_total NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'vente_lignes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vente_lignes'
        AND column_name = 'prix_achat_unitaire'
    ) THEN
      ALTER TABLE public.vente_lignes
        ADD COLUMN prix_achat_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vente_lignes'
        AND column_name = 'benefice_unitaire'
    ) THEN
      ALTER TABLE public.vente_lignes
        ADD COLUMN benefice_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vente_lignes'
        AND column_name = 'benefice_total'
    ) THEN
      ALTER TABLE public.vente_lignes
        ADD COLUMN benefice_total NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;
  END IF;
END
$$;

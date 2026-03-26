DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mouvements_stock'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mouvements_stock'
        AND column_name = 'fournisseur_id'
    ) THEN
      ALTER TABLE public.mouvements_stock
        ADD COLUMN fournisseur_id TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mouvements_stock'
        AND column_name = 'fournisseur'
    ) THEN
      ALTER TABLE public.mouvements_stock
        ADD COLUMN fournisseur TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mouvements_stock'
        AND column_name = 'reference_achat'
    ) THEN
      ALTER TABLE public.mouvements_stock
        ADD COLUMN reference_achat TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mouvements_stock'
        AND column_name = 'prix_achat_unitaire'
    ) THEN
      ALTER TABLE public.mouvements_stock
        ADD COLUMN prix_achat_unitaire NUMERIC(12,2) NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mouvements_stock'
        AND column_name = 'montant_achat_total'
    ) THEN
      ALTER TABLE public.mouvements_stock
        ADD COLUMN montant_achat_total NUMERIC(12,2) NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_mouvements_fournisseur_id'
    ) THEN
      CREATE INDEX idx_mouvements_fournisseur_id
        ON public.mouvements_stock (fournisseur_id);
    END IF;
  END IF;
END
$$;

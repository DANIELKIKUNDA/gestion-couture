DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commande_media'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'commande_media'
        AND column_name = 'id_item'
    ) THEN
      ALTER TABLE public.commande_media
        ADD COLUMN id_item TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_media_atelier_item'
    ) THEN
      CREATE INDEX idx_commande_media_atelier_item
        ON public.commande_media (atelier_id, id_commande, id_item);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'commande_media_item_atelier_fk'
    ) THEN
      ALTER TABLE public.commande_media
        ADD CONSTRAINT commande_media_item_atelier_fk
        FOREIGN KEY (atelier_id, id_item)
        REFERENCES public.commande_items(atelier_id, id_item)
        ON DELETE SET NULL;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

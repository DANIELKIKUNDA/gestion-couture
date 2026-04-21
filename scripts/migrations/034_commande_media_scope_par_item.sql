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

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'commande_items'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'commande_items_atelier_item_unique'
      ) THEN
        ALTER TABLE public.commande_items
          ADD CONSTRAINT commande_items_atelier_item_unique
          UNIQUE (atelier_id, id_item);
      END IF;

      UPDATE public.commande_media cm
      SET id_item = src.id_item
      FROM (
        SELECT ci.atelier_id, ci.id_commande, MIN(ci.id_item) AS id_item
        FROM public.commande_items ci
        GROUP BY ci.atelier_id, ci.id_commande
        HAVING COUNT(*) = 1
      ) AS src
      WHERE cm.atelier_id = src.atelier_id
        AND cm.id_commande = src.id_commande
        AND (cm.id_item IS NULL OR BTRIM(cm.id_item) = '');

      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'commande_media_item_atelier_fk'
      ) THEN
        ALTER TABLE public.commande_media
          DROP CONSTRAINT commande_media_item_atelier_fk;
      END IF;

      ALTER TABLE public.commande_media
        ADD CONSTRAINT commande_media_item_atelier_fk
        FOREIGN KEY (atelier_id, id_item)
        REFERENCES public.commande_items(atelier_id, id_item)
        ON DELETE SET NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_media_atelier_commande_position'
    ) THEN
      DROP INDEX public.idx_commande_media_atelier_commande_position;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_media_primary_unique'
    ) THEN
      DROP INDEX public.idx_commande_media_primary_unique;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_media_atelier_commande_item'
    ) THEN
      CREATE INDEX idx_commande_media_atelier_commande_item
        ON public.commande_media (atelier_id, id_commande, id_item, position);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_media_atelier_commande_item_position'
    ) THEN
      CREATE UNIQUE INDEX idx_commande_media_atelier_commande_item_position
        ON public.commande_media (atelier_id, id_commande, COALESCE(id_item, ''), position);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_commande_media_primary_item_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_commande_media_primary_item_unique
        ON public.commande_media (atelier_id, id_commande, COALESCE(id_item, ''))
        WHERE is_primary = true;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

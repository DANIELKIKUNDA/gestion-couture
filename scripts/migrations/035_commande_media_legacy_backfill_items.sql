DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commandes'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commande_media'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commande_items'
  ) THEN
    INSERT INTO public.commande_items (
      id_item,
      atelier_id,
      id_commande,
      type_habit,
      description,
      prix,
      ordre_affichage,
      date_creation,
      mesures_snapshot_json,
      montant_paye
    )
    SELECT
      'LEGACY-' || c.id_commande AS id_item,
      c.atelier_id,
      c.id_commande,
      c.type_habit,
      COALESCE(NULLIF(BTRIM(c.description), ''), c.type_habit, 'Habit') AS description,
      COALESCE(c.montant_total, 0),
      1,
      c.date_creation,
      c.mesures_habit_snapshot,
      0
    FROM public.commandes c
    JOIN public.commande_media cm
      ON cm.atelier_id = c.atelier_id
     AND cm.id_commande = c.id_commande
    LEFT JOIN public.commande_items ci
      ON ci.atelier_id = c.atelier_id
     AND ci.id_commande = c.id_commande
    WHERE COALESCE(BTRIM(cm.id_item), '') = ''
      AND ci.id_item IS NULL
      AND c.type_habit IS NOT NULL
    GROUP BY
      c.atelier_id,
      c.id_commande,
      c.type_habit,
      c.description,
      c.montant_total,
      c.date_creation,
      c.mesures_habit_snapshot
    ON CONFLICT (id_item) DO NOTHING;

    UPDATE public.commande_media cm
    SET id_item = 'LEGACY-' || c.id_commande
    FROM public.commandes c
    LEFT JOIN public.commande_items ci
      ON ci.atelier_id = c.atelier_id
     AND ci.id_commande = c.id_commande
    WHERE cm.atelier_id = c.atelier_id
      AND cm.id_commande = c.id_commande
      AND COALESCE(BTRIM(cm.id_item), '') = ''
      AND c.type_habit IS NOT NULL
      AND ci.id_item = 'LEGACY-' || c.id_commande;
  END IF;
END
$$ LANGUAGE plpgsql;

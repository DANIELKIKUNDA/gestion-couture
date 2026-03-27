DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ateliers'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.ateliers (
        id_atelier TEXT PRIMARY KEY,
        nom TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        actif BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $sql$;
  END IF;

  INSERT INTO public.ateliers (id_atelier, nom, slug, actif)
  VALUES ('ATELIER', 'Atelier historique', 'atelier-historique', true)
  ON CONFLICT (id_atelier) DO UPDATE
  SET
    nom = EXCLUDED.nom,
    slug = EXCLUDED.slug,
    actif = EXCLUDED.actif,
    updated_at = NOW();

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'series_mesures'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'series_mesures' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.series_mesures ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commandes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'commandes' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.commandes ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commande_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'commande_events' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.commande_events ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouches'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'retouches' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.retouches ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouche_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'retouche_events' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.retouche_events ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_jour'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'caisse_jour' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.caisse_jour ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_operation'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'caisse_operation' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.caisse_operation ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_bilan'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'caisse_bilan' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.caisse_bilan ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'articles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.articles ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mouvements_stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mouvements_stock' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.mouvements_stock ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fournisseurs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fournisseurs' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.fournisseurs ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_prix_historique'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_prix_historique' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.stock_prix_historique ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ventes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ventes' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.ventes ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vente_lignes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vente_lignes' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.vente_lignes ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'factures'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'factures' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.factures ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'atelier_parametres'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'atelier_parametres' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.atelier_parametres ADD COLUMN atelier_id TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'utilisateurs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'utilisateurs' AND column_name = 'atelier_id'
  ) THEN
    ALTER TABLE public.utilisateurs ADD COLUMN atelier_id TEXT NOT NULL DEFAULT 'ATELIER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'utilisateurs'
  ) THEN
    UPDATE public.utilisateurs
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    UPDATE public.clients
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'series_mesures'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    UPDATE public.series_mesures sm
    SET atelier_id = COALESCE(NULLIF(c.atelier_id, ''), 'ATELIER')
    FROM public.clients c
    WHERE sm.id_client = c.id_client
      AND (sm.atelier_id IS NULL OR sm.atelier_id = '');

    UPDATE public.series_mesures
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commandes'
  ) THEN
    UPDATE public.commandes
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commande_events'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commandes'
  ) THEN
    UPDATE public.commande_events ce
    SET atelier_id = COALESCE(NULLIF(c.atelier_id, ''), 'ATELIER')
    FROM public.commandes c
    WHERE ce.id_commande = c.id_commande
      AND (ce.atelier_id IS NULL OR ce.atelier_id = '');

    UPDATE public.commande_events
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouches'
  ) THEN
    UPDATE public.retouches
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouche_events'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouches'
  ) THEN
    UPDATE public.retouche_events re
    SET atelier_id = COALESCE(NULLIF(r.atelier_id, ''), 'ATELIER')
    FROM public.retouches r
    WHERE re.id_retouche = r.id_retouche
      AND (re.atelier_id IS NULL OR re.atelier_id = '');

    UPDATE public.retouche_events
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_jour'
  ) THEN
    UPDATE public.caisse_jour
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_operation'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_jour'
  ) THEN
    UPDATE public.caisse_operation co
    SET atelier_id = COALESCE(NULLIF(cj.atelier_id, ''), 'ATELIER')
    FROM public.caisse_jour cj
    WHERE co.id_caisse_jour = cj.id_caisse_jour
      AND (co.atelier_id IS NULL OR co.atelier_id = '');

    UPDATE public.caisse_operation
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_bilan'
  ) THEN
    UPDATE public.caisse_bilan
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'articles'
  ) THEN
    UPDATE public.articles
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mouvements_stock'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'articles'
  ) THEN
    UPDATE public.mouvements_stock ms
    SET atelier_id = COALESCE(NULLIF(a.atelier_id, ''), 'ATELIER')
    FROM public.articles a
    WHERE ms.id_article = a.id_article
      AND (ms.atelier_id IS NULL OR ms.atelier_id = '');

    UPDATE public.mouvements_stock
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fournisseurs'
  ) THEN
    UPDATE public.fournisseurs
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_prix_historique'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'articles'
  ) THEN
    UPDATE public.stock_prix_historique sph
    SET atelier_id = COALESCE(NULLIF(a.atelier_id, ''), 'ATELIER')
    FROM public.articles a
    WHERE sph.id_article = a.id_article
      AND (sph.atelier_id IS NULL OR sph.atelier_id = '');

    UPDATE public.stock_prix_historique
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ventes'
  ) THEN
    UPDATE public.ventes
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vente_lignes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ventes'
  ) THEN
    UPDATE public.vente_lignes vl
    SET atelier_id = COALESCE(NULLIF(v.atelier_id, ''), 'ATELIER')
    FROM public.ventes v
    WHERE vl.id_vente = v.id_vente
      AND (vl.atelier_id IS NULL OR vl.atelier_id = '');

    UPDATE public.vente_lignes
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'factures'
  ) THEN
    UPDATE public.factures
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'atelier_parametres'
  ) THEN
    UPDATE public.atelier_parametres
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR atelier_id = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.clients ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'series_mesures'
  ) THEN
    ALTER TABLE public.series_mesures ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.series_mesures ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commandes'
  ) THEN
    ALTER TABLE public.commandes ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.commandes ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commande_events'
  ) THEN
    ALTER TABLE public.commande_events ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.commande_events ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouches'
  ) THEN
    ALTER TABLE public.retouches ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.retouches ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouche_events'
  ) THEN
    ALTER TABLE public.retouche_events ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.retouche_events ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_jour'
  ) THEN
    ALTER TABLE public.caisse_jour ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.caisse_jour ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_operation'
  ) THEN
    ALTER TABLE public.caisse_operation ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.caisse_operation ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_bilan'
  ) THEN
    ALTER TABLE public.caisse_bilan ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.caisse_bilan ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'articles'
  ) THEN
    ALTER TABLE public.articles ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.articles ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mouvements_stock'
  ) THEN
    ALTER TABLE public.mouvements_stock ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.mouvements_stock ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fournisseurs'
  ) THEN
    ALTER TABLE public.fournisseurs ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.fournisseurs ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_prix_historique'
  ) THEN
    ALTER TABLE public.stock_prix_historique ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.stock_prix_historique ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ventes'
  ) THEN
    ALTER TABLE public.ventes ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.ventes ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vente_lignes'
  ) THEN
    ALTER TABLE public.vente_lignes ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.vente_lignes ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'factures'
  ) THEN
    ALTER TABLE public.factures ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.factures ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'atelier_parametres'
  ) THEN
    ALTER TABLE public.atelier_parametres ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE public.atelier_parametres ALTER COLUMN atelier_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_clients_atelier_id'
  ) THEN
    CREATE INDEX idx_clients_atelier_id ON public.clients (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'series_mesures'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_series_mesures_atelier_id'
  ) THEN
    CREATE INDEX idx_series_mesures_atelier_id ON public.series_mesures (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commandes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_commandes_atelier_id'
  ) THEN
    CREATE INDEX idx_commandes_atelier_id ON public.commandes (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commande_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_commande_events_atelier_id'
  ) THEN
    CREATE INDEX idx_commande_events_atelier_id ON public.commande_events (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouches'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_retouches_atelier_id'
  ) THEN
    CREATE INDEX idx_retouches_atelier_id ON public.retouches (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouche_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_retouche_events_atelier_id'
  ) THEN
    CREATE INDEX idx_retouche_events_atelier_id ON public.retouche_events (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_jour'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_caisse_jour_atelier_id'
  ) THEN
    CREATE INDEX idx_caisse_jour_atelier_id ON public.caisse_jour (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_operation'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_caisse_operation_atelier_id'
  ) THEN
    CREATE INDEX idx_caisse_operation_atelier_id ON public.caisse_operation (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_bilan'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_caisse_bilan_atelier_id'
  ) THEN
    CREATE INDEX idx_caisse_bilan_atelier_id ON public.caisse_bilan (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'articles'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_articles_atelier_id'
  ) THEN
    CREATE INDEX idx_articles_atelier_id ON public.articles (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mouvements_stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_mouvements_stock_atelier_id'
  ) THEN
    CREATE INDEX idx_mouvements_stock_atelier_id ON public.mouvements_stock (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fournisseurs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_fournisseurs_atelier_id'
  ) THEN
    CREATE INDEX idx_fournisseurs_atelier_id ON public.fournisseurs (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_prix_historique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_stock_prix_historique_atelier_id'
  ) THEN
    CREATE INDEX idx_stock_prix_historique_atelier_id ON public.stock_prix_historique (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ventes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_ventes_atelier_id'
  ) THEN
    CREATE INDEX idx_ventes_atelier_id ON public.ventes (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vente_lignes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_vente_lignes_atelier_id'
  ) THEN
    CREATE INDEX idx_vente_lignes_atelier_id ON public.vente_lignes (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'factures'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_factures_atelier_id'
  ) THEN
    CREATE INDEX idx_factures_atelier_id ON public.factures (atelier_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'atelier_parametres'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_atelier_parametres_atelier_id'
  ) THEN
    CREATE INDEX idx_atelier_parametres_atelier_id ON public.atelier_parametres (atelier_id);
  END IF;
END
$$ LANGUAGE plpgsql;

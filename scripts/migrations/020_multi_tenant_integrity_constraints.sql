DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_clients_atelier_id_client_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_clients_atelier_id_client_unique
      ON public.clients (atelier_id, id_client);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'series_mesures'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_series_mesures_atelier_id_serie_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_series_mesures_atelier_id_serie_unique
      ON public.series_mesures (atelier_id, id_serie_mesures);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commandes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_commandes_atelier_id_commande_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_commandes_atelier_id_commande_unique
      ON public.commandes (atelier_id, id_commande);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouches'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_retouches_atelier_id_retouche_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_retouches_atelier_id_retouche_unique
      ON public.retouches (atelier_id, id_retouche);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_jour'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_caisse_jour_atelier_id_caisse_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_caisse_jour_atelier_id_caisse_unique
      ON public.caisse_jour (atelier_id, id_caisse_jour);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'articles'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_articles_atelier_id_article_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_articles_atelier_id_article_unique
      ON public.articles (atelier_id, id_article);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ventes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_ventes_atelier_id_vente_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_ventes_atelier_id_vente_unique
      ON public.ventes (atelier_id, id_vente);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'series_mesures'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_series_mesures_atelier_client'
  ) THEN
    CREATE INDEX idx_series_mesures_atelier_client
      ON public.series_mesures (atelier_id, id_client);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commandes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_commandes_atelier_client'
  ) THEN
    CREATE INDEX idx_commandes_atelier_client
      ON public.commandes (atelier_id, id_client);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commande_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_commande_events_atelier_commande'
  ) THEN
    CREATE INDEX idx_commande_events_atelier_commande
      ON public.commande_events (atelier_id, id_commande);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouches'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_retouches_atelier_client'
  ) THEN
    CREATE INDEX idx_retouches_atelier_client
      ON public.retouches (atelier_id, id_client);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retouche_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_retouche_events_atelier_retouche'
  ) THEN
    CREATE INDEX idx_retouche_events_atelier_retouche
      ON public.retouche_events (atelier_id, id_retouche);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'caisse_operation'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_caisse_operation_atelier_caisse'
  ) THEN
    CREATE INDEX idx_caisse_operation_atelier_caisse
      ON public.caisse_operation (atelier_id, id_caisse_jour);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mouvements_stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_mouvements_stock_atelier_article'
  ) THEN
    CREATE INDEX idx_mouvements_stock_atelier_article
      ON public.mouvements_stock (atelier_id, id_article);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_prix_historique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_stock_prix_historique_atelier_article'
  ) THEN
    CREATE INDEX idx_stock_prix_historique_atelier_article
      ON public.stock_prix_historique (atelier_id, id_article);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vente_lignes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_vente_lignes_atelier_vente'
  ) THEN
    CREATE INDEX idx_vente_lignes_atelier_vente
      ON public.vente_lignes (atelier_id, id_vente);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vente_lignes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_vente_lignes_atelier_article'
  ) THEN
    CREATE INDEX idx_vente_lignes_atelier_article
      ON public.vente_lignes (atelier_id, id_article);
  END IF;
END
$$;

INSERT INTO clients (id_client, atelier_id, nom, prenom, telephone, adresse, sexe, actif, date_creation)
SELECT
  missing.id_client,
  missing.atelier_id,
  'Client migration',
  'Placeholder',
  CONCAT('MIG-', missing.atelier_id, '-', missing.id_client),
  NULL,
  NULL,
  true,
  NOW()
FROM (
  SELECT DISTINCT s.atelier_id, s.id_client
  FROM series_mesures s
  WHERE NOT EXISTS (
    SELECT 1
    FROM clients c
    WHERE c.atelier_id = s.atelier_id
      AND c.id_client = s.id_client
  )
  UNION
  SELECT DISTINCT c.atelier_id, c.id_client
  FROM commandes c
  WHERE NOT EXISTS (
    SELECT 1
    FROM clients cl
    WHERE cl.atelier_id = c.atelier_id
      AND cl.id_client = c.id_client
  )
  UNION
  SELECT DISTINCT r.atelier_id, r.id_client
  FROM retouches r
  WHERE NOT EXISTS (
    SELECT 1
    FROM clients cl
    WHERE cl.atelier_id = r.atelier_id
      AND cl.id_client = r.id_client
  )
) AS missing
ON CONFLICT (id_client) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_atelier_fk'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'series_mesures_atelier_fk'
  ) THEN
    ALTER TABLE series_mesures
      ADD CONSTRAINT series_mesures_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commandes_atelier_fk'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_events_atelier_fk'
  ) THEN
    ALTER TABLE commande_events
      ADD CONSTRAINT commande_events_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouches_atelier_fk'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_events_atelier_fk'
  ) THEN
    ALTER TABLE retouche_events
      ADD CONSTRAINT retouche_events_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_jour_atelier_fk'
  ) THEN
    ALTER TABLE caisse_jour
      ADD CONSTRAINT caisse_jour_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_operation_atelier_fk'
  ) THEN
    ALTER TABLE caisse_operation
      ADD CONSTRAINT caisse_operation_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_bilan_atelier_fk'
  ) THEN
    ALTER TABLE caisse_bilan
      ADD CONSTRAINT caisse_bilan_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_atelier_fk'
  ) THEN
    ALTER TABLE articles
      ADD CONSTRAINT articles_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mouvements_stock_atelier_fk'
  ) THEN
    ALTER TABLE mouvements_stock
      ADD CONSTRAINT mouvements_stock_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fournisseurs_atelier_fk'
  ) THEN
    ALTER TABLE fournisseurs
      ADD CONSTRAINT fournisseurs_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_prix_historique_atelier_fk'
  ) THEN
    ALTER TABLE stock_prix_historique
      ADD CONSTRAINT stock_prix_historique_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ventes_atelier_fk'
  ) THEN
    ALTER TABLE ventes
      ADD CONSTRAINT ventes_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vente_lignes_atelier_fk'
  ) THEN
    ALTER TABLE vente_lignes
      ADD CONSTRAINT vente_lignes_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'factures_atelier_fk'
  ) THEN
    ALTER TABLE factures
      ADD CONSTRAINT factures_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'atelier_parametres_atelier_fk'
  ) THEN
    ALTER TABLE atelier_parametres
      ADD CONSTRAINT atelier_parametres_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'utilisateurs_atelier_fk'
  ) AND to_regclass('utilisateurs') IS NOT NULL THEN
    ALTER TABLE utilisateurs
      ADD CONSTRAINT utilisateurs_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permission_atelier_atelier_fk'
  ) AND to_regclass('role_permission_atelier') IS NOT NULL THEN
    ALTER TABLE role_permission_atelier
      ADD CONSTRAINT role_permission_atelier_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'series_mesures_client_atelier_fk'
  ) THEN
    ALTER TABLE series_mesures
      ADD CONSTRAINT series_mesures_client_atelier_fk
      FOREIGN KEY (atelier_id, id_client)
      REFERENCES clients(atelier_id, id_client);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commandes_client_atelier_fk'
  ) THEN
    ALTER TABLE commandes
      ADD CONSTRAINT commandes_client_atelier_fk
      FOREIGN KEY (atelier_id, id_client)
      REFERENCES clients(atelier_id, id_client);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_events_commande_atelier_fk'
  ) THEN
    ALTER TABLE commande_events
      ADD CONSTRAINT commande_events_commande_atelier_fk
      FOREIGN KEY (atelier_id, id_commande)
      REFERENCES commandes(atelier_id, id_commande)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouches_client_atelier_fk'
  ) THEN
    ALTER TABLE retouches
      ADD CONSTRAINT retouches_client_atelier_fk
      FOREIGN KEY (atelier_id, id_client)
      REFERENCES clients(atelier_id, id_client);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retouche_events_retouche_atelier_fk'
  ) THEN
    ALTER TABLE retouche_events
      ADD CONSTRAINT retouche_events_retouche_atelier_fk
      FOREIGN KEY (atelier_id, id_retouche)
      REFERENCES retouches(atelier_id, id_retouche)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caisse_operation_caisse_atelier_fk'
  ) THEN
    ALTER TABLE caisse_operation
      ADD CONSTRAINT caisse_operation_caisse_atelier_fk
      FOREIGN KEY (atelier_id, id_caisse_jour)
      REFERENCES caisse_jour(atelier_id, id_caisse_jour);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mouvements_stock_article_atelier_fk'
  ) THEN
    ALTER TABLE mouvements_stock
      ADD CONSTRAINT mouvements_stock_article_atelier_fk
      FOREIGN KEY (atelier_id, id_article)
      REFERENCES articles(atelier_id, id_article);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_prix_historique_article_atelier_fk'
  ) THEN
    ALTER TABLE stock_prix_historique
      ADD CONSTRAINT stock_prix_historique_article_atelier_fk
      FOREIGN KEY (atelier_id, id_article)
      REFERENCES articles(atelier_id, id_article);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vente_lignes_vente_atelier_fk'
  ) THEN
    ALTER TABLE vente_lignes
      ADD CONSTRAINT vente_lignes_vente_atelier_fk
      FOREIGN KEY (atelier_id, id_vente)
      REFERENCES ventes(atelier_id, id_vente)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vente_lignes_article_atelier_fk'
  ) THEN
    ALTER TABLE vente_lignes
      ADD CONSTRAINT vente_lignes_article_atelier_fk
      FOREIGN KEY (atelier_id, id_article)
      REFERENCES articles(atelier_id, id_article);
  END IF;
END $$;

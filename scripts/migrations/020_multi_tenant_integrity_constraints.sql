CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_atelier_id_client_unique
ON clients (atelier_id, id_client);

CREATE UNIQUE INDEX IF NOT EXISTS idx_series_mesures_atelier_id_serie_unique
ON series_mesures (atelier_id, id_serie_mesures);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commandes_atelier_id_commande_unique
ON commandes (atelier_id, id_commande);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retouches_atelier_id_retouche_unique
ON retouches (atelier_id, id_retouche);

CREATE UNIQUE INDEX IF NOT EXISTS idx_caisse_jour_atelier_id_caisse_unique
ON caisse_jour (atelier_id, id_caisse_jour);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_atelier_id_article_unique
ON articles (atelier_id, id_article);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventes_atelier_id_vente_unique
ON ventes (atelier_id, id_vente);

CREATE INDEX IF NOT EXISTS idx_series_mesures_atelier_client
ON series_mesures (atelier_id, id_client);

CREATE INDEX IF NOT EXISTS idx_commandes_atelier_client
ON commandes (atelier_id, id_client);

CREATE INDEX IF NOT EXISTS idx_commande_events_atelier_commande
ON commande_events (atelier_id, id_commande);

CREATE INDEX IF NOT EXISTS idx_retouches_atelier_client
ON retouches (atelier_id, id_client);

CREATE INDEX IF NOT EXISTS idx_retouche_events_atelier_retouche
ON retouche_events (atelier_id, id_retouche);

CREATE INDEX IF NOT EXISTS idx_caisse_operation_atelier_caisse
ON caisse_operation (atelier_id, id_caisse_jour);

CREATE INDEX IF NOT EXISTS idx_mouvements_stock_atelier_article
ON mouvements_stock (atelier_id, id_article);

CREATE INDEX IF NOT EXISTS idx_stock_prix_historique_atelier_article
ON stock_prix_historique (atelier_id, id_article);

CREATE INDEX IF NOT EXISTS idx_vente_lignes_atelier_vente
ON vente_lignes (atelier_id, id_vente);

CREATE INDEX IF NOT EXISTS idx_vente_lignes_atelier_article
ON vente_lignes (atelier_id, id_article);

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

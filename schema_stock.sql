-- BC Stock & Ventes: schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS articles (
  id_article TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  nom_article TEXT NOT NULL,
  categorie_article TEXT NOT NULL CHECK (categorie_article IN ('TISSU','FIL','BOUTON','FERMETURE','ACCESSOIRE')),
  unite_stock TEXT NOT NULL CHECK (unite_stock IN ('METRE','PIECE','BOBINE','AUTRE')),
  quantite_disponible NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantite_disponible >= 0),
  prix_achat_moyen NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (prix_achat_moyen >= 0),
  prix_vente_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0,
  seuil_alerte NUMERIC(12,2) NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id_mouvement TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_article TEXT NOT NULL REFERENCES articles(id_article),
  type_mouvement TEXT NOT NULL CHECK (type_mouvement IN ('ENTREE','SORTIE')),
  quantite NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  motif TEXT NOT NULL,
  date_mouvement TIMESTAMP NOT NULL,
  effectue_par TEXT NOT NULL,
  reference_metier TEXT NULL,
  fournisseur_id TEXT NULL,
  fournisseur TEXT NULL,
  reference_achat TEXT NULL,
  prix_achat_unitaire NUMERIC(12,2) NULL,
  montant_achat_total NUMERIC(12,2) NULL
);

CREATE TABLE IF NOT EXISTS fournisseurs (
  id_fournisseur TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  nom_fournisseur TEXT NOT NULL,
  telephone TEXT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_prix_historique (
  id_historique TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_article TEXT NOT NULL REFERENCES articles(id_article),
  ancien_prix NUMERIC(12,2) NOT NULL,
  nouveau_prix NUMERIC(12,2) NOT NULL,
  date_modification TIMESTAMP NOT NULL DEFAULT NOW(),
  modifie_par TEXT NULL
);

CREATE TABLE IF NOT EXISTS ventes (
  id_vente TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  date_vente TIMESTAMP NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  total_prix_achat NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_prix_achat >= 0),
  benefice_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut TEXT NOT NULL CHECK (statut IN ('BROUILLON','VALIDEE','ANNULEE')),
  reference_caisse TEXT NULL,
  motif_annulation TEXT NULL
);

CREATE TABLE IF NOT EXISTS vente_lignes (
  id_ligne TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_vente TEXT NOT NULL REFERENCES ventes(id_vente) ON DELETE CASCADE,
  id_article TEXT NOT NULL REFERENCES articles(id_article),
  libelle_article TEXT NOT NULL,
  quantite NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC(12,2) NOT NULL CHECK (prix_unitaire >= 0),
  prix_achat_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (prix_achat_unitaire >= 0),
  benefice_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0,
  benefice_total NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_articles_atelier_id ON articles (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_atelier_id_article_unique ON articles (atelier_id, id_article);
CREATE INDEX IF NOT EXISTS idx_articles_categorie ON articles (categorie_article);
CREATE INDEX IF NOT EXISTS idx_articles_actif ON articles (actif);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_atelier_id ON mouvements_stock (atelier_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_article ON mouvements_stock (id_article);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_atelier_article ON mouvements_stock (atelier_id, id_article);
CREATE INDEX IF NOT EXISTS idx_mouvements_fournisseur_id ON mouvements_stock (fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_atelier_id ON fournisseurs (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fournisseurs_atelier_nom_unique ON fournisseurs (atelier_id, nom_fournisseur);
CREATE INDEX IF NOT EXISTS idx_stock_prix_historique_atelier_id ON stock_prix_historique (atelier_id);
CREATE INDEX IF NOT EXISTS idx_stock_prix_historique_atelier_article ON stock_prix_historique (atelier_id, id_article);
CREATE INDEX IF NOT EXISTS idx_prix_hist_article_date ON stock_prix_historique (id_article, date_modification DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_atelier_id ON ventes (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventes_atelier_id_vente_unique ON ventes (atelier_id, id_vente);
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON ventes (statut);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes (date_vente);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_atelier_id ON vente_lignes (atelier_id);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente ON vente_lignes (id_vente);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_atelier_vente ON vente_lignes (atelier_id, id_vente);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_atelier_article ON vente_lignes (atelier_id, id_article);

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

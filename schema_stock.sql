-- BC Stock & Ventes: schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS articles (
  id_article TEXT PRIMARY KEY,
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
  nom_fournisseur TEXT NOT NULL UNIQUE,
  telephone TEXT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_prix_historique (
  id_historique TEXT PRIMARY KEY,
  id_article TEXT NOT NULL REFERENCES articles(id_article),
  ancien_prix NUMERIC(12,2) NOT NULL,
  nouveau_prix NUMERIC(12,2) NOT NULL,
  date_modification TIMESTAMP NOT NULL DEFAULT NOW(),
  modifie_par TEXT NULL
);

CREATE TABLE IF NOT EXISTS ventes (
  id_vente TEXT PRIMARY KEY,
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
  id_vente TEXT NOT NULL REFERENCES ventes(id_vente) ON DELETE CASCADE,
  id_article TEXT NOT NULL REFERENCES articles(id_article),
  libelle_article TEXT NOT NULL,
  quantite NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC(12,2) NOT NULL CHECK (prix_unitaire >= 0),
  prix_achat_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (prix_achat_unitaire >= 0),
  benefice_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0,
  benefice_total NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_articles_categorie ON articles (categorie_article);
CREATE INDEX IF NOT EXISTS idx_articles_actif ON articles (actif);
CREATE INDEX IF NOT EXISTS idx_mouvements_article ON mouvements_stock (id_article);
CREATE INDEX IF NOT EXISTS idx_mouvements_fournisseur_id ON mouvements_stock (fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_prix_hist_article_date ON stock_prix_historique (id_article, date_modification DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON ventes (statut);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes (date_vente);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente ON vente_lignes (id_vente);

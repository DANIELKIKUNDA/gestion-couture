-- BC Stock & Ventes: schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS articles (
  id_article TEXT PRIMARY KEY,
  nom_article TEXT NOT NULL,
  categorie_article TEXT NOT NULL CHECK (categorie_article IN ('TISSU','FIL','BOUTON','FERMETURE','ACCESSOIRE')),
  unite_stock TEXT NOT NULL CHECK (unite_stock IN ('METRE','PIECE','BOBINE','AUTRE')),
  quantite_disponible NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantite_disponible >= 0),
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
  reference_metier TEXT NULL
);

CREATE TABLE IF NOT EXISTS ventes (
  id_vente TEXT PRIMARY KEY,
  date_vente TIMESTAMP NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
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
  prix_unitaire NUMERIC(12,2) NOT NULL CHECK (prix_unitaire >= 0)
);

CREATE INDEX IF NOT EXISTS idx_articles_categorie ON articles (categorie_article);
CREATE INDEX IF NOT EXISTS idx_articles_actif ON articles (actif);
CREATE INDEX IF NOT EXISTS idx_mouvements_article ON mouvements_stock (id_article);
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON ventes (statut);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes (date_vente);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente ON vente_lignes (id_vente);

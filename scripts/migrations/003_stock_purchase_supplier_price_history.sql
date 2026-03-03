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

CREATE INDEX IF NOT EXISTS idx_prix_hist_article_date ON stock_prix_historique (id_article, date_modification DESC);

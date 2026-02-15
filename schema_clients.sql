-- BC Clients & Mesures: schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS clients (
  id_client TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  adresse TEXT NULL,
  sexe TEXT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  date_creation TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS series_mesures (
  id_serie_mesures TEXT PRIMARY KEY,
  id_client TEXT NOT NULL REFERENCES clients(id_client),
  type_vetement TEXT NOT NULL CHECK (type_vetement IN ('ROBE','PANTALON','CHEMISE','JUPE','UNIFORME','AUTRE')),
  ensemble_mesures JSONB NOT NULL,
  date_prise TIMESTAMP NOT NULL,
  prise_par TEXT NULL,
  est_active BOOLEAN NOT NULL DEFAULT false,
  observations TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_telephone ON clients (telephone);
CREATE INDEX IF NOT EXISTS idx_series_mesures_client ON series_mesures (id_client);
CREATE INDEX IF NOT EXISTS idx_series_mesures_active ON series_mesures (id_client, type_vetement, est_active);

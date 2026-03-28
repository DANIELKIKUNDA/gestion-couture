-- BC Clients & Mesures: schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS clients (
  id_client TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NULL,
  adresse TEXT NULL,
  sexe TEXT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  date_creation TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS series_mesures (
  id_serie_mesures TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_client TEXT NOT NULL REFERENCES clients(id_client),
  type_vetement TEXT NOT NULL CHECK (type_vetement IN ('ROBE','PANTALON','CHEMISE','JUPE','UNIFORME','AUTRE')),
  ensemble_mesures JSONB NOT NULL,
  date_prise TIMESTAMP NOT NULL,
  prise_par TEXT NULL,
  est_active BOOLEAN NOT NULL DEFAULT false,
  observations TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_atelier_id ON clients (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_atelier_id_client_unique ON clients (atelier_id, id_client);
CREATE INDEX IF NOT EXISTS idx_clients_telephone ON clients (telephone);
CREATE INDEX IF NOT EXISTS idx_series_mesures_atelier_id ON series_mesures (atelier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_series_mesures_atelier_id_serie_unique ON series_mesures (atelier_id, id_serie_mesures);
CREATE INDEX IF NOT EXISTS idx_series_mesures_client ON series_mesures (id_client);
CREATE INDEX IF NOT EXISTS idx_series_mesures_atelier_client ON series_mesures (atelier_id, id_client);
CREATE INDEX IF NOT EXISTS idx_series_mesures_active ON series_mesures (id_client, type_vetement, est_active);

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
    SELECT 1 FROM pg_constraint WHERE conname = 'series_mesures_client_atelier_fk'
  ) THEN
    ALTER TABLE series_mesures
      ADD CONSTRAINT series_mesures_client_atelier_fk
      FOREIGN KEY (atelier_id, id_client)
      REFERENCES clients(atelier_id, id_client);
  END IF;
END $$;

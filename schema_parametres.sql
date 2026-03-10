-- Parametres Atelier (policy globale)
CREATE TABLE IF NOT EXISTS ateliers (
  id_atelier TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ateliers (id_atelier, nom, slug, actif)
VALUES ('ATELIER', 'Atelier historique', 'atelier-historique', true)
ON CONFLICT (id_atelier) DO NOTHING;

CREATE TABLE IF NOT EXISTS atelier_parametres (
  id INT,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  payload JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atelier_parametres_id_unique ON atelier_parametres (id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_atelier_parametres_atelier_unique ON atelier_parametres (atelier_id);
CREATE INDEX IF NOT EXISTS idx_atelier_parametres_atelier_id ON atelier_parametres (atelier_id);

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

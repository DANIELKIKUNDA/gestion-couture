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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'atelier_parametres'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'atelier_parametres'
        AND column_name = 'id'
    ) THEN
      ALTER TABLE atelier_parametres ADD COLUMN id INT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'atelier_parametres'
        AND column_name = 'atelier_id'
    ) THEN
      ALTER TABLE atelier_parametres ADD COLUMN atelier_id TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'atelier_parametres'
        AND column_name = 'payload'
    ) THEN
      ALTER TABLE atelier_parametres ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'atelier_parametres'
        AND column_name = 'version'
    ) THEN
      ALTER TABLE atelier_parametres ADD COLUMN version INT NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'atelier_parametres'
        AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE atelier_parametres ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'atelier_parametres'
        AND column_name = 'updated_by'
    ) THEN
      ALTER TABLE atelier_parametres ADD COLUMN updated_by TEXT;
    END IF;

    UPDATE atelier_parametres
    SET atelier_id = 'ATELIER'
    WHERE atelier_id IS NULL OR BTRIM(atelier_id) = '';

    ALTER TABLE atelier_parametres ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
    ALTER TABLE atelier_parametres ALTER COLUMN atelier_id SET NOT NULL;
  END IF;
END $$;

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

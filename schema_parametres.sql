-- Parametres Atelier (policy globale)
CREATE TABLE IF NOT EXISTS atelier_parametres (
  id INT PRIMARY KEY,
  payload JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

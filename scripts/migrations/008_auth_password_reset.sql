CREATE TABLE IF NOT EXISTS password_reset_token (
  id_token TEXT PRIMARY KEY,
  id_utilisateur TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expire_at TIMESTAMP NOT NULL,
  utilise BOOLEAN NOT NULL DEFAULT false,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_token (id_utilisateur);

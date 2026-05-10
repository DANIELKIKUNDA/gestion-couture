ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE retouches
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_atelier_idempotency
  ON clients (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_commandes_atelier_idempotency
  ON commandes (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_retouches_atelier_idempotency
  ON retouches (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_idempotency_lookup
  ON clients (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commandes_idempotency_lookup
  ON commandes (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_retouches_idempotency_lookup
  ON retouches (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

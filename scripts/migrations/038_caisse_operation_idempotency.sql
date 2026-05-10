ALTER TABLE caisse_operation
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_caisse_operation_atelier_idempotency
  ON caisse_operation (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caisse_operation_idempotency_lookup
  ON caisse_operation (atelier_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

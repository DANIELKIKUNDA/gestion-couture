-- Retouches intelligentes: base des types metier (idempotent)
ALTER TABLE retouches ADD COLUMN IF NOT EXISTS type_habit TEXT NULL;
ALTER TABLE retouches ADD COLUMN IF NOT EXISTS mesures_habit_snapshot JSONB NULL;

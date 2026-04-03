ALTER TABLE commande_items
ADD COLUMN IF NOT EXISTS mesures_snapshot_json JSONB NULL;

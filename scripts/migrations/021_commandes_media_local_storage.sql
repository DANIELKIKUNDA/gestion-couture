CREATE TABLE IF NOT EXISTS commande_media (
  id_media TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
  id_commande TEXT NOT NULL,
  type_media TEXT NOT NULL DEFAULT 'IMAGE',
  source_type TEXT NOT NULL DEFAULT 'UPLOAD',
  chemin_original TEXT NOT NULL,
  chemin_thumbnail TEXT NOT NULL,
  nom_fichier_original TEXT NULL,
  mime_type TEXT NOT NULL,
  extension_stockage TEXT NOT NULL,
  taille_originale_bytes INTEGER NOT NULL CHECK (taille_originale_bytes > 0),
  largeur INTEGER NULL,
  hauteur INTEGER NULL,
  note TEXT NULL,
  position INTEGER NOT NULL DEFAULT 1 CHECK (position BETWEEN 0 AND 3),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  cree_par TEXT NULL,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commande_media_atelier_commande
ON commande_media (atelier_id, id_commande, position);

CREATE INDEX IF NOT EXISTS idx_commande_media_commande
ON commande_media (id_commande);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_media_atelier_commande_position
ON commande_media (atelier_id, id_commande, position);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_media_primary_unique
ON commande_media (atelier_id, id_commande)
WHERE is_primary = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_media_atelier_fk'
  ) THEN
    ALTER TABLE commande_media
      ADD CONSTRAINT commande_media_atelier_fk
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_media_commande_atelier_fk'
  ) THEN
    ALTER TABLE commande_media
      ADD CONSTRAINT commande_media_commande_atelier_fk
      FOREIGN KEY (atelier_id, id_commande)
      REFERENCES commandes(atelier_id, id_commande)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commande_media_type_media_check'
  ) THEN
    ALTER TABLE commande_media
      ADD CONSTRAINT commande_media_type_media_check
      CHECK (type_media = 'IMAGE');
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE commande_media DROP CONSTRAINT IF EXISTS commande_media_position_check;
  ALTER TABLE commande_media
    ADD CONSTRAINT commande_media_position_check
    CHECK (position BETWEEN 0 AND 3);
END $$;

CREATE TABLE IF NOT EXISTS utilisateur_preferences (
  utilisateur_id TEXT PRIMARY KEY,
  atelier_id TEXT NOT NULL,
  page_accueil TEXT NOT NULL DEFAULT 'dashboard',
  restaurer_derniere_page BOOLEAN NOT NULL DEFAULT TRUE,
  date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT utilisateur_preferences_utilisateur_fk
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id_utilisateur) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_utilisateur_preferences_atelier
  ON utilisateur_preferences (atelier_id);

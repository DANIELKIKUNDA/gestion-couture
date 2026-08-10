-- Rend les preferences de demarrage explicites et ajoute le theme utilisateur.
-- Politique de migration: l'ancienne combinaison page_accueil + restaurer_derniere_page
-- etait ambigue. Pour les comptes existants, la page_accueil deja choisie devient
-- la source de verite au prochain demarrage. L'utilisateur peut ensuite choisir
-- explicitement le mode DERNIERE_PAGE dans Mon compte.

ALTER TABLE utilisateur_preferences
  ADD COLUMN IF NOT EXISTS mode_demarrage TEXT NOT NULL DEFAULT 'PAGE_ACCUEIL';

ALTER TABLE utilisateur_preferences
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'SYSTEME';

ALTER TABLE utilisateur_preferences
  ALTER COLUMN restaurer_derniere_page SET DEFAULT FALSE;

ALTER TABLE utilisateur_preferences
  ALTER COLUMN mode_demarrage SET DEFAULT 'PAGE_ACCUEIL';

ALTER TABLE utilisateur_preferences
  ALTER COLUMN theme SET DEFAULT 'SYSTEME';

-- L'ancien schema pouvait avoir restaurer_derniere_page=TRUE sans mode explicite.
-- ADD COLUMN remplit alors mode_demarrage avec PAGE_ACCUEIL. On aligne uniquement
-- le miroir legacy avec ce mode. Cette operation reste idempotente et ne touche
-- jamais un choix DERNIERE_PAGE effectue apres la migration.
UPDATE utilisateur_preferences
SET restaurer_derniere_page = FALSE
WHERE mode_demarrage = 'PAGE_ACCUEIL'
  AND restaurer_derniere_page IS DISTINCT FROM FALSE;

UPDATE utilisateur_preferences
SET theme = 'SYSTEME'
WHERE theme NOT IN ('SYSTEME', 'CLAIR', 'SOMBRE') OR theme IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'utilisateur_preferences_mode_demarrage_chk'
  ) THEN
    ALTER TABLE utilisateur_preferences
      ADD CONSTRAINT utilisateur_preferences_mode_demarrage_chk
      CHECK (mode_demarrage IN ('PAGE_ACCUEIL', 'DERNIERE_PAGE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'utilisateur_preferences_theme_chk'
  ) THEN
    ALTER TABLE utilisateur_preferences
      ADD CONSTRAINT utilisateur_preferences_theme_chk
      CHECK (theme IN ('SYSTEME', 'CLAIR', 'SOMBRE'));
  END IF;
END $$;

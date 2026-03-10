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
ON CONFLICT (id_atelier) DO UPDATE
SET
  nom = EXCLUDED.nom,
  slug = EXCLUDED.slug,
  actif = EXCLUDED.actif,
  updated_at = NOW();

ALTER TABLE clients ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE series_mesures ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE commande_events ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE retouches ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE retouche_events ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE caisse_jour ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE caisse_operation ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE caisse_bilan ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE stock_prix_historique ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE vente_lignes ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE atelier_parametres ADD COLUMN IF NOT EXISTS atelier_id TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS atelier_id TEXT NOT NULL DEFAULT 'ATELIER';

UPDATE utilisateurs
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE clients
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE series_mesures sm
SET atelier_id = COALESCE(NULLIF(c.atelier_id, ''), 'ATELIER')
FROM clients c
WHERE sm.id_client = c.id_client
  AND (sm.atelier_id IS NULL OR sm.atelier_id = '');

UPDATE series_mesures
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE commandes
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE commande_events ce
SET atelier_id = COALESCE(NULLIF(c.atelier_id, ''), 'ATELIER')
FROM commandes c
WHERE ce.id_commande = c.id_commande
  AND (ce.atelier_id IS NULL OR ce.atelier_id = '');

UPDATE commande_events
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE retouches
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE retouche_events re
SET atelier_id = COALESCE(NULLIF(r.atelier_id, ''), 'ATELIER')
FROM retouches r
WHERE re.id_retouche = r.id_retouche
  AND (re.atelier_id IS NULL OR re.atelier_id = '');

UPDATE retouche_events
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE caisse_jour
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE caisse_operation co
SET atelier_id = COALESCE(NULLIF(cj.atelier_id, ''), 'ATELIER')
FROM caisse_jour cj
WHERE co.id_caisse_jour = cj.id_caisse_jour
  AND (co.atelier_id IS NULL OR co.atelier_id = '');

UPDATE caisse_operation
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE caisse_bilan
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE articles
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE mouvements_stock ms
SET atelier_id = COALESCE(NULLIF(a.atelier_id, ''), 'ATELIER')
FROM articles a
WHERE ms.id_article = a.id_article
  AND (ms.atelier_id IS NULL OR ms.atelier_id = '');

UPDATE mouvements_stock
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE fournisseurs
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE stock_prix_historique sph
SET atelier_id = COALESCE(NULLIF(a.atelier_id, ''), 'ATELIER')
FROM articles a
WHERE sph.id_article = a.id_article
  AND (sph.atelier_id IS NULL OR sph.atelier_id = '');

UPDATE stock_prix_historique
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE ventes
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE vente_lignes vl
SET atelier_id = COALESCE(NULLIF(v.atelier_id, ''), 'ATELIER')
FROM ventes v
WHERE vl.id_vente = v.id_vente
  AND (vl.atelier_id IS NULL OR vl.atelier_id = '');

UPDATE vente_lignes
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE factures
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

UPDATE atelier_parametres
SET atelier_id = 'ATELIER'
WHERE atelier_id IS NULL OR atelier_id = '';

ALTER TABLE clients ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE clients ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE series_mesures ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE series_mesures ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE commandes ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE commandes ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE commande_events ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE commande_events ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE retouches ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE retouches ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE retouche_events ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE retouche_events ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE caisse_jour ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE caisse_jour ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE caisse_operation ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE caisse_operation ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE caisse_bilan ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE caisse_bilan ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE articles ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE articles ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE mouvements_stock ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE mouvements_stock ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE fournisseurs ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE fournisseurs ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE stock_prix_historique ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE stock_prix_historique ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE ventes ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE ventes ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE vente_lignes ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE vente_lignes ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE factures ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE factures ALTER COLUMN atelier_id SET NOT NULL;
ALTER TABLE atelier_parametres ALTER COLUMN atelier_id SET DEFAULT 'ATELIER';
ALTER TABLE atelier_parametres ALTER COLUMN atelier_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_atelier_id ON clients (atelier_id);
CREATE INDEX IF NOT EXISTS idx_series_mesures_atelier_id ON series_mesures (atelier_id);
CREATE INDEX IF NOT EXISTS idx_commandes_atelier_id ON commandes (atelier_id);
CREATE INDEX IF NOT EXISTS idx_commande_events_atelier_id ON commande_events (atelier_id);
CREATE INDEX IF NOT EXISTS idx_retouches_atelier_id ON retouches (atelier_id);
CREATE INDEX IF NOT EXISTS idx_retouche_events_atelier_id ON retouche_events (atelier_id);
CREATE INDEX IF NOT EXISTS idx_caisse_jour_atelier_id ON caisse_jour (atelier_id);
CREATE INDEX IF NOT EXISTS idx_caisse_operation_atelier_id ON caisse_operation (atelier_id);
CREATE INDEX IF NOT EXISTS idx_caisse_bilan_atelier_id ON caisse_bilan (atelier_id);
CREATE INDEX IF NOT EXISTS idx_articles_atelier_id ON articles (atelier_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_atelier_id ON mouvements_stock (atelier_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_atelier_id ON fournisseurs (atelier_id);
CREATE INDEX IF NOT EXISTS idx_stock_prix_historique_atelier_id ON stock_prix_historique (atelier_id);
CREATE INDEX IF NOT EXISTS idx_ventes_atelier_id ON ventes (atelier_id);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_atelier_id ON vente_lignes (atelier_id);
CREATE INDEX IF NOT EXISTS idx_factures_atelier_id ON factures (atelier_id);
CREATE INDEX IF NOT EXISTS idx_atelier_parametres_atelier_id ON atelier_parametres (atelier_id);

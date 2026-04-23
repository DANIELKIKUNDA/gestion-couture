ALTER TABLE commandes ADD COLUMN IF NOT EXISTS priorite TEXT;
UPDATE commandes
SET priorite = 'NORMALE'
WHERE priorite IS NULL OR BTRIM(priorite) = '';
ALTER TABLE commandes ALTER COLUMN priorite SET DEFAULT 'NORMALE';
ALTER TABLE commandes ALTER COLUMN priorite SET NOT NULL;
ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_priorite_check;
ALTER TABLE commandes
  ADD CONSTRAINT commandes_priorite_check
  CHECK (priorite IN ('NORMALE','URGENTE','TRES_URGENTE'));

ALTER TABLE retouches ADD COLUMN IF NOT EXISTS priorite TEXT;
UPDATE retouches
SET priorite = 'NORMALE'
WHERE priorite IS NULL OR BTRIM(priorite) = '';
ALTER TABLE retouches ALTER COLUMN priorite SET DEFAULT 'NORMALE';
ALTER TABLE retouches ALTER COLUMN priorite SET NOT NULL;
ALTER TABLE retouches DROP CONSTRAINT IF EXISTS retouches_priorite_check;
ALTER TABLE retouches
  ADD CONSTRAINT retouches_priorite_check
  CHECK (priorite IN ('NORMALE','URGENTE','TRES_URGENTE'));

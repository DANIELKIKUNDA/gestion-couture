-- Rend les corrections du cout d'achat moyen explicites et auditables.
-- Migration idempotente: les scripts de production sont rejoues a chaque deploiement.

ALTER TABLE public.stock_prix_historique
  ADD COLUMN IF NOT EXISTS type_prix TEXT;

ALTER TABLE public.stock_prix_historique
  ADD COLUMN IF NOT EXISTS motif_correction TEXT;

UPDATE public.stock_prix_historique
SET type_prix = 'VENTE'
WHERE type_prix IS NULL OR BTRIM(type_prix) = '';

ALTER TABLE public.stock_prix_historique
  ALTER COLUMN type_prix SET DEFAULT 'VENTE';

ALTER TABLE public.stock_prix_historique
  ALTER COLUMN type_prix SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_prix_historique_type_prix_check'
      AND conrelid = 'public.stock_prix_historique'::regclass
  ) THEN
    ALTER TABLE public.stock_prix_historique
      ADD CONSTRAINT stock_prix_historique_type_prix_check
      CHECK (type_prix IN ('VENTE', 'ACHAT_MOYEN'));
  END IF;
END
$$;

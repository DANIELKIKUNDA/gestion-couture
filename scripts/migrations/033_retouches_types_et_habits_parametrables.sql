DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.retouches'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type_retouche%'
  LOOP
    EXECUTE format('ALTER TABLE public.retouches DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retouches_type_habit_valide'
      AND conrelid = 'public.retouches'::regclass
  ) THEN
    ALTER TABLE public.retouches
      DROP CONSTRAINT retouches_type_habit_valide;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retouches_type_retouche_valide'
      AND conrelid = 'public.retouches'::regclass
  ) THEN
    ALTER TABLE public.retouches
      DROP CONSTRAINT retouches_type_retouche_valide;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retouches_type_retouche_valide'
      AND conrelid = 'public.retouches'::regclass
  ) THEN
    ALTER TABLE public.retouches
      ADD CONSTRAINT retouches_type_retouche_valide
      CHECK (type_retouche ~ '^[A-Z0-9_]+$') NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retouches_type_habit_valide'
      AND conrelid = 'public.retouches'::regclass
  ) THEN
    ALTER TABLE public.retouches
      ADD CONSTRAINT retouches_type_habit_valide
      CHECK (type_habit IS NULL OR type_habit ~ '^[A-Z0-9_]+$') NOT VALID;
  END IF;
END $$;

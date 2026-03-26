DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'utilisateurs'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.utilisateurs (
        id_utilisateur TEXT PRIMARY KEY,
        nom_complet TEXT NOT NULL,
        email TEXT NULL,
        telephone TEXT NULL,
        role TEXT NOT NULL,
        actif BOOLEAN NOT NULL DEFAULT true,
        mot_de_passe_hash TEXT NOT NULL,
        date_creation TIMESTAMP NOT NULL DEFAULT NOW()
      )
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'role_permission_atelier'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.role_permission_atelier (
        id_role_permission TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        permission_code TEXT NOT NULL,
        actif BOOLEAN NOT NULL DEFAULT true,
        date_creation TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(role, permission_code)
      )
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'utilisateurs'
      AND column_name = 'role'
  ) THEN
    EXECUTE 'UPDATE utilisateurs SET role = ''CAISSIER'' WHERE role = ''CAISSE''';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'utilisateurs'
      AND column_name = 'role_id'
  ) THEN
    EXECUTE 'UPDATE utilisateurs SET role_id = ''CAISSIER'' WHERE role_id = ''CAISSE''';
  END IF;
END $$;

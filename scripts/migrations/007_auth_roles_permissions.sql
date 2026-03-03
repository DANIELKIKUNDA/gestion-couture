CREATE TABLE IF NOT EXISTS utilisateurs (
  id_utilisateur TEXT PRIMARY KEY,
  nom_complet TEXT NOT NULL,
  email TEXT NULL,
  telephone TEXT NULL,
  role TEXT NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  mot_de_passe_hash TEXT NOT NULL,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permission_atelier (
  id_role_permission TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  date_creation TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(role, permission_code)
);

-- Full schema (concatenation of all BC schemas)
-- Order matters because several BCs define cross-table foreign keys.
\ir schema_parametres.sql
\ir schema_clients.sql
\ir schema_dossiers.sql
\ir schema_commandes.sql
\ir schema_retouches.sql
\ir schema_caisse.sql
\ir schema_stock.sql
\ir schema_facturation.sql

-- Full schema (concatenation of all BC schemas)
-- Order matters because several BCs define cross-table foreign keys.
\i schema_parametres.sql
\i schema_clients.sql
\i schema_commandes.sql
\i schema_retouches.sql
\i schema_caisse.sql
\i schema_stock.sql
\i schema_facturation.sql

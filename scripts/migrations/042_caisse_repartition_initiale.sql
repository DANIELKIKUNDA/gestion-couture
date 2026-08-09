CREATE TABLE IF NOT EXISTS caisse_repartition_initiale (
  atelier_id TEXT PRIMARY KEY,
  date_reference DATE NOT NULL,
  solde_ouverture_initial NUMERIC(14,2) NOT NULL,
  solde_atelier_initial NUMERIC(14,2) NOT NULL,
  solde_stock_initial NUMERIC(14,2) NOT NULL,
  configuree_par TEXT NULL,
  date_configuration TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Migration de fondation.
-- Elle rend le dossier scripts/migrations executable sur une base vide.
-- Les migrations suivantes restent des evolutions incrementales idempotentes.
\ir ../../schema_all.sql

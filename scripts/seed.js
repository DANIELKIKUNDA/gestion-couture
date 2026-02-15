import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "atelier"
});

async function run() {
  // Clients
  await pool.query(
    `INSERT INTO clients (id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation)
     VALUES ('CL-1','Doe','Jane','+221771234567','Dakar','F',true,NOW())
     ON CONFLICT (id_client) DO NOTHING`
  );

  // Commandes
  await pool.query(
    `INSERT INTO commandes (id_commande, id_client, description, date_creation, date_prevue, montant_total, montant_paye, statut)
     VALUES ('CMD-1','CL-1','Robe simple',NOW(),NOW() + interval '5 days',100,0,'CREEE')
     ON CONFLICT (id_commande) DO NOTHING`
  );

  // Retouches
  await pool.query(
    `INSERT INTO retouches (id_retouche, id_client, description, type_retouche, date_depot, date_prevue, montant_total, montant_paye, statut)
     VALUES ('RET-1','CL-1','Ourlet pantalon','OURLET',NOW(),NOW() + interval '2 days',50,0,'DEPOSEE')
     ON CONFLICT (id_retouche) DO NOTHING`
  );

  // Stock
  await pool.query(
    `INSERT INTO articles (id_article, nom_article, categorie_article, unite_stock, quantite_disponible, prix_vente_unitaire, seuil_alerte, actif)
     VALUES ('A-1','Tissu bleu','TISSU','METRE',10,15,5,true)
     ON CONFLICT (id_article) DO NOTHING`
  );

  // Caisse (today)
  const today = new Date().toISOString().slice(0, 10);
  const caisseId = `CJ-${today}`;
  await pool.query(
    `INSERT INTO caisse_jour (id_caisse_jour, date_jour, statut, solde_ouverture)
     VALUES ($1,$2,'OUVERTE',100)
     ON CONFLICT (id_caisse_jour) DO NOTHING`,
    [caisseId, today]
  );

  // Facture
  await pool.query(
    `INSERT INTO factures (id_facture, numero_facture, id_client, type_reference, id_reference, montant_total, montant_paye, type_facture, statut_facture)
     VALUES ('F-1','FAC-2026-0001','CL-1','COMMANDE','CMD-1',100,0,'GLOBALE','BROUILLON')
     ON CONFLICT (id_facture) DO NOTHING`
  );
}

run()
  .then(() => {
    console.log("Seed complete");
    return pool.end();
  })
  .catch((err) => {
    console.error(err);
    return pool.end().then(() => process.exit(1));
  });

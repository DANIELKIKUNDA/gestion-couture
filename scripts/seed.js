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
  // Parametres atelier
  const parametresPayload = {
    meta: { version: 1, lastSavedAt: new Date().toISOString() },
    identite: {
      nomAtelier: "Atelier",
      adresse: "",
      telephone: "",
      devise: "FC",
      logoUrl: ""
    },
    commandes: {
      mesuresObligatoires: true,
      interdictionSansMesures: true,
      uniteMesure: "cm",
      decimalesAutorisees: true,
      delaiDefautJours: 7
    },
    retouches: {
      mesuresOptionnelles: true,
      saisiePartielle: true,
      descriptionObligatoire: true
    },
    habits: {
      PANTALON: {
        label: "Pantalon",
        mesures: [
          { code: "longueur", label: "Longueur", obligatoire: true },
          { code: "tourTaille", label: "Tour taille", obligatoire: true }
        ]
      },
      CHEMISE: {
        label: "Chemise",
        mesures: [{ code: "poitrine", label: "Poitrine", obligatoire: true }]
      },
      ROBE: { label: "Robe", mesures: [] },
      JUPE: { label: "Jupe", mesures: [] },
      VESTE: { label: "Veste", mesures: [] },
      BOUBOU: { label: "Boubou", mesures: [] },
      GILET: { label: "Gilet", mesures: [] },
      LIBAYA: { label: "Libaya", mesures: [] },
      AUTRES: { label: "Autres", mesures: [] }
    },
    caisse: {
      ouvertureAuto: "07:30",
      ouvertureDimanche: "08:00",
      clotureAutoMinuit: true,
      paiementAvantLivraison: true,
      livraisonExpress: true
    },
    facturation: {
      prefixeNumero: "FAC",
      prochainNumero: 1,
      mentions: "Merci pour votre confiance.",
      afficherLogo: true
    },
    securite: {
      rolesAutorises: ["PROPRIETAIRE", "MANAGER"],
      confirmationAvantSauvegarde: true,
      verrouillageActif: true,
      auditLog: []
    }
  };

  await pool.query(
    `INSERT INTO atelier_parametres (id, payload, version, updated_at, updated_by)
     VALUES (1, $1, $2, NOW(), $3)
     ON CONFLICT (id) DO NOTHING`,
    [parametresPayload, 1, "seed"]
  );

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

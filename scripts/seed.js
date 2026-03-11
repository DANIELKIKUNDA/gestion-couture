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
  await pool.query(
    `INSERT INTO ateliers (id_atelier, nom, slug, actif)
     VALUES ('ATELIER', 'Atelier historique', 'atelier-historique', true)
     ON CONFLICT (id_atelier) DO NOTHING`
  );

  // Parametres atelier
  const parametresPayload = {
    meta: { version: 1, lastSavedAt: new Date().toISOString() },
    identite: {
      nomAtelier: "Atelier",
      adresse: "",
      telephone: "",
      email: "",
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
      descriptionObligatoire: true,
      typesRetouche: [
        {
          code: "OURLET_PANTALON",
          libelle: "Ourlet pantalon",
          necessiteMesures: true,
          mesuresCibles: ["LONGUEUR_PANTALON"],
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON"]
        },
        {
          code: "DIMINUER_LONGUEUR_PANTALON",
          libelle: "Diminuer longueur pantalon",
          necessiteMesures: true,
          mesuresCibles: ["LONGUEUR_PANTALON"],
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON"]
        },
        {
          code: "RESSERRER_TAILLE_PANTALON",
          libelle: "Resserrer taille pantalon",
          necessiteMesures: true,
          mesuresCibles: ["TOUR_HANCHE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON"]
        },
        {
          code: "AGRANDIR_TAILLE_PANTALON",
          libelle: "Agrandir taille pantalon",
          necessiteMesures: true,
          mesuresCibles: ["TOUR_HANCHE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON"]
        },
        {
          code: "AJUSTER_BAS_PANTALON",
          libelle: "Ajuster bas pantalon",
          necessiteMesures: true,
          mesuresCibles: ["TOUR_BAS_PANTALON"],
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON"]
        },
        {
          code: "RESSERRER_TAILLE_CHEMISE",
          libelle: "Resserrer taille chemise",
          necessiteMesures: true,
          mesuresCibles: ["TOUR_POITRINE", "LONGUEUR_CHEMISE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["CHEMISE"]
        },
        {
          code: "AGRANDIR_TAILLE_CHEMISE",
          libelle: "Agrandir taille chemise",
          necessiteMesures: true,
          mesuresCibles: ["TOUR_POITRINE", "LONGUEUR_CHEMISE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["CHEMISE"]
        },
        {
          code: "REDUIRE_MANCHES_CHEMISE",
          libelle: "Reduire manches chemise",
          necessiteMesures: true,
          mesuresCibles: ["LONGUEUR_MANCHE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["CHEMISE"]
        },
        {
          code: "RESSERRER_ROBE",
          libelle: "Resserrer robe",
          necessiteMesures: true,
          mesuresCibles: ["TOUR_POITRINE", "TOUR_HANCHE", "LONGUEUR_TOTALE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["ROBE"]
        },
        {
          code: "AGRANDIR_ROBE",
          libelle: "Agrandir robe",
          necessiteMesures: true,
          mesuresCibles: ["TOUR_POITRINE", "TOUR_HANCHE", "LONGUEUR_TOTALE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["ROBE"]
        },
        {
          code: "AJUSTER_LONGUEUR_ROBE",
          libelle: "Ajuster longueur robe",
          necessiteMesures: true,
          mesuresCibles: ["LONGUEUR_TOTALE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["ROBE"]
        },
        {
          code: "REPARATION_DECHIRURE",
          libelle: "Reparation dechirure",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: true,
          habitsCompatibles: ["*"]
        },
        {
          code: "REMPLACER_FERMETURE",
          libelle: "Remplacer fermeture",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON", "JUPE", "ROBE"]
        },
        {
          code: "SURFILAGE",
          libelle: "Surfilage",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "POSER_BOUTON",
          libelle: "Poser bouton",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "BRODERIE",
          libelle: "Broderie",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: true,
          habitsCompatibles: ["*"]
        },
        {
          code: "REPARATION",
          libelle: "Reparation",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "ZIGZAG",
          libelle: "Zigzag",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "AUTRES",
          libelle: "Autres",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "OURLET",
          libelle: "Ourlet (legacy)",
          necessiteMesures: true,
          mesuresCibles: ["LONGUEUR"],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "RESSERRAGE",
          libelle: "Resserrage (legacy)",
          necessiteMesures: true,
          mesuresCibles: ["TAILLE", "HANCHE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "AGRANDISSEMENT",
          libelle: "Agrandissement (legacy)",
          necessiteMesures: true,
          mesuresCibles: ["TAILLE", "HANCHE"],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "FERMETURE",
          libelle: "Fermeture (legacy)",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        },
        {
          code: "AUTRE",
          libelle: "Autre (legacy)",
          necessiteMesures: false,
          mesuresCibles: [],
          descriptionObligatoire: false,
          habitsCompatibles: ["*"]
        }
      ]
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
      finSemaine: "DIMANCHE",
      clotureAutoMinuit: true,
      paiementAvantLivraison: true,
      livraisonExpress: true
    },
    facturation: {
      prefixeNumero: "FAC",
      mentions: "Merci pour votre confiance.",
      afficherLogo: true
    },
    securite: {
      rolesAutorises: ["PROPRIETAIRE"],
      confirmationAvantSauvegarde: true,
      verrouillageActif: true,
      auditLog: []
    }
  };

  await pool.query(
    `INSERT INTO atelier_parametres (id, atelier_id, payload, version, updated_at, updated_by)
     VALUES (COALESCE((SELECT MAX(ap.id) + 1 FROM atelier_parametres ap), 1), 'ATELIER', $1, $2, NOW(), $3)
     ON CONFLICT (atelier_id) DO NOTHING`,
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

import { pool } from "../../../shared/infrastructure/db.js";
import { Dossier } from "../../domain/dossier.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function buildFullName(nom, prenom) {
  return `${String(nom || "").trim()} ${String(prenom || "").trim()}`.trim();
}

function buildEntityIdentity({ idClient = "", nom = "", prenom = "", telephone = "" } = {}) {
  return {
    idClient: normalizeText(idClient) || null,
    nom: normalizeText(nom),
    prenom: normalizeText(prenom),
    telephone: normalizeText(telephone),
    nomComplet: buildFullName(nom, prenom)
  };
}

function isoDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isCommandeClosed(statut) {
  return statut === "LIVREE" || statut === "ANNULEE";
}

function isRetoucheClosed(statut) {
  return statut === "LIVREE" || statut === "ANNULEE";
}

function buildCommandeFlags(row) {
  const statut = String(row.statut || "").trim().toUpperCase();
  const soldeRestant = Math.max(0, Number(row.montant_total || 0) - Number(row.montant_paye || 0));
  const today = new Date().toISOString().slice(0, 10);
  const datePrevue = isoDateOnly(row.date_prevue);
  return {
    enRetard: Boolean(datePrevue && datePrevue < today && !isCommandeClosed(statut)),
    termineeNonLivree: statut === "TERMINEE",
    soldeOuvert: soldeRestant > 0
  };
}

function buildRetoucheFlags(row) {
  const statut = String(row.statut || "").trim().toUpperCase();
  const soldeRestant = Math.max(0, Number(row.montant_total || 0) - Number(row.montant_paye || 0));
  const today = new Date().toISOString().slice(0, 10);
  const datePrevue = isoDateOnly(row.date_prevue);
  return {
    enRetard: Boolean(datePrevue && datePrevue < today && !isRetoucheClosed(statut)),
    termineeNonLivree: statut === "TERMINEE",
    soldeOuvert: soldeRestant > 0
  };
}

function mapSummaryRow(row) {
  return {
    idDossier: row.id_dossier,
    idResponsableClient: row.id_responsable_client,
    responsable: buildEntityIdentity({
      idClient: row.id_responsable_client,
      nom: row.nom_responsable_snapshot,
      prenom: row.prenom_responsable_snapshot,
      telephone: row.telephone_responsable_snapshot
    }),
    typeDossier: row.type_dossier,
    statutDossier: row.statut,
    notes: row.notes || "",
    dateCreation: row.date_creation,
    dateDerniereActivite: row.date_derniere_activite,
    totalCommandes: Number(row.total_commandes || 0),
    totalRetouches: Number(row.total_retouches || 0),
    totalMontant: Number(row.total_montant || 0),
    totalPaye: Number(row.total_paye || 0),
    soldeRestant: Math.max(0, Number(row.total_montant || 0) - Number(row.total_paye || 0))
  };
}

function mapCommandeRow(row) {
  const soldeRestant = Math.max(0, Number(row.montant_total || 0) - Number(row.montant_paye || 0));
  return {
    idCommande: row.id_commande,
    idClient: row.id_client,
    dossierId: row.id_dossier || null,
    clientPayeurId: row.id_client,
    clientNom: buildFullName(row.client_nom, row.client_prenom) || null,
    descriptionCommande: row.description,
    dateCreation: row.date_creation,
    datePrevue: row.date_prevue,
    montantTotal: Number(row.montant_total || 0),
    montantPaye: Number(row.montant_paye || 0),
    soldeRestant,
    statutCommande: row.statut,
    typeHabit: row.type_habit || "",
    items: [],
    nombreLignes: Number(row.nombre_lignes || 0),
    nombreBeneficiaires: Number(row.nombre_beneficiaires || 0),
    beneficiairesResume: [],
    flagsMetier: buildCommandeFlags(row)
  };
}

function mapRetoucheRow(row) {
  const soldeRestant = Math.max(0, Number(row.montant_total || 0) - Number(row.montant_paye || 0));
  return {
    idRetouche: row.id_retouche,
    idClient: row.id_client,
    dossierId: row.id_dossier || null,
    clientNom: buildFullName(row.client_nom, row.client_prenom) || null,
    descriptionRetouche: row.description,
    typeRetouche: row.type_retouche,
    dateDepot: row.date_depot,
    datePrevue: row.date_prevue,
    montantTotal: Number(row.montant_total || 0),
    montantPaye: Number(row.montant_paye || 0),
    soldeRestant,
    statutRetouche: row.statut,
    typeHabit: row.type_habit || "",
    items: [],
    beneficiaire: buildEntityIdentity({
      idClient: row.id_client,
      nom: row.client_nom,
      prenom: row.client_prenom,
      telephone: row.client_telephone
    }),
    flagsMetier: buildRetoucheFlags(row)
  };
}

function attachCommandeBeneficiaires(commandes, commandeLignesRows) {
  const byCommande = new Map(commandes.map((commande) => [commande.idCommande, []]));
  for (const row of commandeLignesRows || []) {
    const items = byCommande.get(row.id_commande);
    if (!items) continue;
    items.push({
      idClient: normalizeText(row.id_client) || null,
      nomComplet: buildFullName(row.nom_affiche || row.client_nom, row.prenom_affiche || row.client_prenom),
      telephone: normalizeText(row.client_telephone),
      role: row.role,
      typeHabit: row.type_habit || ""
    });
  }

  for (const commande of commandes) {
    const beneficiaires = byCommande.get(commande.idCommande) || [];
    if (beneficiaires.length > 0) {
      commande.beneficiairesResume = beneficiaires;
      continue;
    }
    commande.beneficiairesResume = [
      {
        idClient: normalizeText(commande.clientPayeurId) || null,
        nomComplet: commande.clientNom || "",
        telephone: "",
        role: "PAYEUR_BENEFICIAIRE",
        typeHabit: commande.typeHabit || ""
      }
    ].filter((row) => row.nomComplet || row.idClient);
  }
}

function attachCommandeItems(commandes, itemRows) {
  const byCommande = new Map(commandes.map((commande) => [commande.idCommande, []]));
  for (const row of itemRows || []) {
    const items = byCommande.get(row.id_commande);
    if (!items) continue;
    items.push({
      idItem: row.id_item,
      idCommande: row.id_commande,
      typeHabit: row.type_habit || "",
      description: row.description || "",
      prix: Number(row.prix || 0),
      ordreAffichage: Number(row.ordre_affichage || 1),
      dateCreation: row.date_creation
    });
  }
  for (const commande of commandes) {
    if ((byCommande.get(commande.idCommande) || []).length > 0) {
      commande.items = byCommande.get(commande.idCommande) || [];
      commande.nombreLignes = commande.items.length;
      continue;
    }
    commande.items = commande.typeHabit
      ? [{
          idItem: `LEGACY-${commande.idCommande}`,
          idCommande: commande.idCommande,
          typeHabit: commande.typeHabit,
          description: commande.descriptionCommande || "",
          prix: Number(commande.montantTotal || 0),
          ordreAffichage: 1,
          dateCreation: commande.dateCreation
        }]
      : [];
    commande.nombreLignes = commande.items.length;
  }
}

function attachRetoucheItems(retouches, itemRows) {
  const byRetouche = new Map(retouches.map((retouche) => [retouche.idRetouche, []]));
  for (const row of itemRows || []) {
    const items = byRetouche.get(row.id_retouche);
    if (!items) continue;
    items.push({
      idItem: row.id_item,
      idRetouche: row.id_retouche,
      typeRetouche: row.type_retouche || "",
      description: row.description || "",
      prix: Number(row.prix || 0),
      ordreAffichage: Number(row.ordre_affichage || 1),
      dateCreation: row.date_creation
    });
  }
  for (const retouche of retouches) {
    if ((byRetouche.get(retouche.idRetouche) || []).length > 0) {
      retouche.items = byRetouche.get(retouche.idRetouche) || [];
      continue;
    }
    retouche.items = retouche.typeRetouche
      ? [{
          idItem: `LEGACY-${retouche.idRetouche}`,
          idRetouche: retouche.idRetouche,
          typeRetouche: retouche.typeRetouche,
          description: retouche.descriptionRetouche || "",
          prix: Number(retouche.montantTotal || 0),
          ordreAffichage: 1,
          dateCreation: retouche.dateDepot
        }]
      : [];
  }
}

function buildSynthese(base, commandes, retouches) {
  const participants = new Set();

  for (const commande of commandes) {
    for (const beneficiaire of commande.beneficiairesResume || []) {
      const key = normalizeText(beneficiaire.idClient) || normalizeText(beneficiaire.nomComplet).toLowerCase();
      if (key) participants.add(key);
    }
  }

  for (const retouche of retouches) {
    const beneficiaire = retouche.beneficiaire || {};
    const key = normalizeText(beneficiaire.idClient) || normalizeText(beneficiaire.nomComplet).toLowerCase();
    if (key) participants.add(key);
  }

  const documentsAvecSolde =
    commandes.filter((commande) => isPositiveNumber(commande.soldeRestant)).length +
    retouches.filter((retouche) => isPositiveNumber(retouche.soldeRestant)).length;

  return {
    totalBeneficiaires: participants.size,
    documentsAvecSolde,
    commandesEnCours: commandes.filter((commande) => !isCommandeClosed(commande.statutCommande) && commande.statutCommande !== "TERMINEE").length,
    retouchesEnCours: retouches.filter((retouche) => !isRetoucheClosed(retouche.statutRetouche) && retouche.statutRetouche !== "TERMINEE").length,
    totalMontant: Number(base.totalMontant || 0),
    totalPaye: Number(base.totalPaye || 0),
    soldeRestant: Math.max(0, Number(base.soldeRestant || 0)),
    derniereActivite: base.dateDerniereActivite || null
  };
}

async function queryIfTableExists(db, tableName, sql, params) {
  const exists = await db.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${tableName}`]);
  if (!exists.rows[0]?.exists) {
    return { rows: [] };
  }
  return db.query(sql, params);
}

export class DossierRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new DossierRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new DossierRepoPg(this.atelierId, db || pool);
  }

  async getById(idDossier) {
    const res = await this.db.query(
      `SELECT id_dossier, id_responsable_client, nom_responsable_snapshot, prenom_responsable_snapshot,
              telephone_responsable_snapshot, type_dossier, statut, notes, cree_par, modifie_par_dernier,
              date_creation, date_derniere_activite
       FROM dossiers
       WHERE atelier_id = $1 AND id_dossier = $2`,
      [this.atelierId, idDossier]
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return new Dossier({
      idDossier: row.id_dossier,
      idResponsableClient: row.id_responsable_client,
      nomResponsableSnapshot: row.nom_responsable_snapshot,
      prenomResponsableSnapshot: row.prenom_responsable_snapshot,
      telephoneResponsableSnapshot: row.telephone_responsable_snapshot,
      typeDossier: row.type_dossier,
      statut: row.statut,
      notes: row.notes,
      creePar: row.cree_par,
      modifieParDernier: row.modifie_par_dernier,
      dateCreation: row.date_creation,
      dateDerniereActivite: row.date_derniere_activite
    });
  }

  async save(dossier) {
    await this.db.query(
      `INSERT INTO dossiers (
         id_dossier,
         atelier_id,
         id_responsable_client,
         nom_responsable_snapshot,
         prenom_responsable_snapshot,
         telephone_responsable_snapshot,
         type_dossier,
         statut,
         notes,
         cree_par,
         modifie_par_dernier,
         date_creation,
         date_derniere_activite
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id_dossier)
       DO UPDATE SET
         atelier_id = $2,
         id_responsable_client = $3,
         nom_responsable_snapshot = $4,
         prenom_responsable_snapshot = $5,
         telephone_responsable_snapshot = $6,
         type_dossier = $7,
         statut = $8,
         notes = $9,
         cree_par = $10,
         modifie_par_dernier = $11,
         date_creation = $12,
         date_derniere_activite = $13`,
      [
        dossier.idDossier,
        this.atelierId,
        dossier.idResponsableClient,
        dossier.nomResponsableSnapshot,
        dossier.prenomResponsableSnapshot,
        dossier.telephoneResponsableSnapshot,
        dossier.typeDossier,
        dossier.statut,
        dossier.notes || null,
        dossier.creePar,
        dossier.modifieParDernier,
        dossier.dateCreation,
        dossier.dateDerniereActivite
      ]
    );
  }

  async touch(idDossier, modifiePar = null) {
    const normalizedId = normalizeText(idDossier);
    if (!normalizedId) return;
    await this.db.query(
      `UPDATE dossiers
       SET date_derniere_activite = NOW(),
           modifie_par_dernier = COALESCE($3, modifie_par_dernier)
       WHERE atelier_id = $1 AND id_dossier = $2`,
      [this.atelierId, normalizedId, normalizeText(modifiePar) || null]
    );
  }

  async listSummaries() {
    const res = await this.db.query(
      `SELECT d.id_dossier,
              d.id_responsable_client,
              d.nom_responsable_snapshot,
              d.prenom_responsable_snapshot,
              d.telephone_responsable_snapshot,
              d.type_dossier,
              d.statut,
              d.notes,
              d.date_creation,
              d.date_derniere_activite,
              COALESCE((
                SELECT COUNT(*)::int
                FROM commandes c
                WHERE c.atelier_id = d.atelier_id
                  AND c.id_dossier = d.id_dossier
              ), 0) AS total_commandes,
              COALESCE((
                SELECT COUNT(*)::int
                FROM retouches r
                WHERE r.atelier_id = d.atelier_id
                  AND r.id_dossier = d.id_dossier
              ), 0) AS total_retouches,
              COALESCE((
                SELECT SUM(c.montant_total)
                FROM commandes c
                WHERE c.atelier_id = d.atelier_id
                  AND c.id_dossier = d.id_dossier
              ), 0)
              +
              COALESCE((
                SELECT SUM(r.montant_total)
                FROM retouches r
                WHERE r.atelier_id = d.atelier_id
                  AND r.id_dossier = d.id_dossier
              ), 0) AS total_montant,
              COALESCE((
                SELECT SUM(c.montant_paye)
                FROM commandes c
                WHERE c.atelier_id = d.atelier_id
                  AND c.id_dossier = d.id_dossier
              ), 0)
              +
              COALESCE((
                SELECT SUM(r.montant_paye)
                FROM retouches r
                WHERE r.atelier_id = d.atelier_id
                  AND r.id_dossier = d.id_dossier
              ), 0) AS total_paye
       FROM dossiers d
       WHERE d.atelier_id = $1
       ORDER BY d.date_derniere_activite DESC, d.date_creation DESC`,
      [this.atelierId]
    );
    return res.rows.map(mapSummaryRow);
  }

  async getDetail(idDossier) {
    const dossier = await this.getById(idDossier);
    if (!dossier) return null;

    const [summaryList, commandesRes, commandeLignesRes, commandeItemsRes, retouchesRes, retoucheItemsRes] = await Promise.all([
      this.db.query(
        `SELECT d.id_dossier,
                d.id_responsable_client,
                d.nom_responsable_snapshot,
                d.prenom_responsable_snapshot,
                d.telephone_responsable_snapshot,
                d.type_dossier,
                d.statut,
                d.notes,
                d.date_creation,
                d.date_derniere_activite,
                COALESCE((
                  SELECT COUNT(*)::int
                  FROM commandes c
                  WHERE c.atelier_id = d.atelier_id
                    AND c.id_dossier = d.id_dossier
                ), 0) AS total_commandes,
                COALESCE((
                  SELECT COUNT(*)::int
                  FROM retouches r
                  WHERE r.atelier_id = d.atelier_id
                    AND r.id_dossier = d.id_dossier
                ), 0) AS total_retouches,
                COALESCE((
                  SELECT SUM(c.montant_total)
                  FROM commandes c
                  WHERE c.atelier_id = d.atelier_id
                    AND c.id_dossier = d.id_dossier
                ), 0)
                +
                COALESCE((
                  SELECT SUM(r.montant_total)
                  FROM retouches r
                  WHERE r.atelier_id = d.atelier_id
                    AND r.id_dossier = d.id_dossier
                ), 0) AS total_montant,
                COALESCE((
                  SELECT SUM(c.montant_paye)
                  FROM commandes c
                  WHERE c.atelier_id = d.atelier_id
                    AND c.id_dossier = d.id_dossier
                ), 0)
                +
                COALESCE((
                  SELECT SUM(r.montant_paye)
                  FROM retouches r
                  WHERE r.atelier_id = d.atelier_id
                    AND r.id_dossier = d.id_dossier
                ), 0) AS total_paye
         FROM dossiers d
         WHERE d.atelier_id = $1
           AND d.id_dossier = $2`,
        [this.atelierId, idDossier]
      ),
      this.db.query(
        `SELECT c.id_commande,
                c.id_client,
                c.id_dossier,
                c.description,
                c.date_creation,
                c.date_prevue,
                c.montant_total,
                c.montant_paye,
                c.statut,
                c.type_habit,
                cl.nom AS client_nom,
                cl.prenom AS client_prenom,
                COALESCE((
                  SELECT COUNT(*)::int
                  FROM commande_lignes l
                  WHERE l.atelier_id = c.atelier_id
                    AND l.id_commande = c.id_commande
                ), CASE WHEN c.type_habit IS NOT NULL THEN 1 ELSE 0 END) AS nombre_lignes,
                COALESCE((
                  SELECT COUNT(DISTINCT COALESCE(NULLIF(l.id_client, ''), LOWER(TRIM(l.nom_affiche)) || '::' || LOWER(TRIM(l.prenom_affiche))))::int
                  FROM commande_lignes l
                  WHERE l.atelier_id = c.atelier_id
                    AND l.id_commande = c.id_commande
                ), CASE WHEN c.id_client IS NOT NULL THEN 1 ELSE 0 END) AS nombre_beneficiaires
         FROM commandes c
         LEFT JOIN clients cl ON cl.id_client = c.id_client AND cl.atelier_id = c.atelier_id
         WHERE c.atelier_id = $1
           AND c.id_dossier = $2
         ORDER BY c.date_creation DESC`,
        [this.atelierId, idDossier]
      ),
      this.db.query(
        `SELECT l.id_commande,
                l.id_client,
                l.role,
                l.nom_affiche,
                l.prenom_affiche,
                l.type_habit,
                c.telephone AS client_telephone,
                c.nom AS client_nom,
                c.prenom AS client_prenom
         FROM commande_lignes l
         LEFT JOIN clients c ON c.id_client = l.id_client AND c.atelier_id = l.atelier_id
         WHERE l.atelier_id = $1
           AND l.id_commande IN (
             SELECT id_commande
             FROM commandes
             WHERE atelier_id = $1
               AND id_dossier = $2
           )
         ORDER BY l.id_commande ASC, l.ordre_affichage ASC, l.date_creation ASC`,
        [this.atelierId, idDossier]
      ),
      queryIfTableExists(
        this.db,
        "commande_items",
        `SELECT id_item, id_commande, type_habit, description, prix, ordre_affichage, date_creation
         FROM commande_items
         WHERE atelier_id = $1
           AND id_commande IN (
             SELECT id_commande
             FROM commandes
             WHERE atelier_id = $1
               AND id_dossier = $2
           )
         ORDER BY id_commande ASC, ordre_affichage ASC, date_creation ASC`,
        [this.atelierId, idDossier]
      ),
      this.db.query(
        `SELECT r.id_retouche,
                r.id_client,
                r.id_dossier,
                r.description,
                r.type_retouche,
                r.date_depot,
                r.date_prevue,
                r.montant_total,
                r.montant_paye,
                r.statut,
                r.type_habit,
                c.nom AS client_nom,
                c.prenom AS client_prenom,
                c.telephone AS client_telephone
         FROM retouches r
         LEFT JOIN clients c ON c.id_client = r.id_client AND c.atelier_id = r.atelier_id
         WHERE r.atelier_id = $1
           AND r.id_dossier = $2
        ORDER BY r.date_depot DESC`,
        [this.atelierId, idDossier]
      ),
      queryIfTableExists(
        this.db,
        "retouche_items",
        `SELECT id_item, id_retouche, type_retouche, description, prix, ordre_affichage, date_creation
         FROM retouche_items
         WHERE atelier_id = $1
           AND id_retouche IN (
             SELECT id_retouche
             FROM retouches
             WHERE atelier_id = $1
               AND id_dossier = $2
           )
         ORDER BY id_retouche ASC, ordre_affichage ASC, date_creation ASC`,
        [this.atelierId, idDossier]
      )
    ]);

    const summary = summaryList.rows[0] ? mapSummaryRow(summaryList.rows[0]) : null;
    const commandes = commandesRes.rows.map(mapCommandeRow);
    attachCommandeBeneficiaires(commandes, commandeLignesRes.rows);
    attachCommandeItems(commandes, commandeItemsRes.rows);
    const retouches = retouchesRes.rows.map(mapRetoucheRow);
    attachRetoucheItems(retouches, retoucheItemsRes.rows);
    const base = summary || mapSummaryRow({
      id_dossier: dossier.idDossier,
      id_responsable_client: dossier.idResponsableClient,
      nom_responsable_snapshot: dossier.nomResponsableSnapshot,
      prenom_responsable_snapshot: dossier.prenomResponsableSnapshot,
      telephone_responsable_snapshot: dossier.telephoneResponsableSnapshot,
      type_dossier: dossier.typeDossier,
      statut: dossier.statut,
      notes: dossier.notes,
      date_creation: dossier.dateCreation,
      date_derniere_activite: dossier.dateDerniereActivite,
      total_commandes: 0,
      total_retouches: 0,
      total_montant: 0,
      total_paye: 0
    });
    return {
      ...base,
      synthese: buildSynthese(base, commandes, retouches),
      commandes,
      retouches
    };
  }
}

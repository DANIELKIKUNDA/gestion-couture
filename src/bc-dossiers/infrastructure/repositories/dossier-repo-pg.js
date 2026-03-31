import { pool } from "../../../shared/infrastructure/db.js";
import { Dossier } from "../../domain/dossier.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function mapSummaryRow(row) {
  return {
    idDossier: row.id_dossier,
    idResponsableClient: row.id_responsable_client,
    responsable: {
      idClient: row.id_responsable_client,
      nom: row.nom_responsable_snapshot || "",
      prenom: row.prenom_responsable_snapshot || "",
      telephone: row.telephone_responsable_snapshot || "",
      nomComplet: `${String(row.nom_responsable_snapshot || "").trim()} ${String(row.prenom_responsable_snapshot || "").trim()}`.trim()
    },
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
  return {
    idCommande: row.id_commande,
    idClient: row.id_client,
    dossierId: row.id_dossier || null,
    clientPayeurId: row.id_client,
    descriptionCommande: row.description,
    dateCreation: row.date_creation,
    datePrevue: row.date_prevue,
    montantTotal: Number(row.montant_total || 0),
    montantPaye: Number(row.montant_paye || 0),
    statutCommande: row.statut,
    typeHabit: row.type_habit || "",
    nombreLignes: Number(row.nombre_lignes || 0),
    nombreBeneficiaires: Number(row.nombre_beneficiaires || 0)
  };
}

function mapRetoucheRow(row) {
  return {
    idRetouche: row.id_retouche,
    idClient: row.id_client,
    dossierId: row.id_dossier || null,
    descriptionRetouche: row.description,
    typeRetouche: row.type_retouche,
    dateDepot: row.date_depot,
    datePrevue: row.date_prevue,
    montantTotal: Number(row.montant_total || 0),
    montantPaye: Number(row.montant_paye || 0),
    statutRetouche: row.statut,
    typeHabit: row.type_habit || ""
  };
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

    const [summaryList, commandesRes, retouchesRes] = await Promise.all([
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
         WHERE c.atelier_id = $1
           AND c.id_dossier = $2
         ORDER BY c.date_creation DESC`,
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
                r.type_habit
         FROM retouches r
         WHERE r.atelier_id = $1
           AND r.id_dossier = $2
         ORDER BY r.date_depot DESC`,
        [this.atelierId, idDossier]
      )
    ]);

    const summary = summaryList.rows[0] ? mapSummaryRow(summaryList.rows[0]) : null;
    return {
      ...(summary || mapSummaryRow({
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
      })),
      commandes: commandesRes.rows.map(mapCommandeRow),
      retouches: retouchesRes.rows.map(mapRetoucheRow)
    };
  }
}

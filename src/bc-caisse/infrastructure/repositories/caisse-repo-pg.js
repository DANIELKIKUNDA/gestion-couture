import { pool } from "../../../shared/infrastructure/db.js";
import { CaisseJour } from "../../domain/caisse-jour.js";

function normalizePgDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value || "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : text;
}

export class CaisseRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new CaisseRepoPg(atelierId);
  }

  async getById(idCaisseJour) {
    const res = await pool.query(
      "SELECT id_caisse_jour, date_jour, statut, solde_ouverture, solde_cloture, ouverte_par, cloturee_par, date_ouverture, date_cloture, ouverture_anticipee, motif_ouverture_anticipee, autorisee_par FROM caisse_jour WHERE id_caisse_jour = $1 AND atelier_id = $2",
      [idCaisseJour, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const opRes = await pool.query(
      "SELECT id_operation, type_operation, montant, mode_paiement, motif, reference_metier, date_operation, effectue_par, statut_operation, motif_annulation, annulee_par, date_annulation, type_depense, justification, impact_journalier, impact_global FROM caisse_operation WHERE id_caisse_jour = $1 AND atelier_id = $2",
      [idCaisseJour, this.atelierId]
    );

    const row = res.rows[0];
    return new CaisseJour({
      idCaisseJour: row.id_caisse_jour,
      date: normalizePgDateOnly(row.date_jour),
      statutCaisse: row.statut,
      soldeOuverture: Number(row.solde_ouverture),
      soldeCloture: row.solde_cloture === null ? null : Number(row.solde_cloture),
      ouvertePar: row.ouverte_par,
      clotureePar: row.cloturee_par,
      dateOuverture: row.date_ouverture,
      dateCloture: row.date_cloture,
      ouvertureAnticipee: row.ouverture_anticipee === true,
      motifOuvertureAnticipee: row.motif_ouverture_anticipee,
      autoriseePar: row.autorisee_par,
      operations: opRes.rows.map((op) => ({
        idOperation: op.id_operation,
        typeOperation: op.type_operation,
        montant: Number(op.montant),
        modePaiement: op.mode_paiement,
        motif: op.motif,
        referenceMetier: op.reference_metier,
        dateOperation: op.date_operation,
        effectuePar: op.effectue_par,
        statutOperation: op.statut_operation,
        motifAnnulation: op.motif_annulation,
        annuleePar: op.annulee_par,
        dateAnnulation: op.date_annulation,
        typeDepense: op.type_depense,
        justification: op.justification,
        impactJournalier: op.impact_journalier === null ? null : op.impact_journalier === true,
        impactGlobal: op.impact_global === null ? null : op.impact_global === true
      }))
    });
  }

  async getByDate(dateJour) {
    const res = await pool.query(
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour = $1 AND atelier_id = $2 LIMIT 1",
      [dateJour, this.atelierId]
    );
    if (res.rowCount === 0) return null;
    return this.getById(res.rows[0].id_caisse_jour);
  }

  async getLatestBeforeDate(dateJour) {
    const res = await pool.query(
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour < $1 AND atelier_id = $2 ORDER BY date_jour DESC LIMIT 1",
      [dateJour, this.atelierId]
    );
    if (res.rowCount === 0) return null;
    return this.getById(res.rows[0].id_caisse_jour);
  }

  async listBeforeDate(dateJour, limit = 60) {
    const res = await pool.query(
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour < $1 AND atelier_id = $2 ORDER BY date_jour DESC LIMIT $3",
      [dateJour, this.atelierId, limit]
    );
    const items = [];
    for (const row of res.rows) {
      const caisse = await this.getById(row.id_caisse_jour);
      if (caisse) items.push(caisse);
    }
    return items;
  }

  async listByDateRange(dateDebut, dateFin) {
    const res = await pool.query(
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour >= $1 AND date_jour <= $2 AND atelier_id = $3 ORDER BY date_jour ASC",
      [dateDebut, dateFin, this.atelierId]
    );
    const items = [];
    for (const row of res.rows) {
      const caisse = await this.getById(row.id_caisse_jour);
      if (caisse) items.push(caisse);
    }
    return items;
  }

  async save(caisse) {
    await pool.query(
      `INSERT INTO caisse_jour (id_caisse_jour, atelier_id, date_jour, statut, solde_ouverture, solde_cloture, ouverte_par, cloturee_par, date_ouverture, date_cloture, ouverture_anticipee, motif_ouverture_anticipee, autorisee_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id_caisse_jour)
       DO UPDATE SET atelier_id=$2, date_jour=$3, statut=$4, solde_ouverture=$5, solde_cloture=$6, ouverte_par=$7, cloturee_par=$8, date_ouverture=$9, date_cloture=$10, ouverture_anticipee=$11, motif_ouverture_anticipee=$12, autorisee_par=$13`,
      [
        caisse.idCaisseJour,
        this.atelierId,
        caisse.date,
        caisse.statutCaisse,
        caisse.soldeOuverture,
        caisse.soldeCloture,
        caisse.ouvertePar,
        caisse.clotureePar,
        caisse.dateOuverture,
        caisse.dateCloture,
        caisse.ouvertureAnticipee === true,
        caisse.motifOuvertureAnticipee,
        caisse.autoriseePar
      ]
    );

    // Persist operations (upsert by id_operation)
    for (const op of caisse.operations) {
      await pool.query(
        `INSERT INTO caisse_operation (id_operation, atelier_id, id_caisse_jour, type_operation, montant, mode_paiement, motif, reference_metier, date_operation, effectue_par, statut_operation, motif_annulation, annulee_par, date_annulation, type_depense, justification, impact_journalier, impact_global)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id_operation)
         DO UPDATE SET atelier_id=$2, type_operation=$4, montant=$5, mode_paiement=$6, motif=$7, reference_metier=$8, date_operation=$9, effectue_par=$10, statut_operation=$11, motif_annulation=$12, annulee_par=$13, date_annulation=$14, type_depense=$15, justification=$16, impact_journalier=$17, impact_global=$18`,
        [
          op.idOperation,
          this.atelierId,
          caisse.idCaisseJour,
          op.typeOperation,
          op.montant,
          op.modePaiement,
          op.motif,
          op.referenceMetier,
          op.dateOperation,
          op.effectuePar,
          op.statutOperation,
          op.motifAnnulation || null,
          op.annuleePar || null,
          op.dateAnnulation || null,
          op.typeDepense || null,
          op.justification || null,
          op.impactJournalier === undefined ? null : op.impactJournalier === true,
          op.impactGlobal === undefined ? null : op.impactGlobal === true
        ]
      );
    }
  }
}

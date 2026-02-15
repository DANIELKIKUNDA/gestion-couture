import { pool } from "../../../shared/infrastructure/db.js";
import { CaisseJour } from "../../domain/caisse-jour.js";

export class CaisseRepoPg {
  async getById(idCaisseJour) {
    const res = await pool.query(
      "SELECT id_caisse_jour, date_jour, statut, solde_ouverture, solde_cloture, ouverte_par, cloturee_par, date_ouverture, date_cloture, ouverture_anticipee, motif_ouverture_anticipee, autorisee_par FROM caisse_jour WHERE id_caisse_jour = $1",
      [idCaisseJour]
    );
    if (res.rowCount === 0) return null;

    const opRes = await pool.query(
      "SELECT id_operation, type_operation, montant, mode_paiement, motif, reference_metier, date_operation, effectue_par, statut_operation, motif_annulation, annulee_par, date_annulation FROM caisse_operation WHERE id_caisse_jour = $1",
      [idCaisseJour]
    );

    const row = res.rows[0];
    return new CaisseJour({
      idCaisseJour: row.id_caisse_jour,
      date: row.date_jour,
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
        dateAnnulation: op.date_annulation
      }))
    });
  }

  async getByDate(dateJour) {
    const res = await pool.query(
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour = $1 LIMIT 1",
      [dateJour]
    );
    if (res.rowCount === 0) return null;
    return this.getById(res.rows[0].id_caisse_jour);
  }

  async getLatestBeforeDate(dateJour) {
    const res = await pool.query(
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour < $1 ORDER BY date_jour DESC LIMIT 1",
      [dateJour]
    );
    if (res.rowCount === 0) return null;
    return this.getById(res.rows[0].id_caisse_jour);
  }

  async listBeforeDate(dateJour, limit = 60) {
    const res = await pool.query(
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour < $1 ORDER BY date_jour DESC LIMIT $2",
      [dateJour, limit]
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
      "SELECT id_caisse_jour FROM caisse_jour WHERE date_jour >= $1 AND date_jour <= $2 ORDER BY date_jour ASC",
      [dateDebut, dateFin]
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
      `INSERT INTO caisse_jour (id_caisse_jour, date_jour, statut, solde_ouverture, solde_cloture, ouverte_par, cloturee_par, date_ouverture, date_cloture, ouverture_anticipee, motif_ouverture_anticipee, autorisee_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id_caisse_jour)
       DO UPDATE SET date_jour=$2, statut=$3, solde_ouverture=$4, solde_cloture=$5, ouverte_par=$6, cloturee_par=$7, date_ouverture=$8, date_cloture=$9, ouverture_anticipee=$10, motif_ouverture_anticipee=$11, autorisee_par=$12`,
      [
        caisse.idCaisseJour,
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
        `INSERT INTO caisse_operation (id_operation, id_caisse_jour, type_operation, montant, mode_paiement, motif, reference_metier, date_operation, effectue_par, statut_operation, motif_annulation, annulee_par, date_annulation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id_operation)
         DO UPDATE SET type_operation=$3, montant=$4, mode_paiement=$5, motif=$6, reference_metier=$7, date_operation=$8, effectue_par=$9, statut_operation=$10, motif_annulation=$11, annulee_par=$12, date_annulation=$13`,
        [
          op.idOperation,
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
          op.dateAnnulation || null
        ]
      );
    }
  }
}

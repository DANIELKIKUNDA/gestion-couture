import { pool } from "../../../shared/infrastructure/db.js";
import { Commande } from "../../domain/commande.js";
import { CommandeItemRepoPg } from "./commande-item-repo-pg.js";

export class CommandeRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
    this.itemRepo = new CommandeItemRepoPg(this.atelierId, this.db);
  }

  forAtelier(atelierId) {
    return new CommandeRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new CommandeRepoPg(this.atelierId, db || pool);
  }

  async existsByTypeHabit(typeHabit) {
    const normalized = String(typeHabit || "").trim().toUpperCase();
    if (!normalized) return false;
    const res = await this.db.query(
      `SELECT 1
       FROM commandes c
       WHERE c.atelier_id = $1
         AND UPPER(COALESCE(c.type_habit, '')) = $2
       UNION ALL
       SELECT 1
       FROM commande_items ci
       WHERE ci.atelier_id = $1
         AND UPPER(COALESCE(ci.type_habit, '')) = $2
       LIMIT 1`,
      [this.atelierId, normalized]
    );
    return res.rowCount > 0;
  }

  async existsByMeasureCode(measureCode, { typeHabit = null } = {}) {
    const normalizedCode = String(measureCode || "").trim();
    const normalizedTypeHabit = String(typeHabit || "").trim().toUpperCase();
    if (!normalizedCode) return false;
    const params = [this.atelierId, normalizedCode];
    let typeFilterSql = "";
    if (normalizedTypeHabit) {
      params.push(normalizedTypeHabit);
      typeFilterSql = " AND UPPER(COALESCE(type_habit, '')) = $3";
    }
    const res = await this.db.query(
      `SELECT 1
       FROM commandes
       WHERE atelier_id = $1
         AND mesures_habit_snapshot IS NOT NULL
         AND (mesures_habit_snapshot -> 'valeurs') ? $2
         ${typeFilterSql}
       UNION ALL
       SELECT 1
       FROM commande_items
       WHERE atelier_id = $1
         AND mesures_snapshot_json IS NOT NULL
         AND (mesures_snapshot_json -> 'valeurs') ? $2
         ${typeFilterSql}
       LIMIT 1`,
      params
    );
    return res.rowCount > 0;
  }

  async getById(idCommande) {
    const res = await this.db.query(
      "SELECT id_commande, id_client, id_dossier, description, date_creation, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot FROM commandes WHERE id_commande = $1 AND atelier_id = $2",
      [idCommande, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    const items = await this.itemRepo.listByCommande(row.id_commande).catch(() => []);
    return new Commande({
      idCommande: row.id_commande,
      idClient: row.id_client,
      dossierId: row.id_dossier,
      descriptionCommande: row.description,
      dateCreation: row.date_creation,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      statutCommande: row.statut,
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      items,
      rehydrate: true
    });
  }

  async save(commande) {
    await this.db.query(
      `INSERT INTO commandes (id_commande, atelier_id, id_client, id_dossier, description, date_creation, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id_commande)
       DO UPDATE SET atelier_id=$2, id_client=$3, id_dossier=$4, description=$5, date_creation=$6, date_prevue=$7,
         montant_total=$8, montant_paye=$9, statut=$10, type_habit=$11, mesures_habit_snapshot=$12`,
      [
        commande.idCommande,
        this.atelierId,
        commande.idClient,
        commande.dossierId,
        commande.descriptionCommande,
        commande.dateCreation,
        commande.datePrevue,
        commande.montantTotal,
        commande.montantPaye,
        commande.statutCommande,
        commande.typeHabit,
        JSON.stringify(commande.mesuresHabit)
      ]
    );
  }
}

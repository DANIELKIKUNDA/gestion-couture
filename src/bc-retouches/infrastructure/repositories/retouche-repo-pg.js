import { pool } from "../../../shared/infrastructure/db.js";
import { Retouche } from "../../domain/retouche.js";
import { RetoucheItemRepoPg } from "./retouche-item-repo-pg.js";

export class RetoucheRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
    this.itemRepo = new RetoucheItemRepoPg(this.atelierId, this.db);
  }

  forAtelier(atelierId) {
    return new RetoucheRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new RetoucheRepoPg(this.atelierId, db || pool);
  }

  async existsByTypeRetouche(typeRetouche) {
    const normalized = String(typeRetouche || "").trim().toUpperCase();
    if (!normalized) return false;
    const res = await this.db.query(
      `SELECT 1
       FROM retouches r
       WHERE r.atelier_id = $1
         AND UPPER(COALESCE(r.type_retouche, '')) = $2
       UNION ALL
       SELECT 1
       FROM retouche_items ri
       WHERE ri.atelier_id = $1
         AND UPPER(COALESCE(ri.type_retouche, '')) = $2
       LIMIT 1`,
      [this.atelierId, normalized]
    );
    return res.rowCount > 0;
  }

  async existsByTypeHabit(typeHabit) {
    const normalized = String(typeHabit || "").trim().toUpperCase();
    if (!normalized) return false;
    const res = await this.db.query(
      `SELECT 1
       FROM retouches r
       WHERE r.atelier_id = $1
         AND UPPER(COALESCE(r.type_habit, '')) = $2
       UNION ALL
       SELECT 1
       FROM retouche_items ri
       WHERE ri.atelier_id = $1
         AND UPPER(COALESCE(ri.type_habit, '')) = $2
       LIMIT 1`,
      [this.atelierId, normalized]
    );
    return res.rowCount > 0;
  }

  async existsByMeasureCode(measureCode, { typeRetouche = null, typeHabit = null } = {}) {
    const normalizedCode = String(measureCode || "").trim();
    const normalizedTypeRetouche = String(typeRetouche || "").trim().toUpperCase();
    const normalizedTypeHabit = String(typeHabit || "").trim().toUpperCase();
    if (!normalizedCode) return false;
    const params = [this.atelierId, normalizedCode];
    let extraRootFilter = "";
    let extraItemFilter = "";
    if (normalizedTypeRetouche) {
      params.push(normalizedTypeRetouche);
      extraRootFilter += ` AND UPPER(COALESCE(type_retouche, '')) = $${params.length}`;
      extraItemFilter += ` AND UPPER(COALESCE(type_retouche, '')) = $${params.length}`;
    }
    if (normalizedTypeHabit) {
      params.push(normalizedTypeHabit);
      extraRootFilter += ` AND UPPER(COALESCE(type_habit, '')) = $${params.length}`;
      extraItemFilter += ` AND UPPER(COALESCE(type_habit, '')) = $${params.length}`;
    }
    const res = await this.db.query(
      `SELECT 1
       FROM retouches
       WHERE atelier_id = $1
         AND mesures_habit_snapshot IS NOT NULL
         AND (mesures_habit_snapshot -> 'valeurs') ? $2
         ${extraRootFilter}
       UNION ALL
       SELECT 1
       FROM retouche_items
       WHERE atelier_id = $1
         AND mesures_snapshot_json IS NOT NULL
         AND (mesures_snapshot_json -> 'valeurs') ? $2
         ${extraItemFilter}
       LIMIT 1`,
      params
    );
    return res.rowCount > 0;
  }

  async getById(idRetouche) {
    const res = await this.db.query(
      "SELECT id_retouche, id_client, id_dossier, description, type_retouche, date_depot, date_prevue, priorite, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot FROM retouches WHERE id_retouche = $1 AND atelier_id = $2",
      [idRetouche, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    const items = await this.itemRepo.listByRetouche(idRetouche);
    return new Retouche({
      idRetouche: row.id_retouche,
      idClient: row.id_client,
      dossierId: row.id_dossier,
      descriptionRetouche: row.description,
      typeRetouche: row.type_retouche,
      dateDepot: row.date_depot,
      datePrevue: row.date_prevue,
      priorite: row.priorite,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      statutRetouche: row.statut,
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      items,
      rehydrate: true
    });
  }

  async save(retouche) {
    await this.db.query(
      `INSERT INTO retouches (id_retouche, atelier_id, id_client, id_dossier, description, type_retouche, date_depot, date_prevue, priorite, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id_retouche)
       DO UPDATE SET atelier_id=$2, id_client=$3, id_dossier=$4, description=$5, type_retouche=$6, date_depot=$7, date_prevue=$8,
         priorite=$9, montant_total=$10, montant_paye=$11, statut=$12, type_habit=$13, mesures_habit_snapshot=$14`,
      [
        retouche.idRetouche,
        this.atelierId,
        retouche.idClient,
        retouche.dossierId,
        retouche.descriptionRetouche,
        retouche.typeRetouche,
        retouche.dateDepot,
        retouche.datePrevue,
        retouche.priorite,
        retouche.montantTotal,
        retouche.montantPaye,
        retouche.statutRetouche,
        retouche.typeHabit,
        JSON.stringify(retouche.mesuresHabit)
      ]
    );
  }
}

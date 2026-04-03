import { pool } from "../../../shared/infrastructure/db.js";
import { RetoucheItem } from "../../domain/retouche-item.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMeasures(value) {
  if (!value || typeof value !== "object") return null;
  return value;
}

export class RetoucheItemRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new RetoucheItemRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new RetoucheItemRepoPg(this.atelierId, db || pool);
  }

  async hasMeasuresColumns() {
    const result = await this.db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'retouche_items'
         AND column_name IN ('type_habit', 'mesures_snapshot_json')`
    ).catch((error) => {
      if (String(error?.code || "") === "42P01") return { rows: [] };
      throw error;
    });
    const names = new Set((result?.rows || []).map((row) => String(row.column_name || "").trim()));
    return names.has("type_habit") && names.has("mesures_snapshot_json");
  }

  async listByRetouche(idRetouche) {
    const normalizedId = normalizeText(idRetouche);
    if (!normalizedId) return [];
    let result;
    try {
      const withMeasuresColumns = await this.hasMeasuresColumns();
      result = await this.db.query(
        `SELECT id_item, id_retouche, type_retouche, description, prix, ordre_affichage, date_creation${
          withMeasuresColumns ? ", type_habit, mesures_snapshot_json" : ""
        }
         FROM retouche_items
         WHERE atelier_id = $1 AND id_retouche = $2
         ORDER BY ordre_affichage ASC, date_creation ASC`,
        [this.atelierId, normalizedId]
      );
    } catch (error) {
      if (String(error?.code || "") === "42P01") return [];
      throw error;
    }
    return result.rows.map((row) => new RetoucheItem({
      idItem: row.id_item,
      idRetouche: row.id_retouche,
      typeRetouche: row.type_retouche || "",
      typeHabit: row.type_habit || null,
      description: row.description || "",
      prix: Number(row.prix || 0),
      ordreAffichage: Number(row.ordre_affichage || 1),
      mesures: normalizeMeasures(row.mesures_snapshot_json),
      dateCreation: row.date_creation,
      rehydrate: true
    }));
  }

  async replaceForRetouche(idRetouche, items = []) {
    const normalizedRetoucheId = normalizeText(idRetouche);
    if (!normalizedRetoucheId) throw new Error("idRetouche obligatoire pour enregistrer les items.");
    await this.db.query("DELETE FROM retouche_items WHERE atelier_id = $1 AND id_retouche = $2", [this.atelierId, normalizedRetoucheId]);
    const withMeasuresColumns = await this.hasMeasuresColumns();
    for (const [index, item] of items.entries()) {
      if (withMeasuresColumns) {
        await this.db.query(
          `INSERT INTO retouche_items (id_item, atelier_id, id_retouche, type_retouche, type_habit, description, prix, ordre_affichage, mesures_snapshot_json, date_creation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,COALESCE($10, NOW()))`,
          [
            item.idItem,
            this.atelierId,
            normalizedRetoucheId,
            normalizeText(item.typeRetouche),
            normalizeText(item.typeHabit).toUpperCase() || null,
            normalizeText(item.description),
            Number(item.prix || 0),
            Number(item.ordreAffichage || index + 1),
            item.mesures ? JSON.stringify(item.mesures) : null,
            item.dateCreation || null
          ]
        );
      } else {
        await this.db.query(
          `INSERT INTO retouche_items (id_item, atelier_id, id_retouche, type_retouche, description, prix, ordre_affichage, date_creation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))`,
          [
            item.idItem,
            this.atelierId,
            normalizedRetoucheId,
            normalizeText(item.typeRetouche),
            normalizeText(item.description),
            Number(item.prix || 0),
            Number(item.ordreAffichage || index + 1),
            item.dateCreation || null
          ]
        );
      }
    }
  }
}

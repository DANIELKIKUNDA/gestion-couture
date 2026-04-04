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
         AND column_name IN ('type_habit', 'mesures_snapshot_json', 'montant_paye')`
    ).catch((error) => {
      if (String(error?.code || "") === "42P01") return { rows: [] };
      throw error;
    });
    const names = new Set((result?.rows || []).map((row) => String(row.column_name || "").trim()));
    return {
      hasMeasures: names.has("type_habit") && names.has("mesures_snapshot_json"),
      hasMontantPaye: names.has("montant_paye")
    };
  }

  async listByRetouche(idRetouche) {
    const normalizedId = normalizeText(idRetouche);
    if (!normalizedId) return [];
    let result;
    try {
      const columns = await this.hasMeasuresColumns();
      result = await this.db.query(
        `SELECT id_item, id_retouche, type_retouche, description, prix, ${
          columns.hasMontantPaye ? "montant_paye," : ""
        } ordre_affichage, date_creation${
          columns.hasMeasures ? ", type_habit, mesures_snapshot_json" : ""
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
      montantPaye: Number(row.montant_paye || 0),
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
    const columns = await this.hasMeasuresColumns();
    for (const [index, item] of items.entries()) {
      const insertColumns = [
        "id_item",
        "atelier_id",
        "id_retouche",
        "type_retouche"
      ];
      const insertValues = [
        item.idItem,
        this.atelierId,
        normalizedRetoucheId,
        normalizeText(item.typeRetouche)
      ];
      if (columns.hasMeasures) {
        insertColumns.push("type_habit");
        insertValues.push(normalizeText(item.typeHabit).toUpperCase() || null);
      }
      insertColumns.push("description", "prix");
      insertValues.push(normalizeText(item.description), Number(item.prix || 0));
      if (columns.hasMontantPaye) {
        insertColumns.push("montant_paye");
        insertValues.push(Number(item.montantPaye || 0));
      }
      insertColumns.push("ordre_affichage");
      insertValues.push(Number(item.ordreAffichage || index + 1));
      if (columns.hasMeasures) {
        insertColumns.push("mesures_snapshot_json");
        insertValues.push(item.mesures ? JSON.stringify(item.mesures) : null);
      }
      insertColumns.push("date_creation");
      insertValues.push(item.dateCreation || null);
      const placeholders = insertValues.map((_, valueIndex) => `$${valueIndex + 1}`);
      if (columns.hasMeasures) {
        const measuresIndex = insertColumns.indexOf("mesures_snapshot_json");
        placeholders[measuresIndex] = `${placeholders[measuresIndex]}::jsonb`;
      }
      const dateCreationIndex = insertValues.length;
      placeholders[placeholders.length - 1] = `COALESCE($${dateCreationIndex}, NOW())`;
      await this.db.query(
        `INSERT INTO retouche_items (${insertColumns.join(", ")})
         VALUES (${placeholders.join(", ")})`,
        insertValues
      );
    }
  }
}

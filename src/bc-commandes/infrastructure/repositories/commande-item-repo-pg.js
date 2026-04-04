import { pool } from "../../../shared/infrastructure/db.js";
import { CommandeItem } from "../../domain/commande-item.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMeasures(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

async function hasCommandeItemMeasuresColumn(db) {
  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'commande_items'
       AND column_name IN ('mesures_snapshot_json', 'montant_paye')`
  );
  const names = new Set((result.rows || []).map((row) => String(row.column_name || "").trim()));
  return {
    hasMeasures: names.has("mesures_snapshot_json"),
    hasMontantPaye: names.has("montant_paye")
  };
}

export class CommandeItemRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new CommandeItemRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new CommandeItemRepoPg(this.atelierId, db || pool);
  }

  async listByCommande(idCommande) {
    const normalizedId = normalizeText(idCommande);
    if (!normalizedId) return [];
    const columns = await hasCommandeItemMeasuresColumn(this.db).catch(() => ({ hasMeasures: false, hasMontantPaye: false }));
    try {
      const result = await this.db.query(
        columns.hasMeasures || columns.hasMontantPaye
          ? `SELECT id_item, id_commande, type_habit, description, prix, ordre_affichage, ${
              columns.hasMontantPaye ? "montant_paye," : ""
            } ${columns.hasMeasures ? "mesures_snapshot_json," : ""} date_creation
             FROM commande_items
             WHERE atelier_id = $1 AND id_commande = $2
             ORDER BY ordre_affichage ASC, date_creation ASC`
          : `SELECT id_item, id_commande, type_habit, description, prix, ordre_affichage, date_creation
             FROM commande_items
             WHERE atelier_id = $1 AND id_commande = $2
             ORDER BY ordre_affichage ASC, date_creation ASC`,
        [this.atelierId, normalizedId]
      );
      return result.rows.map((row) => ({
        idItem: row.id_item,
        idCommande: row.id_commande,
        typeHabit: row.type_habit || "",
        description: row.description || "",
        prix: Number(row.prix || 0),
        montantPaye: Number(row.montant_paye || 0),
        ordreAffichage: Number(row.ordre_affichage || 1),
        mesures: normalizeMeasures(row.mesures_snapshot_json),
        dateCreation: row.date_creation
      })).map((row) => new CommandeItem({ ...row, rehydrate: true }));
    } catch (error) {
      if (String(error?.code || "") === "42P01") return [];
      throw error;
    }
  }

  async replaceForCommande(idCommande, items = []) {
    const normalizedCommandeId = normalizeText(idCommande);
    if (!normalizedCommandeId) throw new Error("idCommande obligatoire pour enregistrer les items.");
    await this.db.query("DELETE FROM commande_items WHERE atelier_id = $1 AND id_commande = $2", [this.atelierId, normalizedCommandeId]);
    const columns = await hasCommandeItemMeasuresColumn(this.db).catch(() => ({ hasMeasures: false, hasMontantPaye: false }));
    for (const [index, item] of items.entries()) {
      const insertColumns = [
        "id_item",
        "atelier_id",
        "id_commande",
        "type_habit",
        "description",
        "prix"
      ];
      const insertValues = [
        item.idItem,
        this.atelierId,
        normalizedCommandeId,
        normalizeText(item.typeHabit),
        normalizeText(item.description),
        Number(item.prix || 0)
      ];
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
        `INSERT INTO commande_items (${insertColumns.join(", ")})
         VALUES (${placeholders.join(", ")})`,
        insertValues
      );
    }
  }
}
